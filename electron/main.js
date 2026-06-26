'use strict'

const { app, BrowserWindow, ipcMain, shell, dialog, Menu, nativeImage } = require('electron')
const path   = require('path')
const fs     = require('fs')
const os     = require('os')
const net    = require('net')
const crypto = require('crypto')

// ── Native modules (lazy) ────────────────────────────────────────────────────
let pty, Store, keytar, SerialPort

try { pty      = require('node-pty')           } catch (e) { console.warn('node-pty:', e.message) }
try { const { default: S } = require('electron-store'); Store = S } catch (e) { console.warn('electron-store:', e.message) }
try { keytar   = require('keytar')             } catch (e) { console.warn('keytar not available (credentials stored encrypted in store)') }
try { SerialPort = require('serialport').SerialPort } catch (e) { console.warn('serialport:', e.message) }

const { Client: SSHClient } = require('ssh2')

// ── Constants ─────────────────────────────────────────────────────────────────
const KEYCHAIN_SERVICE = 'com.helix.terminal'
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

// ── Persistent store ──────────────────────────────────────────────────────────
let store = null
if (Store) {
  store = new Store({
    name: 'helix-data',
    encryptionKey: 'helix-secret-2025', // basic obfuscation; keytar used for real secrets
    defaults: {
      sessions:   [],
      aiSettings: {
        provider: 'openai', openaiKey: '', openaiModel: 'gpt-4o-mini',
        anthropicKey: '', anthropicModel: 'claude-3-5-haiku-20241022',
        googleKey: '', googleModel: 'gemini-1.5-flash',
        ollamaBase: 'http://localhost:11434', ollamaModel: 'llama3',
        contextLines: 60,
      },
      termSettings: {
        fontFamily: 'JetBrains Mono', fontSize: 13, cursorStyle: 'block',
        scrollback: 10000, bellEnabled: false, autoLog: false,
      },
      knownHosts:   {},    // { 'host:port': fingerprint }
      macros:       [],    // [{ id, name, commands: [{cmd, delay}] }]
      buttonBars:   {},    // { sessionId: [{ label, command }] }
      highlights:   [      // keyword highlight rules
        { pattern: '(error|Error|ERROR)',   color: '#ef4444', bg: 'transparent' },
        { pattern: '(warn|Warn|WARNING)',   color: '#f59e0b', bg: 'transparent' },
        { pattern: '(success|SUCCESS|OK)',  color: '#22c55e', bg: 'transparent' },
        { pattern: 'down|DOWN|unreachable', color: '#ef4444', bg: 'transparent' },
      ],
      portForwards: [],
    },
  })
}

// ── Active terminal registry ──────────────────────────────────────────────────
// Map<id, { type, pty?, ssh?, stream?, serial?, telnet?, win, reconnectConfig?, keepaliveTimer?, logStream? }>
const terminals = new Map()
const logStreams = new Map()
const portForwardServers = new Map()

const logDir = path.join(app.getPath('userData'), 'logs')
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true })

let mainWindow = null

// ── Known hosts ───────────────────────────────────────────────────────────────
function getKnownHosts() { return store?.get('knownHosts') || {} }
function saveKnownHost(host, port, fingerprint) {
  const kh = getKnownHosts()
  kh[`${host}:${port}`] = fingerprint
  store?.set('knownHosts', kh)
}

// ── Helper: send to renderer ───────────────────────────────────────────────────
function sendToRenderer(channel, ...args) {
  try { mainWindow?.webContents.send(channel, ...args) } catch {}
}

// ── Keepalive management ──────────────────────────────────────────────────────
function startKeepalive(id, intervalMs = 30000) {
  const t = terminals.get(id)
  if (!t) return
  t.keepaliveTimer = setInterval(() => {
    try {
      if (t.type === 'ssh' && t.stream) t.stream.write('\x00')
      if (t.type === 'local' && t.pty)  t.pty.write('')
    } catch {}
  }, intervalMs)
}
function stopKeepalive(id) {
  const t = terminals.get(id)
  if (t?.keepaliveTimer) { clearInterval(t.keepaliveTimer); t.keepaliveTimer = null }
}

// ── Window ────────────────────────────────────────────────────────────────────
function createWindow() {
  const iconPath = path.join(__dirname, '../public/helix-icon.png')
  const icon = fs.existsSync(iconPath) ? nativeImage.createFromPath(iconPath) : undefined

  mainWindow = new BrowserWindow({
    width: 1440, height: 900, minWidth: 900, minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0a0e17',
    icon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      spellcheck: false,
    },
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    // mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => {
    terminals.forEach((t, id) => { cleanupTerminal(id) })
    portForwardServers.forEach(s => { try { s.close() } catch {} })
    mainWindow = null
  })

  buildAppMenu()
}

function buildAppMenu() {
  const template = [
    {
      label: 'Helix',
      submenu: [
        { label: 'About Helix', role: 'about' },
        { type: 'separator' },
        { label: 'Settings', accelerator: 'Cmd+,', click: () => sendToRenderer('menu:settings') },
        { type: 'separator' },
        { label: 'Hide Helix', role: 'hide' },
        { label: 'Hide Others', role: 'hideOthers' },
        { type: 'separator' },
        { label: 'Quit Helix', role: 'quit' },
      ],
    },
    {
      label: 'Session',
      submenu: [
        { label: 'New Session', accelerator: 'Cmd+N', click: () => sendToRenderer('menu:new-session') },
        { label: 'New Tab', accelerator: 'Cmd+T', click: () => sendToRenderer('menu:new-tab') },
        { label: 'Close Tab', accelerator: 'Cmd+W', click: () => sendToRenderer('menu:close-tab') },
        { type: 'separator' },
        { label: 'Send to All Tabs', accelerator: 'Cmd+Shift+B', click: () => sendToRenderer('menu:broadcast') },
      ],
    },
    {
      label: 'Terminal',
      submenu: [
        { label: 'Find', accelerator: 'Cmd+F', click: () => sendToRenderer('menu:find') },
        { label: 'Clear Scrollback', accelerator: 'Cmd+K', click: () => sendToRenderer('menu:clear') },
        { type: 'separator' },
        { label: 'Split Horizontal', accelerator: 'Cmd+Shift+H', click: () => sendToRenderer('menu:split-h') },
        { label: 'Split Vertical',   accelerator: 'Cmd+Shift+V', click: () => sendToRenderer('menu:split-v') },
        { type: 'separator' },
        { label: 'Start Logging',    accelerator: 'Cmd+Shift+L', click: () => sendToRenderer('menu:toggle-log') },
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: 'Toggle AI Sidebar', accelerator: 'Cmd+Shift+A', click: () => sendToRenderer('menu:toggle-ai') },
        { label: 'SFTP Browser', accelerator: 'Cmd+Shift+S', click: () => sendToRenderer('menu:sftp') },
        { type: 'separator' },
        { label: 'Reload', role: 'reload' },
        { label: 'Toggle DevTools', role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' },
        { type: 'separator' },
        { label: 'Command Palette', accelerator: 'Cmd+P', click: () => sendToRenderer('menu:palette') },
      ],
    },
    { label: 'Window', role: 'windowMenu' },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })

// ─────────────────────────────────────────────────────────────────────────────
// Cleanup
// ─────────────────────────────────────────────────────────────────────────────
function cleanupTerminal(id) {
  stopKeepalive(id)
  const t = terminals.get(id)
  if (!t) return
  try { t.pty?.kill() }        catch {}
  try { t.stream?.end() }      catch {}
  try { t.ssh?.end() }         catch {}
  try { t.serial?.close() }    catch {}
  try { t.telnet?.destroy() }  catch {}
  logStreams.get(id)?.end()
  logStreams.delete(id)
  terminals.delete(id)
}

// ─────────────────────────────────────────────────────────────────────────────
// IPC: Persistence
// ─────────────────────────────────────────────────────────────────────────────
ipcMain.handle('store:get', (_e, key)        => store?.get(key))
ipcMain.handle('store:set', (_e, key, value) => store?.set(key, value))

// ─────────────────────────────────────────────────────────────────────────────
// IPC: Keychain (macOS Keychain via keytar)
// ─────────────────────────────────────────────────────────────────────────────
ipcMain.handle('keychain:save',   async (_e, { account, password }) => {
  if (keytar) { await keytar.setPassword(KEYCHAIN_SERVICE, account, password); return { ok: true } }
  // fallback: store in encrypted store
  const creds = store?.get('credentials') || {}
  creds[account] = Buffer.from(password).toString('base64')
  store?.set('credentials', creds)
  return { ok: true, fallback: true }
})
ipcMain.handle('keychain:get',    async (_e, { account }) => {
  if (keytar) return keytar.getPassword(KEYCHAIN_SERVICE, account)
  const creds = store?.get('credentials') || {}
  const b = creds[account]
  return b ? Buffer.from(b, 'base64').toString() : null
})
ipcMain.handle('keychain:delete', async (_e, { account }) => {
  if (keytar) { await keytar.deletePassword(KEYCHAIN_SERVICE, account); return { ok: true } }
  const creds = store?.get('credentials') || {}
  delete creds[account]
  store?.set('credentials', creds)
  return { ok: true }
})

// ─────────────────────────────────────────────────────────────────────────────
// IPC: Serial port enumeration
// ─────────────────────────────────────────────────────────────────────────────
ipcMain.handle('serial:list', async () => {
  if (!SerialPort) return { error: 'serialport not available' }
  try {
    const ports = await SerialPort.list()
    return { ports }
  } catch (e) { return { error: e.message } }
})

// ─────────────────────────────────────────────────────────────────────────────
// IPC: Known hosts
// ─────────────────────────────────────────────────────────────────────────────
ipcMain.handle('hosts:list',   () => getKnownHosts())
ipcMain.handle('hosts:delete', (_e, { key }) => {
  const kh = getKnownHosts()
  delete kh[key]
  store?.set('knownHosts', kh)
  return { ok: true }
})

// ─────────────────────────────────────────────────────────────────────────────
// IPC: Local terminal
// ─────────────────────────────────────────────────────────────────────────────
ipcMain.handle('terminal:create-local', async (event, { id, cols = 80, rows = 24 }) => {
  if (!pty) return { error: 'node-pty not available' }
  cleanupTerminal(id)

  const shellBin = process.platform === 'win32'
    ? 'powershell.exe'
    : (process.env.SHELL || '/bin/bash')
  const args = process.platform === 'win32' ? [] : ['-l']

  const term = pty.spawn(shellBin, args, {
    name: 'xterm-256color', cols, rows,
    cwd: os.homedir(),
    env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor' },
  })

  const send = (data) => {
    sendToRenderer(`terminal:output:${id}`, data)
    logStreams.get(id)?.write(data)
  }

  term.onData(send)
  term.onExit(({ exitCode }) => {
    sendToRenderer(`terminal:exit:${id}`, exitCode)
    cleanupTerminal(id)
  })

  terminals.set(id, { type: 'local', pty: term })
  startKeepalive(id)
  return { ok: true, pid: term.pid }
})

// ─────────────────────────────────────────────────────────────────────────────
// IPC: SSH terminal (with host key verify, jump host, interactive auth)
// ─────────────────────────────────────────────────────────────────────────────
ipcMain.handle('terminal:create-ssh', async (event, config) => {
  const {
    id, host, port = 22, username, password, privateKey, passphrase,
    cols = 80, rows = 24,
    jumpHost,            // { host, port, username, password, privateKey }
    socksProxy,          // { host, port, type: 4|5 }
    agentForwarding = false,
    keepaliveInterval = 30000,
    verifyHost = true,
  } = config

  cleanupTerminal(id)

  return new Promise((resolve) => {
    const send = (data) => {
      sendToRenderer(`terminal:output:${id}`, data)
      logStreams.get(id)?.write(data)
    }

    function buildAuthConfig(cfg) {
      const auth = {
        host: cfg.host, port: cfg.port || 22,
        username: cfg.username,
        readyTimeout: 20000,
        keepaliveInterval: keepaliveInterval,
        agentForward: agentForwarding,
      }
      if (cfg.privateKey) {
        try {
          const kp = cfg.privateKey.replace(/^~/, os.homedir())
          auth.privateKey = fs.readFileSync(kp)
          if (cfg.passphrase) auth.passphrase = cfg.passphrase
        } catch (e) { return { error: `Cannot read key: ${e.message}` } }
      } else if (cfg.password) {
        auth.password = cfg.password
      }
      if (agentForwarding && process.env.SSH_AUTH_SOCK) {
        auth.agent = process.env.SSH_AUTH_SOCK
      }
      return auth
    }

    function openShell(conn) {
      conn.shell({ term: 'xterm-256color', cols, rows }, (err, stream) => {
        if (err) { conn.end(); return resolve({ error: err.message }) }

        stream.on('data',         d => send(d.toString()))
        stream.stderr.on('data',  d => send(d.toString()))
        stream.on('close', () => {
          sendToRenderer(`terminal:exit:${id}`, 0)
          cleanupTerminal(id)
        })

        terminals.set(id, {
          type: 'ssh', ssh: conn, stream,
          reconnectConfig: config,
        })
        startKeepalive(id, keepaliveInterval)
        resolve({ ok: true })
      })
    }

    function connectSSH(authConfig, onReady) {
      const conn = new SSHClient()

      // Host key verification
      conn.on('handshake', (neg) => {})

      if (verifyHost) {
        conn.on('ready', () => onReady(conn))

        // We hook hostVerifier below
        authConfig.hostVerifier = (keyData, done) => {
          const fingerprint = crypto.createHash('sha256').update(keyData).digest('hex')
          const key = `${authConfig.host}:${authConfig.port}`
          const known = getKnownHosts()[key]

          if (known === fingerprint) {
            done(true)
          } else if (known) {
            // Fingerprint changed — reject and alert user
            sendToRenderer('ssh:host-key-changed', { id, host: authConfig.host, port: authConfig.port, fingerprint, stored: known })
            done(false)
          } else {
            // Unknown host — ask user
            sendToRenderer('ssh:unknown-host', { id, host: authConfig.host, port: authConfig.port, fingerprint })
            // IPC reply: ssh:trust-host
            ipcMain.once(`ssh:trust-host:${id}`, (_e, { trust }) => {
              if (trust) saveKnownHost(authConfig.host, authConfig.port, fingerprint)
              done(trust)
            })
          }
        }
      } else {
        conn.on('ready', () => onReady(conn))
      }

      // Keyboard-interactive auth (MFA / OTP)
      conn.on('keyboard-interactive', (_name, _instructions, _lang, prompts, finish) => {
        sendToRenderer('ssh:keyboard-interactive', { id, prompts: prompts.map(p => ({ prompt: p.prompt, echo: p.echo })) })
        ipcMain.once(`ssh:keyboard-interactive-reply:${id}`, (_e, { responses }) => finish(responses))
      })

      conn.on('error', (err) => {
        terminals.delete(id)
        resolve({ error: err.message })
      })

      try { conn.connect(authConfig) } catch (e) { resolve({ error: e.message }) }
      return conn
    }

    if (jumpHost) {
      // ProxyJump: connect to jump host first, then tunnel to target
      const jumpAuth = buildAuthConfig(jumpHost)
      if (jumpAuth.error) return resolve(jumpAuth)

      const jumpConn = new SSHClient()
      jumpConn.on('ready', () => {
        jumpConn.forwardOut('127.0.0.1', 0, host, port, (err, stream) => {
          if (err) { jumpConn.end(); return resolve({ error: `Jump host tunnel error: ${err.message}` }) }

          const targetAuth = buildAuthConfig(config)
          if (targetAuth.error) return resolve(targetAuth)
          targetAuth.sock = stream

          const targetConn = new SSHClient()
          targetConn.on('ready', () => {
            // store jumpConn so it can be cleaned up
            const existing = terminals.get(id) || {}
            terminals.set(id, { ...existing, jumpSsh: jumpConn })
            openShell(targetConn)
          })
          targetConn.on('keyboard-interactive', (_n, _i, _l, prompts, finish) => {
            sendToRenderer('ssh:keyboard-interactive', { id, prompts: prompts.map(p => ({ prompt: p.prompt, echo: p.echo })) })
            ipcMain.once(`ssh:keyboard-interactive-reply:${id}`, (_e, { responses }) => finish(responses))
          })
          targetConn.on('error', (err) => { jumpConn.end(); resolve({ error: err.message }) })
          targetConn.connect(targetAuth)
        })
      })
      jumpConn.on('error', err => resolve({ error: `Jump host error: ${err.message}` }))
      const jumpAuthFull = buildAuthConfig(jumpHost)
      jumpConn.connect(jumpAuthFull)
    } else {
      const authConfig = buildAuthConfig(config)
      if (authConfig.error) return resolve(authConfig)
      connectSSH(authConfig, openShell)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// IPC: Telnet terminal
// ─────────────────────────────────────────────────────────────────────────────
ipcMain.handle('terminal:create-telnet', async (event, { id, host, port = 23, cols = 80, rows = 24 }) => {
  cleanupTerminal(id)

  return new Promise((resolve) => {
    const socket = new net.Socket()

    const send = (data) => {
      sendToRenderer(`terminal:output:${id}`, data)
      logStreams.get(id)?.write(data)
    }

    // IAC negotiation — DO/DONT/WILL/WONT
    function processIAC(buf) {
      const IAC = 255, WILL = 251, WONT = 252, DO = 253, DONT = 254
      const SB = 250, SE = 240
      const ECHO = 1, SUPPRESS_GO_AHEAD = 3, NAWS = 31, TERMINAL_TYPE = 24

      let i = 0
      let text = ''
      const responses = []

      while (i < buf.length) {
        if (buf[i] === IAC) {
          if (i + 1 >= buf.length) break
          const cmd = buf[i + 1]
          if (cmd === WILL || cmd === WONT || cmd === DO || cmd === DONT) {
            const opt = buf[i + 2]
            // Respond to common options
            if (cmd === WILL && opt === ECHO)              responses.push(Buffer.from([IAC, DO,   ECHO]))
            else if (cmd === WILL && opt === SUPPRESS_GO_AHEAD) responses.push(Buffer.from([IAC, DO, SUPPRESS_GO_AHEAD]))
            else if (cmd === DO   && opt === TERMINAL_TYPE) responses.push(Buffer.from([IAC, WILL, TERMINAL_TYPE]))
            else if (cmd === DO   && opt === NAWS) {
              // Send window size
              responses.push(Buffer.from([IAC, WILL, NAWS]))
              const nawsBuf = Buffer.from([IAC, SB, NAWS, 0, cols & 0xFF, 0, rows & 0xFF, IAC, SE])
              responses.push(nawsBuf)
            } else if (cmd === DO)   responses.push(Buffer.from([IAC, WONT, opt]))
            else if (cmd === WILL)   responses.push(Buffer.from([IAC, DONT, opt]))
            i += 3
          } else if (cmd === SB) {
            // Skip subnegotiation
            let j = i + 2
            while (j < buf.length - 1 && !(buf[j] === IAC && buf[j+1] === SE)) j++
            i = j + 2
          } else {
            i += 2
          }
        } else {
          text += String.fromCharCode(buf[i])
          i++
        }
      }

      if (responses.length) socket.write(Buffer.concat(responses))
      return text
    }

    socket.on('data', (data) => {
      const text = processIAC(data)
      if (text) send(text)
    })

    socket.on('close', () => {
      sendToRenderer(`terminal:exit:${id}`, 0)
      cleanupTerminal(id)
    })

    socket.on('error', (err) => {
      terminals.delete(id)
      resolve({ error: err.message })
    })

    socket.connect(port, host, () => {
      terminals.set(id, { type: 'telnet', telnet: socket })
      resolve({ ok: true })
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// IPC: Serial terminal
// ─────────────────────────────────────────────────────────────────────────────
ipcMain.handle('terminal:create-serial', async (event, {
  id, path: portPath, baudRate = 9600, dataBits = 8,
  stopBits = 1, parity = 'none', cols = 80, rows = 24,
}) => {
  if (!SerialPort) return { error: 'serialport library not available. Run: npm install serialport' }
  cleanupTerminal(id)

  return new Promise((resolve) => {
    const send = (data) => {
      sendToRenderer(`terminal:output:${id}`, data.toString())
      logStreams.get(id)?.write(data.toString())
    }

    try {
      const port = new SerialPort({ path: portPath, baudRate, dataBits, stopBits, parity })
      port.on('data',  send)
      port.on('error', (err) => resolve({ error: err.message }))
      port.on('close', () => {
        sendToRenderer(`terminal:exit:${id}`, 0)
        cleanupTerminal(id)
      })
      port.on('open', () => {
        terminals.set(id, { type: 'serial', serial: port })
        resolve({ ok: true })
      })
    } catch (e) {
      resolve({ error: e.message })
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// IPC: Terminal I/O (shared)
// ─────────────────────────────────────────────────────────────────────────────
ipcMain.handle('terminal:input', (_e, { id, data }) => {
  const t = terminals.get(id)
  if (!t) return
  try {
    if (t.type === 'local'  && t.pty)    t.pty.write(data)
    if (t.type === 'ssh'    && t.stream) t.stream.write(data)
    if (t.type === 'telnet' && t.telnet) t.telnet.write(data)
    if (t.type === 'serial' && t.serial) t.serial.write(data)
  } catch {}
})

ipcMain.handle('terminal:resize', (_e, { id, cols, rows }) => {
  const t = terminals.get(id)
  if (!t) return
  try {
    if (t.type === 'local' && t.pty)    t.pty.resize(cols, rows)
    if (t.type === 'ssh'   && t.stream) t.stream.setWindow(rows, cols, 0, 0)
  } catch {}
})

ipcMain.handle('terminal:kill', (_e, { id }) => cleanupTerminal(id))

// Broadcast: send same data to multiple terminal IDs
ipcMain.handle('terminal:broadcast', (_e, { ids, data }) => {
  for (const id of ids) {
    const t = terminals.get(id)
    if (!t) continue
    try {
      if (t.type === 'local'  && t.pty)    t.pty.write(data)
      if (t.type === 'ssh'    && t.stream) t.stream.write(data)
      if (t.type === 'telnet' && t.telnet) t.telnet.write(data)
    } catch {}
  }
})

// Auto-reconnect
ipcMain.handle('terminal:reconnect', async (event, { id }) => {
  const t = terminals.get(id)
  const cfg = t?.reconnectConfig
  if (!cfg) return { error: 'No reconnect config' }
  cleanupTerminal(id)
  // Small delay before reconnect
  await new Promise(r => setTimeout(r, 1500))
  return ipcMain.emit('terminal:create-ssh', event, cfg)
})

// ─────────────────────────────────────────────────────────────────────────────
// IPC: Port forwarding
// ─────────────────────────────────────────────────────────────────────────────
ipcMain.handle('portfwd:start', async (_e, { sessionId, type, localPort, remoteHost, remotePort }) => {
  const t = terminals.get(sessionId)
  if (!t?.ssh) return { error: 'No active SSH connection' }

  if (type === 'local') {
    const server = net.createServer((localSocket) => {
      t.ssh.forwardOut('127.0.0.1', localPort, remoteHost, remotePort, (err, stream) => {
        if (err) { localSocket.destroy(); return }
        localSocket.pipe(stream).pipe(localSocket)
        stream.on('close', () => localSocket.destroy())
        localSocket.on('close', () => stream.end())
      })
    })
    server.listen(localPort, '127.0.0.1', () => {
      portForwardServers.set(`${sessionId}:${localPort}`, server)
    })
    server.on('error', err => sendToRenderer('portfwd:error', { sessionId, localPort, error: err.message }))
    return { ok: true, localPort }
  }
  return { error: 'Only local forwarding supported currently' }
})

ipcMain.handle('portfwd:stop', (_e, { sessionId, localPort }) => {
  const key = `${sessionId}:${localPort}`
  const s = portForwardServers.get(key)
  if (s) { try { s.close() } catch {}; portForwardServers.delete(key) }
  return { ok: true }
})

ipcMain.handle('portfwd:list', () => {
  return [...portForwardServers.keys()].map(k => {
    const [sessionId, port] = k.split(':')
    return { sessionId, localPort: parseInt(port) }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// IPC: SFTP
// ─────────────────────────────────────────────────────────────────────────────
ipcMain.handle('sftp:list', async (_e, { sessionId, remotePath }) => {
  const t = terminals.get(sessionId)
  if (!t?.ssh) return { error: 'No active SSH connection' }
  return new Promise((resolve) => {
    t.ssh.sftp((err, sftp) => {
      if (err) return resolve({ error: err.message })
      sftp.readdir(remotePath || '/', (err2, list) => {
        if (err2) return resolve({ error: err2.message })
        resolve({
          ok: true,
          entries: list.map(e => ({
            name: e.filename, isDir: e.attrs.isDirectory(),
            size: e.attrs.size, modified: e.attrs.mtime * 1000, mode: e.attrs.mode,
          }))
        })
      })
    })
  })
})

ipcMain.handle('sftp:download', async (_e, { sessionId, remotePath }) => {
  const t = terminals.get(sessionId)
  if (!t?.ssh) return { error: 'No active SSH connection' }
  const savePath = dialog.showSaveDialogSync(mainWindow, { defaultPath: path.basename(remotePath) })
  if (!savePath) return { cancelled: true }
  return new Promise((resolve) => {
    t.ssh.sftp((err, sftp) => {
      if (err) return resolve({ error: err.message })
      sftp.fastGet(remotePath, savePath, err2 => err2 ? resolve({ error: err2.message }) : resolve({ ok: true, localPath: savePath }))
    })
  })
})

ipcMain.handle('sftp:upload', async (_e, { sessionId, remotePath }) => {
  const t = terminals.get(sessionId)
  if (!t?.ssh) return { error: 'No active SSH connection' }
  const filePaths = dialog.showOpenDialogSync(mainWindow, { properties: ['openFile'] })
  if (!filePaths?.length) return { cancelled: true }
  const localPath = filePaths[0]
  const dest = remotePath + '/' + path.basename(localPath)
  return new Promise((resolve) => {
    t.ssh.sftp((err, sftp) => {
      if (err) return resolve({ error: err.message })
      sftp.fastPut(localPath, dest, err2 => err2 ? resolve({ error: err2.message }) : resolve({ ok: true, remotePath: dest }))
    })
  })
})

ipcMain.handle('sftp:mkdir', async (_e, { sessionId, remotePath }) => {
  const t = terminals.get(sessionId)
  if (!t?.ssh) return { error: 'No active SSH connection' }
  return new Promise((resolve) => {
    t.ssh.sftp((err, sftp) => {
      if (err) return resolve({ error: err.message })
      sftp.mkdir(remotePath, err2 => err2 ? resolve({ error: err2.message }) : resolve({ ok: true }))
    })
  })
})

ipcMain.handle('sftp:delete', async (_e, { sessionId, remotePath, isDir }) => {
  const t = terminals.get(sessionId)
  if (!t?.ssh) return { error: 'No active SSH connection' }
  return new Promise((resolve) => {
    t.ssh.sftp((err, sftp) => {
      if (err) return resolve({ error: err.message })
      const fn = isDir ? sftp.rmdir.bind(sftp) : sftp.unlink.bind(sftp)
      fn(remotePath, err2 => err2 ? resolve({ error: err2.message }) : resolve({ ok: true }))
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// IPC: Session logging
// ─────────────────────────────────────────────────────────────────────────────
ipcMain.handle('log:start', (_e, { id, name }) => {
  const ts       = new Date().toISOString().replace(/[:.]/g, '-')
  const filename = `${name.replace(/[^a-zA-Z0-9-]/g, '_')}_${ts}.log`
  const logPath  = path.join(logDir, filename)
  const stream   = fs.createWriteStream(logPath, { flags: 'a', encoding: 'utf8' })
  stream.write(`=== Helix Session Log: ${name} ===\n=== Started: ${new Date().toISOString()} ===\n\n`)
  logStreams.set(id, stream)
  return { ok: true, logPath }
})
ipcMain.handle('log:write',    (_e, { id, data })  => { logStreams.get(id)?.write(data) })
ipcMain.handle('log:stop',     (_e, { id })         => {
  const s = logStreams.get(id)
  if (s) { s.write(`\n=== Session Ended: ${new Date().toISOString()} ===\n`); s.end() }
  logStreams.delete(id)
})
ipcMain.handle('log:open-dir', () => shell.openPath(logDir))
ipcMain.handle('log:list', () => {
  try {
    return fs.readdirSync(logDir).map(f => {
      const fp = path.join(logDir, f)
      const stat = fs.statSync(fp)
      return { name: f, path: fp, size: stat.size, mtime: stat.mtime.getTime() }
    }).sort((a, b) => b.mtime - a.mtime)
  } catch { return [] }
})

// ─────────────────────────────────────────────────────────────────────────────
// IPC: Macro execution
// ─────────────────────────────────────────────────────────────────────────────
ipcMain.handle('macro:run', async (_e, { terminalId, commands }) => {
  // commands: [{ cmd: string, delay: number }]
  for (const { cmd, delay } of commands) {
    const t = terminals.get(terminalId)
    if (!t) break
    try {
      if (t.type === 'local'  && t.pty)    t.pty.write(cmd + '\n')
      if (t.type === 'ssh'    && t.stream) t.stream.write(cmd + '\n')
      if (t.type === 'telnet' && t.telnet) t.telnet.write(cmd + '\n')
    } catch {}
    if (delay > 0) await new Promise(r => setTimeout(r, delay))
  }
  return { ok: true }
})

// ─────────────────────────────────────────────────────────────────────────────
// IPC: AI proxy (streaming)
// ─────────────────────────────────────────────────────────────────────────────
ipcMain.handle('ai:chat', async (event, { provider, apiKey, model, messages, baseUrl }) => {
  try {
    let url = '', headers = { 'Content-Type': 'application/json' }, body = {}

    if (provider === 'openai') {
      url = 'https://api.openai.com/v1/chat/completions'
      headers['Authorization'] = `Bearer ${apiKey}`
      body = { model: model || 'gpt-4o-mini', messages, stream: true, max_tokens: 4096 }
    } else if (provider === 'anthropic') {
      url = 'https://api.anthropic.com/v1/messages'
      headers['x-api-key'] = apiKey
      headers['anthropic-version'] = '2023-06-01'
      const sys = messages.find(m => m.role === 'system')
      body = {
        model: model || 'claude-3-5-haiku-20241022', max_tokens: 4096, stream: true,
        system: sys?.content || 'You are a helpful network engineering AI assistant.',
        messages: messages.filter(m => m.role !== 'system'),
      }
    } else if (provider === 'google') {
      const mdl = model || 'gemini-1.5-flash'
      url = `https://generativelanguage.googleapis.com/v1beta/models/${mdl}:generateContent?key=${apiKey}`
      const contents = messages
        .filter(m => m.role !== 'system')
        .map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }))
      const sysMsg = messages.find(m => m.role === 'system')
      body = { contents, ...(sysMsg ? { systemInstruction: { parts: [{ text: sysMsg.content }] } } : {}) }
      const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
      if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`)
      const data = await res.json()
      return { content: data.candidates?.[0]?.content?.parts?.[0]?.text || '' }
    } else if (provider === 'ollama') {
      url = `${baseUrl || 'http://localhost:11434'}/api/chat`
      body = { model: model || 'llama3', messages, stream: true }
    }

    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
    if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`)

    const win = BrowserWindow.fromWebContents(event.sender)
    const streamId = `ai-${Date.now()}`
    let fullContent = ''

    const reader = res.body.getReader()
    const decoder = new TextDecoder()

    const pump = async () => {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        for (const line of chunk.split('\n')) {
          if (!line.trim() || line === 'data: [DONE]') continue
          const raw = line.startsWith('data: ') ? line.slice(6) : line
          try {
            const json = JSON.parse(raw)
            let delta = ''
            if (provider === 'openai')    delta = json.choices?.[0]?.delta?.content || ''
            if (provider === 'anthropic' && json.type === 'content_block_delta') delta = json.delta?.text || ''
            if (provider === 'ollama')    delta = json.message?.content || ''
            if (delta) { fullContent += delta; win?.webContents.send('ai:stream-chunk', { streamId, delta }) }
          } catch {}
        }
      }
      win?.webContents.send('ai:stream-done', { streamId, content: fullContent })
    }

    pump().catch(err => win?.webContents.send('ai:stream-done', { streamId, content: fullContent, error: err.message }))
    return { streamId }
  } catch (e) { return { error: e.message } }
})

// ─────────────────────────────────────────────────────────────────────────────
// IPC: AI Agent (Tool Calling, Non-streaming)
// ─────────────────────────────────────────────────────────────────────────────
ipcMain.handle('ai:agent-chat', async (event, { provider, apiKey, model, messages, tools, baseUrl }) => {
  try {
    let url = '', headers = { 'Content-Type': 'application/json' }, body = {}

    if (provider === 'openai') {
      url = 'https://api.openai.com/v1/chat/completions'
      headers['Authorization'] = `Bearer ${apiKey}`
      body = { model: model || 'gpt-4o', messages, max_tokens: 4096, tools }
    } else if (provider === 'anthropic') {
      url = 'https://api.anthropic.com/v1/messages'
      headers['x-api-key'] = apiKey
      headers['anthropic-version'] = '2023-06-01'
      const sys = messages.find(m => m.role === 'system')
      body = {
        model: model || 'claude-3-5-sonnet-20241022', max_tokens: 4096,
        system: sys?.content || 'You are an agentic network engineering AI.',
        messages: messages.filter(m => m.role !== 'system').map(m => {
          if (m.role === 'tool') {
            return { role: 'user', content: [{ type: 'tool_result', tool_use_id: m.tool_call_id, content: m.content }] }
          }
          if (m.tool_calls) {
            return { role: 'assistant', content: m.tool_calls.map(tc => ({ type: 'tool_use', id: tc.id, name: tc.function.name, input: JSON.parse(tc.function.arguments) })) }
          }
          return { role: m.role, content: m.content }
        }),
        tools: tools.map(t => ({
          name: t.function.name,
          description: t.function.description,
          input_schema: t.function.parameters
        }))
      }
    } else if (provider === 'google') {
      const mdl = model || 'gemini-1.5-pro'
      url = `https://generativelanguage.googleapis.com/v1beta/models/${mdl}:generateContent?key=${apiKey}`
      const sysMsg = messages.find(m => m.role === 'system')
      body = {
        contents: messages
          .filter(m => m.role !== 'system')
          .map(m => {
            if (m.role === 'tool') {
              return { role: 'function', parts: [{ functionResponse: { name: m.name, response: { result: m.content } } }] }
            }
            if (m.tool_calls) {
              return { role: 'model', parts: m.tool_calls.map(tc => ({ functionCall: { name: tc.function.name, args: JSON.parse(tc.function.arguments) } })) }
            }
            return { role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }
          }),
        ...(sysMsg ? { systemInstruction: { parts: [{ text: sysMsg.content }] } } : {}),
        tools: [{
          functionDeclarations: tools.map(t => ({
            name: t.function.name,
            description: t.function.description,
            parameters: t.function.parameters
          }))
        }]
      }
    } else {
      throw new Error(`Provider ${provider} does not support tool calling in this version.`)
    }

    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
    const data = await res.json()
    if (!res.ok) throw new Error(`API ${res.status}: ${JSON.stringify(data)}`)

    // Normalize response to OpenAI format { message: { role: 'assistant', content: string, tool_calls: [...] } }
    if (provider === 'openai') {
      return { message: data.choices[0].message }
    } else if (provider === 'anthropic') {
      const msg = { role: 'assistant', content: '', tool_calls: [] }
      for (const block of data.content) {
        if (block.type === 'text') msg.content += block.text
        if (block.type === 'tool_use') {
          msg.tool_calls.push({
            id: block.id,
            type: 'function',
            function: { name: block.name, arguments: JSON.stringify(block.input) }
          })
        }
      }
      return { message: msg }
    } else if (provider === 'google') {
      const part = data.candidates?.[0]?.content?.parts?.[0]
      const msg = { role: 'assistant', content: '', tool_calls: [] }
      if (part?.text) msg.content = part.text
      if (data.candidates?.[0]?.content?.parts) {
        for (const p of data.candidates[0].content.parts) {
          if (p.functionCall) {
            msg.tool_calls.push({
              id: `call_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
              type: 'function',
              function: { name: p.functionCall.name, arguments: JSON.stringify(p.functionCall.args) }
            })
          }
        }
      }
      return { message: msg }
    }
  } catch (e) {
    return { error: e.message }
  }
})


// ─────────────────────────────────────────────────────────────────────────────
// IPC: File dialogs
// ─────────────────────────────────────────────────────────────────────────────
ipcMain.handle('dialog:open-file', async (_e, opts = {}) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: opts.title || 'Select File',
    properties: ['openFile'],
    filters: opts.filters || [{ name: 'All Files', extensions: ['*'] }],
  })
  return result.cancelled ? null : result.filePaths[0]
})

ipcMain.handle('dialog:save-file', async (_e, opts = {}) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: opts.title || 'Save File',
    defaultPath: opts.defaultPath,
    filters: opts.filters || [{ name: 'All Files', extensions: ['*'] }],
  })
  return result.cancelled ? null : result.filePath
})

// ─────────────────────────────────────────────────────────────────────────────
// IPC: Session import/export
// ─────────────────────────────────────────────────────────────────────────────
ipcMain.handle('sessions:export', async (_e, { sessions }) => {
  const savePath = await dialog.showSaveDialog(mainWindow, {
    title: 'Export Sessions',
    defaultPath: `helix-sessions-${Date.now()}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  })
  if (savePath.cancelled) return { cancelled: true }
  fs.writeFileSync(savePath.filePath, JSON.stringify({ version: 1, sessions }, null, 2), 'utf8')
  return { ok: true, path: savePath.filePath }
})

ipcMain.handle('sessions:import', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Import Sessions',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile'],
  })
  if (result.cancelled) return { cancelled: true }
  try {
    const data = JSON.parse(fs.readFileSync(result.filePaths[0], 'utf8'))
    return { ok: true, sessions: data.sessions || [] }
  } catch (e) { return { error: e.message } }
})

ipcMain.handle('sessions:importSecureCRT', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select SecureCRT Sessions Folder',
    properties: ['openDirectory'],
  })
  if (result.canceled || !result.filePaths.length) return { cancelled: true }

  const baseDir = result.filePaths[0]
  
  function scanSecureCRTSessions(dir, rootDir) {
    let imported = []
    const files = fs.readdirSync(dir)
    for (const f of files) {
      const fullPath = path.join(dir, f)
      const stat = fs.statSync(fullPath)
      if (stat.isDirectory()) {
        imported = imported.concat(scanSecureCRTSessions(fullPath, rootDir))
      } else if (f.toLowerCase().endsWith('.ini') && f !== 'Default.ini' && f !== '__FolderData__.ini') {
        try {
          const content = fs.readFileSync(fullPath, 'utf8')
          const name = path.basename(f, '.ini')
          let groupPath = path.relative(rootDir, dir).replace(/\\/g, '/') || 'Default'

          const hostnameMatch = content.match(/S:"Hostname"=(.+)/)
          const usernameMatch = content.match(/S:"Username"=(.+)/)
          const portMatch = content.match(/D:"Port"=([0-9a-fA-F]+)/)
          const protoMatch = content.match(/S:"Protocol Name"=(.+)/)

          if (hostnameMatch) {
            let protocol = 'SSH'
            const rawProto = protoMatch ? protoMatch[1].toLowerCase() : ''
            if (rawProto.includes('telnet')) protocol = 'Telnet'
            if (rawProto.includes('serial')) protocol = 'Serial'

            imported.push({
              id: crypto.randomUUID(),
              name,
              host: hostnameMatch[1].trim(),
              username: usernameMatch ? usernameMatch[1].trim() : '',
              port: portMatch ? parseInt(portMatch[1], 16) : (protocol === 'Telnet' ? 23 : 22),
              protocol,
              group: groupPath,
              authMethod: 'password',
              env: 'none',
              verifyHost: true,
              keepaliveInterval: 30000
            })
          }
        } catch (e) {
          console.error(`Failed to parse ${fullPath}:`, e)
        }
      }
    }
    return imported
  }

  try {
    const sessions = scanSecureCRTSessions(baseDir, baseDir)
    return { ok: true, sessions }
  } catch (e) { return { error: e.message } }
})


// SSH host key trust reply from renderer
// (individual events registered per-connection in create-ssh above)
