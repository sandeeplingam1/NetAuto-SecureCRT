interface LogoProps {
  size?: number
}

export default function Logo({ size = 18 }: LogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="44" height="44" rx="12" fill="url(#helix-bg)"/>
      <path d="M10 12 Q22 19 34 12" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
      <path d="M10 22 Q22 29 34 22" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.75"/>
      <path d="M10 32 Q22 39 34 32" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.45"/>
      <defs>
        <linearGradient id="helix-bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#2563eb"/>
          <stop offset="100%" stopColor="#7c3aed"/>
        </linearGradient>
      </defs>
    </svg>
  )
}
