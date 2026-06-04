let cachedToken: { token: string; expiresAt: number } | null = null;

export function getWeChatOaConfig() {
  const appId = process.env.WECHAT_OA_APP_ID?.trim() ?? "";
  const secret = process.env.WECHAT_OA_APP_SECRET?.trim() ?? "";
  return {
    configured: Boolean(appId && secret),
    appId,
  };
}

async function getAccessToken(): Promise<{ ok: true; token: string } | { ok: false; error: string }> {
  const { appId } = getWeChatOaConfig();
  const secret = process.env.WECHAT_OA_APP_SECRET?.trim();
  if (!appId || !secret) {
    return { ok: false, error: "WECHAT_OA_APP_ID and WECHAT_OA_APP_SECRET not set" };
  }

  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return { ok: true, token: cachedToken.token };
  }

  const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${appId}&secret=${secret}`;
  const res = await fetch(url, { cache: "no-store" });
  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
    errcode?: number;
    errmsg?: string;
  };

  if (!data.access_token) {
    return { ok: false, error: data.errmsg ?? "Failed to get WeChat OA token" };
  }

  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 7200) * 1000 - 60_000,
  };
  return { ok: true, token: data.access_token };
}

/** Publish a draft article to WeChat Official Account (公众号图文). */
export async function publishToWeChatOa(params: {
  title: string;
  content: string;
  thumb_media_id?: string;
}): Promise<{ ok: true; media_id: string } | { ok: false; error: string }> {
  const tokenResult = await getAccessToken();
  if (!tokenResult.ok) return tokenResult;

  const token = tokenResult.token;
  const htmlContent = params.content
    .split("\n")
    .map((line) => `<p>${line.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`)
    .join("");

  const draftRes = await fetch(
    `https://api.weixin.qq.com/cgi-bin/draft/add?access_token=${token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        articles: [
          {
            title: params.title.slice(0, 64),
            author: "AXPM",
            digest: params.content.slice(0, 120),
            content: htmlContent,
            thumb_media_id: params.thumb_media_id ?? "",
            need_open_comment: 0,
            only_fans_can_comment: 0,
          },
        ],
      }),
    },
  );

  const draftData = (await draftRes.json()) as {
    media_id?: string;
    errcode?: number;
    errmsg?: string;
  };

  if (!draftData.media_id) {
    const hint =
      draftData.errcode === 40007
        ? " — upload a cover image first (thumb_media_id required for 公众号)"
        : "";
    return { ok: false, error: (draftData.errmsg ?? "Failed to create WeChat draft") + hint };
  }

  const publishRes = await fetch(
    `https://api.weixin.qq.com/cgi-bin/freepublish/submit?access_token=${token}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ media_id: draftData.media_id }),
    },
  );

  const publishData = (await publishRes.json()) as {
    publish_id?: string;
    errcode?: number;
    errmsg?: string;
  };

  if (publishData.errcode && publishData.errcode !== 0) {
    return {
      ok: false,
      error: publishData.errmsg ?? "Draft saved but publish failed — check 公众号 permissions",
    };
  }

  return { ok: true, media_id: draftData.media_id };
}
