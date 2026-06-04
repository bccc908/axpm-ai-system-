export type SocialPlatform =
  | "facebook"
  | "instagram"
  | "tiktok"
  | "wechat_oa"
  | "weibo"
  | "douyin"
  | "xiaohongshu";

export type SocialPostStatus = "draft" | "scheduled" | "published" | "failed";

export type SocialPost = {
  id: string;
  title: string;
  content: string;
  image_url: string | null;
  platforms: SocialPlatform[];
  locale: "en" | "zh" | "both";
  status: SocialPostStatus;
  scheduled_at: string | null;
  published_at: string | null;
  publish_results: Partial<Record<SocialPlatform, { ok: boolean; error?: string; external_id?: string }>>;
  created_at: string;
  updated_at: string;
};

export type SocialData = {
  posts: SocialPost[];
};

export type SocialIntegrationStatus = {
  facebook: { configured: boolean; ready: boolean };
  instagram: { configured: boolean; ready: boolean };
  tiktok: { configured: boolean; ready: boolean };
  wechat_oa: { configured: boolean; ready: boolean };
  weibo: { configured: boolean; ready: boolean };
  douyin: { configured: boolean; ready: boolean };
  xiaohongshu: { configured: boolean; ready: boolean };
};
