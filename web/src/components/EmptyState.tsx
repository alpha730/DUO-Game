import type { ReactNode } from "react";
import type { Mood } from "./Critter";
import Mascot from "./Mascot";

/** Friendly full-card state with the mascot (offline, off campus, camera blocked, in-app browser…). */
export default function EmptyState({
  mood = "sad",
  badge,
  title,
  children,
  actions,
  className = "",
  ...rest
}: {
  mood?: Mood;
  badge?: string;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
} & Record<`data-${string}`, string | boolean | undefined> & { role?: string }) {
  return (
    <section className={`card empty-state ${className}`} {...rest}>
      <Mascot slot="oops" mood={mood} badge={badge} />
      <h2>{title}</h2>
      {children}
      {actions && <div className="stack">{actions}</div>}
    </section>
  );
}
