export type FortuneSharePlatformId =
  | "wechat"
  | "whatsapp"
  | "facebook"
  | "instagram"
  | "telegram"
  | "line"
  | "x"
  | "copy_link"
  | "copy_text";

export type FortuneSharePayload = {
  url: string;
  viewUrl?: string | null;
  text: string;
  title: string;
};

export const FORTUNE_SHARE_PLATFORMS: {
  id: FortuneSharePlatformId;
  labelKey: string;
  emoji: string;
}[] = [
  { id: "wechat", labelKey: "fortune.sharePlatformWechat", emoji: "💬" },
  { id: "whatsapp", labelKey: "fortune.sharePlatformWhatsapp", emoji: "📱" },
  { id: "facebook", labelKey: "fortune.sharePlatformFacebook", emoji: "📘" },
  { id: "instagram", labelKey: "fortune.sharePlatformInstagram", emoji: "📸" },
  { id: "telegram", labelKey: "fortune.sharePlatformTelegram", emoji: "✈️" },
  { id: "line", labelKey: "fortune.sharePlatformLine", emoji: "💚" },
  { id: "x", labelKey: "fortune.sharePlatformX", emoji: "𝕏" },
  { id: "copy_link", labelKey: "fortune.shareGateCopyLink", emoji: "🔗" },
  { id: "copy_text", labelKey: "fortune.shareGateCopyBtn", emoji: "📋" },
];

function shareLink(share: FortuneSharePayload) {
  return share.viewUrl ?? share.url;
}

export function fortunePlatformShareAction(
  platform: FortuneSharePlatformId,
  share: FortuneSharePayload,
): { type: "open"; href: string } | { type: "copy"; text: string; openHref?: string } {
  const link = shareLink(share);

  switch (platform) {
    case "wechat":
    case "copy_text":
      return { type: "copy", text: share.text };
    case "instagram":
      return {
        type: "copy",
        text: share.text,
        openHref: "https://www.instagram.com/",
      };
    case "copy_link":
      return { type: "copy", text: link };
    case "whatsapp":
      return {
        type: "open",
        href: `https://wa.me/?text=${encodeURIComponent(share.text)}`,
      };
    case "facebook":
      return {
        type: "open",
        href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`,
      };
    case "telegram":
      return {
        type: "open",
        href: `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(share.title)}`,
      };
    case "line":
      return {
        type: "open",
        href: `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(link)}`,
      };
    case "x":
      return {
        type: "open",
        href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(share.text)}`,
      };
  }
}
