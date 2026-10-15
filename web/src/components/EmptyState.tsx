import type { ReactNode } from "react";
import type { Mood } from "./Critter";
import type { HeroName } from "../config/brand";
import { HeroArt } from "./BrandArt";

/** Friendly full-card state with the mascot (offline, off campus, camera blocked, in-app browser…). */
export default function EmptyState({
  mood = "sad",
  badge,
  hero = "duoSeal",
  title,
  children,
  actions,
  className = "",
  ...rest
}: {
  mood?: Mood;
  badge?: string;
  /** DET hero illustration (when supplied; else the "oops" mascot with its badge). */
  hero?: HeroName;
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
} & Record<`data-${string}`, string | boolean | undefined> & { role?: string }) {
  return (
    <section className={`card empty-state ${className}`} {...rest}>
      <HeroArt name={hero} fallback="oops" mood={mood} badge={badge} className="empty-art" />
      <h2>{title}</h2>
      {children}
      {actions && <div className="stack">{actions}</div>}
    </section>
  );
}
