/** Field Shift mark: three crop rows, the middle one shifted. */
export function Logo({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="3" y="4" width="18" height="4" rx="1" fill="currentColor" />
      <rect x="7" y="10" width="14" height="4" rx="1" fill="var(--nasa-bright)" />
      <rect x="3" y="16" width="18" height="4" rx="1" fill="currentColor" />
    </svg>
  )
}
