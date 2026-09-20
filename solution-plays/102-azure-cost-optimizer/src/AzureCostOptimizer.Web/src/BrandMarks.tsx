// Two marks, deliberately different: the platform reads as a layered stack, the agent as spend
// falling away from a coin. Neither reproduces a Microsoft or Azure trademark.
export function AciMark({ size = 26 }: { size?: number }) {
  return (
    <svg className="aci-mark" width={size} height={size} viewBox="0 0 24 24" role="img" aria-label="Azure Cost Intelligence" focusable="false">
      <defs>
        <linearGradient id="aci-deep" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0078d4" />
          <stop offset="1" stopColor="#243a5e" />
        </linearGradient>
        <linearGradient id="aci-bright" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#50e6ff" />
          <stop offset="1" stopColor="#0078d4" />
        </linearGradient>
      </defs>
      <rect x="3" y="15.6" width="18" height="4.4" rx="1.4" fill="url(#aci-deep)" />
      <rect x="5.4" y="9.8" width="13.2" height="4.4" rx="1.4" fill="url(#aci-bright)" opacity=".92" />
      <rect x="7.8" y="4" width="8.4" height="4.4" rx="1.4" fill="#3cd2b5" />
    </svg>
  )
}

export function AcoMark({ size = 22 }: { size?: number }) {
  return (
    <svg className="aco-mark" width={size} height={size} viewBox="0 0 24 24" role="img" aria-label="Azure Cost Optimizer" focusable="false">
      <defs>
        <linearGradient id="aco-sweep" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0078d4" />
          <stop offset="1" stopColor="#3cd2b5" />
        </linearGradient>
      </defs>
      {/* Spend falling: a coin at the start, the trend dropping away to the right. Every stroke is
          brand coloured so the mark survives both themes without a pale track. */}
      <circle cx="4.2" cy="6.4" r="2.5" fill="#0078d4" />
      <circle cx="4.2" cy="6.4" r=".95" fill="#fff" />
      <path d="M6.9 8.5 11.6 13.2 14.6 10.2 20.4 16" fill="none" stroke="url(#aco-sweep)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20.4 11.6V16h-4.4" fill="none" stroke="#3cd2b5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
