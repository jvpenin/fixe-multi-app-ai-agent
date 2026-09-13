export function Brand({ onClick }: { onClick: () => void }) {
  return (
    <button className="brand" onClick={onClick} aria-label="Land.ai home">
      <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
        <path d="M8 5h10v17h17v10H8V5Z" fill="currentColor" />
        <path d="m24 5 11 0 0 11-4-4-7 7-5-5 9-5Z" fill="currentColor" />
      </svg>
      <span>
        Land<span className="brand-dot">.</span>ai
      </span>
    </button>
  );
}
