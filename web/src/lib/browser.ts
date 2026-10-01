// Browser/platform sniffing for the camera help screens (SPEC §8).

export type Platform = "android" | "ios" | "other";

export function platform(ua = navigator.userAgent): Platform {
  if (/Android/i.test(ua)) return "android";
  if (/iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  return "other";
}

/**
 * In-app browsers (Instagram, Facebook, Snapchat, LinkedIn, TikTok, Line, X, Android WebViews…)
 * often block or break the camera. WhatsApp on Android opens Chrome Custom Tabs, which is fine.
 */
export function inAppBrowser(ua = navigator.userAgent): string | null {
  const known: Array<[RegExp, string]> = [
    [/Instagram/i, "Instagram"],
    [/FBAN|FBAV|FB_IAB|FBIOS/i, "Facebook"],
    [/Snapchat/i, "Snapchat"],
    [/LinkedInApp/i, "LinkedIn"],
    [/musical_ly|TikTok|BytedanceWebview/i, "TikTok"],
    [/\bLine\//i, "Line"],
    [/Twitter/i, "X"],
    [/WhatsApp/i, "WhatsApp"],
  ];
  for (const [re, name] of known) if (re.test(ua)) return name;
  if (/; wv\)/.test(ua)) return "this app"; // Android WebView
  if (platform(ua) === "ios" && !/Safari\//.test(ua)) return "this app"; // iOS WKWebView (Chrome/Safari say "Safari/")
  return null;
}

/** Android: an intent: link that reopens the current page in Chrome. */
export function openInChromeUrl(href = location.href): string {
  const url = new URL(href);
  return `intent://${url.host}${url.pathname}${url.search}#Intent;scheme=${url.protocol.replace(":", "")};package=com.android.chrome;end`;
}
