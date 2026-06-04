import crypto from "crypto";

let cachedToken: { token: string; expiresAt: number } | null = null;

export function getXhsConfig() {
  const appKey = process.env.XHS_APP_KEY?.trim() ?? "";
  const appSecret = process.env.XHS_APP_SECRET?.trim() ?? "";
  const accessToken = process.env.XHS_ACCESS_TOKEN?.trim() ?? "";
  return {
    configured: Boolean((appKey && appSecret) || accessToken),
    appKey,
    hasSecret: Boolean(appSecret),
    hasStaticToken: Boolean(accessToken),
    openPlatformUrl: "https://open.xiaohongshu.com",
    creatorUrl: "https://creator.xiaohongshu.com",
  };
}

/** Format content for 小红书 creator (hashtags: #名称[话题]#) */
export function formatXhsPost(params: {
  title: string;
  content: string;
  tags?: string[];
}) {
  const title = params.title.trim().slice(0, 20);
  let body = params.content.trim();
  const tags = params.tags?.length
    ? params.tags
    : extractHashtags(body);

  for (const tag of tags) {
    const clean = tag.replace(/^#|#$/g, "").replace(/\[话题\]/g, "");
    const marker = `#${clean}[话题]#`;
    if (!body.includes(marker)) {
      body = body ? `${body}\n\n${marker}` : marker;
    }
  }

  return { title, content: body, tags };
}

function extractHashtags(text: string) {
  const matches = text.match(/#([^#\[\]\n]+)(?:\[话题\])?#?/g) ?? [];
  return matches.map((m) => m.replace(/^#|#$/g, "").replace(/\[话题\]/g, ""));
}

async function getAccessToken(): Promise<
  { ok: true; token: string } | { ok: false; error: string }
> {
  const staticToken = process.env.XHS_ACCESS_TOKEN?.trim();
  if (staticToken) {
    return { ok: true, token: staticToken };
  }

  const appKey = process.env.XHS_APP_KEY?.trim();
  const appSecret = process.env.XHS_APP_SECRET?.trim();
  if (!appKey || !appSecret) {
    return {
      ok: false,
      error: "Set XHS_APP_KEY + XHS_APP_SECRET or XHS_ACCESS_TOKEN in .env.local",
    };
  }

  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return { ok: true, token: cachedToken.token };
  }

  try {
    const res = await fetch(
      "https://open.xiaohongshu.com/api/v1/oauth2/access_token",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          app_key: appKey,
          app_secret: appSecret,
          grant_type: "client_credentials",
        }),
      },
    );
    const data = (await res.json()) as {
      data?: { access_token?: string; expires_in?: number };
      access_token?: string;
      error?: string;
      msg?: string;
    };
    const token = data.data?.access_token ?? data.access_token;
    if (!token) {
      return {
        ok: false,
        error:
          data.msg ?? data.error ?? "XHS token failed — check App Key/Secret on open.xiaohongshu.com",
      };
    }
    cachedToken = {
      token,
      expiresAt: Date.now() + (data.data?.expires_in ?? 7200) * 1000 - 60_000,
    };
    return { ok: true, token };
  } catch {
    return { ok: false, error: "Cannot reach open.xiaohongshu.com" };
  }
}

/** JS SDK second signature (for mobile share flow) */
export function buildXhsJsSignature(params: {
  accessToken: string;
  appKey: string;
  nonce: string;
  timestamp: string;
}) {
  const payload = `appKey=${params.appKey}&nonce=${params.nonce}&timeStamp=${params.timestamp}`;
  return crypto
    .createHmac("sha256", params.accessToken)
    .update(payload)
    .digest("hex");
}

export async function publishToXiaohongshu(params: {
  title: string;
  content: string;
  image_url?: string | null;
}): Promise<
  | { ok: true; external_id?: string; mode: "api" | "manual" }
  | { ok: false; error: string; manual_copy?: string; creator_url: string }
> {
  const formatted = formatXhsPost({
    title: params.title,
    content: params.content,
  });
  const manualCopy = `${formatted.title}\n\n${formatted.content}`;
  const creatorUrl = getXhsConfig().creatorUrl;

  if (!params.image_url?.trim()) {
    return {
      ok: false,
      error: "小红书图文笔记需要至少 1 张图片 URL — 填写 image URL 或使用创作者中心手动发布",
      manual_copy: manualCopy,
      creator_url: creatorUrl,
    };
  }

  const tokenResult = await getAccessToken();
  if (!tokenResult.ok) {
    return {
      ok: false,
      error: `${tokenResult.error} — 可复制内容到创作者中心手动发布`,
      manual_copy: manualCopy,
      creator_url: creatorUrl,
    };
  }

  // Official note-publish API requires enterprise approval; attempt and fall back to manual.
  try {
    const res = await fetch(
      "https://open.xiaohongshu.com/api/v1/note/create",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${tokenResult.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: formatted.title,
          content: formatted.content,
          images: [params.image_url.trim()],
          type: "normal",
        }),
      },
    );
    const data = (await res.json()) as {
      data?: { note_id?: string; id?: string };
      note_id?: string;
      msg?: string;
      error?: string;
    };
    if (res.ok && (data.data?.note_id || data.note_id || data.data?.id)) {
      return {
        ok: true,
        external_id: data.data?.note_id ?? data.note_id ?? data.data?.id,
        mode: "api",
      };
    }
  } catch {
    // fall through to manual
  }

  return {
    ok: false,
    error:
      "API 发布需要小红书开放平台「笔记发布」权限 — 请先在 open.xiaohongshu.com 申请，或复制内容到创作者中心发布",
    manual_copy: manualCopy,
    creator_url: creatorUrl,
  };
}
