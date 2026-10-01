import { NavLink, Outlet } from "react-router-dom";

const TABS = [
  { to: "/home", label: "Home", icon: "🏠" },
  { to: "/scan", label: "Scan", icon: "📷" },
  { to: "/leaderboard", label: "Ranks", icon: "🏆" },
  { to: "/me", label: "Me", icon: "👤" },
];

/** Screens with the bottom nav: Home / Scan / Leaderboard / Me (SPEC §7). */
export default function NavLayout() {
  return (
    <>
      <Outlet />
      <nav className="bottom-nav" aria-label="Main">
        {TABS.map((t) => (
          <NavLink key={t.to} to={t.to}>
            <span className="icon" aria-hidden="true">
              {t.icon}
            </span>
            {t.label}
          </NavLink>
        ))}
      </nav>
    </>
  );
}
