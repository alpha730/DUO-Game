/** "Lingos left today" as 4 pips (filled = still available). */
export default function LingoPips({ left, total, className = "" }: { left: number; total: number; className?: string }) {
  return (
    <p className={`attempts-pill ${className}`} data-left={left}>
      <span className="pips-label">Lingos left today: </span>
      <span className="pips" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <i key={i} data-on={i < left} />
        ))}
      </span>
      <strong>
        {left}/{total}
      </strong>
    </p>
  );
}
