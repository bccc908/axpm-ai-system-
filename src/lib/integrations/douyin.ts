let cachedToken: { token: string; expiresAt: number } | null = null;

export function getDouyinConfig() {
  const clientKey = process.env.DOUYIN_CLIENT_KEY?.trim() ?? "";
  const clientSecret = process.env.DOUYIN_CLIENT_SECRET?.trim() ?? "";
  const accessToken = process.env.DOUYIN_ACCESS_TOKEN?.trim() ?? "";
  const apiReady = Boolean(accessToken || (clientKey && clientSecret));
  return {
    /** Manual copy-to-publish is always available */
    configured: true,
    apiReady,
    clientKey,
    hasSecret: Boolean(clientSecret),
    hasStaticToken: Boolean(accessToken),
    openPlatformUrl: "https://developer.open-douyin.com",
    creatorUrl: "https://creator.douyin.com",
  };
}

/** Format caption for 抖音创作者中心 (#话题# style) */
export function formatDouyinPost(params: {
  title: string;
  content: string;
  tags?: string[];
}) {
  const title = params.title.trim().slice(0, 55);
  let body = params.content.trim();
  const tags = params.tags?.length ? params.tags : extractHashtags(body);

  for (const tag of tags) {
    const clean = tag.replace(/^#|#$/g, "");
    const marker = `#${clean}#`;
    if (!body.includes(marker)) {
      body = body ? `${body}\n\n${marker}` : marker;
    }
  }

  return { title, content: body, tags: tags.map((t) => `#${t.replace(/^#|#$/g, "")}#`) };
}

function extractHashtags(text: string) {
  const matches = text.match(/#([^#\n]+)#/g) ?? [];
  return matches.map((m) => m.replace(/^#|#$/g, ""));
}

async function getAccessToken(): Promise<
  { ok: true; token: string } | { ok: false; error: string }
> {
  const staticToken = process.env.DOUYIN_ACCESS_TOKEN?.trim();
  if (staticToken) {
    return { ok: true, token: staticToken };
  }

  const clientKey = process.env.DOUYIN_CLIENT_KEY?.trim();
  const clientSecret = process.env.DOUYIN_CLIENT_SECRET?.trim();
  if (!clientKey || !clientSecret) {
    return {
      ok: false,
      error: "Set DOUYIN_CLIENT_KEY + DOUYIN_CLIENT_SECRET or DOUYIN_ACCESS_TOKEN in .env.local",
    };
  }

  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return { ok: true, token: cachedToken.token };
  }

  try {
    const res = await fetch(
      "https://open.douyin.com/oauth/client_token/",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_key: clientKey,
          client_secret: clientSecret,
          grant_type: "client_credential",
        }),
      },
    );
    const data = (await res.json()) as {
      data?: { access_token?: string; expires_in?: number };
      message?: string;
      description?: string;
    };
    const token = data.data?.access_token;
    if (!token) {
      return {
        ok: false,
        error:
          data.description ?? data.message ?? "Douyin token failed — check keys on developer.open-douyin.com",
      };
    }
    cachedToken = {
      token,
      expiresAt: Date.now() + (data.data?.expires_in ?? 7200) * 1000 - 60_000,
    };
    return { ok: true, token };
  } catch {
    return { ok: false, error: "Cannot reach open.douyin.com" };
  }
}

export async function publishToDouyin(params: {
  title: string;
  content: string;
  image_url?: string | null;
}): Promise<
  | { ok: true; external_id?: string; mode: "api" | "manual" }
  | { ok: false; error: string; manual_copy?: string; creator_url: string }
> {
  const formatted = formatDouyinPost({
    title: params.title,
    content: params.content,
  });
  const manualCopy = `【标题】\n${formatted.title}\n\n【描述】\n${formatted.content}`;
  const creatorUrl = getDouyinConfig().creatorUrl;

  const tokenResult = await getAccessToken();
  if (!tokenResult.ok) {
    return {
      ok: false,
      error: `${tokenResult.error} — 可复制内容到创作者中心手动发布`,
      manual_copy: manualCopy,
      creator_url: creatorUrl,
    };
  }

  // Official video publish requires enterprise approval; attempt and fall back to manual.
  if (!params.image_url?.trim()) {
    return {
      ok: false,
      error: "抖音视频发布需要视频文件 — 请上传视频到创作者中心，或粘贴 AI 文案后手动发布",
      manual_copy: manualCopy,
      creator_url: creatorUrl,
    };
  }

  try {
    const res = await fetch(
      "https://open.douyin.com/api/douyin/v1/video/create_video/",
      {
        method: "POST",
        headers: {
          "access-token": tokenResult.token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: formatted.content,
          video_id: params.image_url.trim(),
        }),
      },
    );
    const data = (await res.json()) as {
      data?: { item_id?: string; video_id?: string };
      extra?: { sub_description?: string; description?: string };
    };
    if (res.ok && (data.data?.item_id || data.data?.video_id)) {
      return {
        ok: true,
        external_id: data.data?.item_id ?? data.data?.video_id,
        mode: "api",
      };
    }
  } catch {
    // fall through to manual
  }

  return {
    ok: false,
    error:
      "API 发布需要抖音开放平台「代替用户发布内容」权限 — 请先在 developer.open-douyin.com 申请，或复制内容到创作者中心发布",
    manual_copy: manualCopy,
    creator_url: creatorUrl,
  };
}
