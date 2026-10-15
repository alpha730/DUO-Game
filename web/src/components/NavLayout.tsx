import { NavLink, Outlet } from "react-router-dom";
import { BRAND, type UiIconName } from "../config/brand";
import { DexIcon, HomeIcon, ScanIcon, TrophyIcon, UserIcon } from "./Icons";

const LEFT = [
  { to: "/home", label: "Home", Icon: HomeIcon, kit: "overview" as UiIconName },
  { to: "/dex", label: "Dex", Icon: DexIcon, kit: "practice" as UiIconName },
];
const RIGHT = [
  { to: "/leaderboard", label: "Ranks", Icon: TrophyIcon, kit: "test" as UiIconName },
  { to: "/me", label: "Me", Icon: UserIcon, kit: "id" as UiIconName },
];

/** Bottom bar: Home · Dex · [big raised Scan button] · Ranks (leaderboard) · Me (SPEC §7). */
export default function NavLayout() {
  // DET UI icons (docs/DET-DESIGN.md §4) when supplied, else our line icons.
  const tab = ({ to, label, Icon, kit }: (typeof LEFT)[number]) => (
    <NavLink key={to} to={to}>
      {BRAND.uiIcons[kit] ? <img className="nav-kit-icon" src={BRAND.uiIcons[kit]!} alt="" aria-hidden="true" /> : <Icon />}
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
