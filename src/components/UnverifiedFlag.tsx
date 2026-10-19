export function UnverifiedFlag({ count = 1 }: { count?: number }) {
  if (count <= 0) return null;
  const label = `${count} unverified assumption${count === 1 ? "" : "s"} feed this number`;
  return (
    <span className="inline-flex items-center text-[#a15c00]" title={label} aria-label={label} role="img">
      <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
        <path d="M8 1.5 15 14H1z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <path d="M8 6v3.5M8 11.2v.3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </span>
  );
}
