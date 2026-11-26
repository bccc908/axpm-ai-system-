export type PlatformHint = "macSafari" | "macChrome" | "ios" | "android" | "generic";

export const INSTALL_DISMISS_KEY = "kc-install-dismissed-at";
export const INSTALL_DISMISS_DAYS = 14;

export function detectPlatformHint(ua: string): PlatformHint {
  const isIOS = /iPhone|iPad|iPod/.test(ua);
  const isAndroid = /Android/.test(ua);
  const isMac = /Macintosh|Mac OS X/.test(ua) && !isIOS;
  const isSafari = /Safari/.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|Edg/.test(ua);
  if (isIOS) return "ios";
  if (isAndroid) return "android";
  if (isMac && isSafari) return "macSafari";
  if (isMac) return "macChrome";
  return "generic";
}

export function hintKeyFor(platform: PlatformHint): string {
  switch (platform) {
    case "macSafari":
      return "app.installMacSafariHint";
    case "macChrome":
      return "app.installMacChromeHint";
    case "ios":
      return "app.installIosHint";
    case "android":
      return "app.installAndroidHint";
    default:
      return "app.installGenericHint";
  }
}

/** True while a "Not now" from the last 14 days is still in effect. */
export function isDismissed(storedAt: string | null, now: number = Date.now()): boolean {
  if (!storedAt) return false;
  const at = Number(storedAt);
  if (!Number.isFinite(at)) return false;
  return now - at < INSTALL_DISMISS_DAYS * 86_400_000;
}
