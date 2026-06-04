import { publishToFacebook, publishToInstagram, getMetaConfig } from "@/lib/integrations/meta-social";
import { getWeChatOaConfig, publishToWeChatOa } from "@/lib/integrations/wechat-official";
import { getDouyinConfig, publishToDouyin } from "@/lib/integrations/douyin";
import { getXhsConfig, publishToXiaohongshu } from "@/lib/integrations/xiaohongshu";
import type { SocialIntegrationStatus, SocialPlatform, SocialPost } from "@/types/social";

export function getSocialIntegrationStatus(): SocialIntegrationStatus {
  const meta = getMetaConfig();
  const wechat = getWeChatOaConfig();
  const tiktok = Boolean(process.env.TIKTOK_ACCESS_TOKEN?.trim());
  const weibo = Boolean(process.env.WEIBO_ACCESS_TOKEN?.trim());
  const douyin = getDouyinConfig();
  const xhs = getXhsConfig();

  return {
    facebook: { configured: meta.configured, ready: meta.configured },
    instagram: {
      configured: meta.configured && Boolean(meta.instagramId),
      ready: meta.configured && Boolean(meta.instagramId),
    },
    tiktok: { configured: tiktok, ready: false },
    wechat_oa: { configured: wechat.configured, ready: wechat.configured },
    weibo: { configured: weibo, ready: false },
    douyin: { configured: douyin.configured, ready: douyin.configured },
    xiaohongshu: { configured: xhs.configured, ready: xhs.configured },
  };
}

export async function publishPostToPlatforms(post: SocialPost) {
  const results: SocialPost["publish_results"] = {};
  const caption = post.title ? `${post.title}\n\n${post.content}` : post.content;

  for (const platform of post.platforms) {
    if (platform === "facebook") {
      const result = await publishToFacebook({
        message: caption,
        link: post.image_url,
      });
      results.facebook = result.ok
        ? { ok: true, external_id: result.id }
        : { ok: false, error: result.error };
    }

    if (platform === "instagram") {
      if (!post.image_url) {
        results.instagram = { ok: false, error: "Image URL required for Instagram" };
      } else {
        const result = await publishToInstagram({
          caption,
          image_url: post.image_url,
        });
        results.instagram = result.ok
          ? { ok: true, external_id: result.id }
          : { ok: false, error: result.error };
      }
    }

    if (platform === "wechat_oa") {
      const result = await publishToWeChatOa({
        title: post.title || post.content.slice(0, 64),
        content: post.content,
      });
      results.wechat_oa = result.ok
        ? { ok: true, external_id: result.media_id }
        : { ok: false, error: result.error };
    }

    if (platform === "tiktok") {
      results.tiktok = {
        ok: false,
        error: "TikTok API not connected — set TIKTOK_ACCESS_TOKEN after developer approval",
      };
    }

    if (platform === "weibo") {
      results.weibo = {
        ok: false,
        error: "Weibo API not connected — set WEIBO_ACCESS_TOKEN",
      };
    }

    if (platform === "douyin") {
      const result = await publishToDouyin({
        title: post.title || post.content.slice(0, 55),
        content: post.content,
        image_url: post.image_url,
      });
      results.douyin = result.ok
        ? { ok: true, external_id: result.external_id }
        : { ok: false, error: result.error };
    }

    if (platform === "xiaohongshu") {
      const result = await publishToXiaohongshu({
        title: post.title || post.content.slice(0, 20),
        content: post.content,
        image_url: post.image_url,
      });
      results.xiaohongshu = result.ok
        ? { ok: true, external_id: result.external_id }
        : { ok: false, error: result.error };
    }
  }

  return results;
}

export function platformLabel(platform: SocialPlatform, locale: "en" | "zh") {
  const labels: Record<SocialPlatform, { en: string; zh: string }> = {
    facebook: { en: "Facebook", zh: "Facebook" },
    instagram: { en: "Instagram", zh: "Instagram" },
    tiktok: { en: "TikTok", zh: "TikTok" },
    wechat_oa: { en: "WeChat Official (公众号)", zh: "微信公众号" },
    weibo: { en: "Weibo (微博)", zh: "微博" },
    douyin: { en: "Douyin (抖音)", zh: "抖音" },
    xiaohongshu: { en: "Xiaohongshu (小红书)", zh: "小红书" },
  };
  return labels[platform][locale];
}
