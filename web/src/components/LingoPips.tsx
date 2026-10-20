/** "Lingos left today" as 4 pips (filled = still available). */
export default function LingoPips({
  left,
  total,
  className = "",
  when = "today",
}: {
  left: number;
  total: number;
  className?: string;
  /** "today" | "this round" */
  when?: string;
}) {
  return (
    <p className={`attempts-pill ${className}`} data-left={left}>
      <span className="pips-label">Lingos left {when}: </span>
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
