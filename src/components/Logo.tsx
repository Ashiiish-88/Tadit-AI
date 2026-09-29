export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <circle cx="16" cy="16" r="13" fill="none" stroke="#38D0F0" strokeWidth="1.3" opacity="0.35" />
      <circle cx="16" cy="16" r="8.5" fill="none" stroke="#38D0F0" strokeWidth="1.3" opacity="0.7" />
      <path d="M16 16 L27.5 9.5" stroke="#38D0F0" strokeWidth="1.3" opacity="0.8" />
      <path d="M17.6 5.5 11 17.2h4.6L14 26.5l7-12.2h-4.7z" fill="#FFC53D" />
    </svg>
  )
}

export function Wordmark() {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark />
      <span className="text-[17px] font-semibold tracking-[0.14em]">TADIT</span>
    </div>
  )
}
