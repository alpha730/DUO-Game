import { syncThemeColor, THEME_KEY } from "../config/applyBrand";
import { BRAND } from "../config/brand";

/** Me → Appearance. "system" follows the phone (prefers-color-scheme), live. */
export type ThemePref = "light" | "dark" | "system";

export function getThemePref(): ThemePref {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system"; // storage blocked (private mode…): follow the phone
  }
}

/** Applies at once (data-theme on <html> + browser-bar colour) and remembers it on this phone. */
export function setThemePref(pref: ThemePref): void {
  try {
    if (pref === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, pref);
  } catch {
    // not saved, but still applied for this visit
  }
  if (pref === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", pref);
  syncThemeColor(BRAND);
}
