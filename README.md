# Helix

Helix is a modern, AI-powered desktop network terminal designed specifically for Network Engineers. It is a state-of-the-art alternative to legacy applications like SecureCRT or PuTTY, combining professional terminal capabilities with a sleek, modern interface and integrated AI assistance.

## Features

- **Multi-Protocol Support:** Connect via SSH, Telnet, or direct Serial (Console) cables.
- **Advanced Layouts:** Support for multi-tab sessions and horizontal/vertical split views to monitor multiple devices simultaneously.
- **Broadcast Mode:** Type a command once (e.g., `write mem`) and send it to all open terminal tabs simultaneously.
- **AI Integration:** Highlight complex log outputs (like BGP drops or OSPF errors) and instantly ask the built-in AI assistant to explain what went wrong.
- **Macros:** Create custom command sequences with automated delays to speed up repetitive configuration tasks.
- **Visual Pattern Highlighting:** Automatically colorize keywords (e.g., `ERROR`, `DOWN`, `UP`) based on customizable regex rules.
- **Port Forwarding:** Built-in SSH tunnel management for securely accessing internal web interfaces.
- **Local & Secure:** All session data and credentials are encrypted and stored locally on your machine. No cloud databases required.

## Installation

Helix runs entirely locally. You can download the latest installer from the **Actions** tab in this repository.

### For Mac (Apple Silicon)
1. Download the `Helix-v1.0-Mac.dmg` release.
2. Double-click the DMG and drag Helix into your Applications folder.
3. *Note: As this is an unsigned application, you may need to Right-Click -> Open the app the first time to bypass the macOS "Unidentified Developer" warning.*

### For Windows
1. Go to the **Actions** tab in GitHub.
2. Click the latest successful run of the **"Build Windows App"** workflow.
3. Scroll down to the **Artifacts** section and download the `Helix-Windows-Installer.exe`.

## Development

Helix is built with **Electron**, **React**, **TypeScript**, and **Vite**.

To run the app in developer mode (with hot-reloading):

```bash
# Install dependencies
npm install

# Start the development server
npm run dev
```

To build a production release manually on your own machine:

```bash
npm run build
```

## License
MIT License
