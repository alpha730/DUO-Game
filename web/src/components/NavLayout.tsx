import { NavLink, Outlet } from "react-router-dom";
import { DexIcon, HomeIcon, ScanIcon, TrophyIcon, UserIcon } from "./Icons";

const LEFT = [
  { to: "/home", label: "Home", Icon: HomeIcon },
  { to: "/dex", label: "Dex", Icon: DexIcon },
];
const RIGHT = [
  { to: "/leaderboard", label: "Ranks", Icon: TrophyIcon },
  { to: "/me", label: "Me", Icon: UserIcon },
];

/** Bottom bar: Home · Dex · [big raised Scan button] · Ranks (leaderboard) · Me (SPEC §7). */
export default function NavLayout() {
  const tab = ({ to, label, Icon }: (typeof LEFT)[number]) => (
    <NavLink key={to} to={to}>
      <Icon />
      <span>{label}</span>
    </NavLink>
  );
  return (
    <>
      <Outlet />
      <nav className="bottom-nav" aria-label="Main">
        <div className="bottom-nav-inner">
          {LEFT.map(tab)}
          <NavLink to="/scan" className="scan-fab">
            <span className="scan-fab-circle">
              <ScanIcon size={30} />
            </span>
            <span>Scan</span>
          </NavLink>
          {RIGHT.map(tab)}
        </div>
      </nav>
    </>
  );
}
