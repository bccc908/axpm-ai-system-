export type MetaConfig = {
  configured: boolean;
  pageId: string;
  instagramId: string;
};

export function getMetaConfig(): MetaConfig {
  const pageId = process.env.META_PAGE_ID?.trim() ?? "";
  const token = process.env.META_PAGE_ACCESS_TOKEN?.trim() ?? "";
  const instagramId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID?.trim() ?? "";
  return {
    configured: Boolean(pageId && token),
    pageId,
    instagramId,
  };
}

export async function publishToFacebook(params: {
  message: string;
  link?: string | null;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { pageId } = getMetaConfig();
  const token = process.env.META_PAGE_ACCESS_TOKEN?.trim();
  if (!pageId || !token) {
    return { ok: false, error: "META_PAGE_ID and META_PAGE_ACCESS_TOKEN not set" };
  }

  const body: Record<string, string> = { message: params.message, access_token: token };
  if (params.link) body.link = params.link;

  const res = await fetch(`https://graph.facebook.com/v21.0/${pageId}/feed`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as { id?: string; error?: { message: string } };
  if (!res.ok || !data.id) {
    return { ok: false, error: data.error?.message ?? `Facebook API error (${res.status})` };
  }
  return { ok: true, id: data.id };
}

export async function publishToInstagram(params: {
  caption: string;
  image_url: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { instagramId } = getMetaConfig();
  const token = process.env.META_PAGE_ACCESS_TOKEN?.trim();
  if (!instagramId || !token) {
    return {
      ok: false,
      error: "INSTAGRAM_BUSINESS_ACCOUNT_ID and META_PAGE_ACCESS_TOKEN not set",
    };
  }

  if (!params.image_url) {
    return { ok: false, error: "Instagram requires an image URL" };
  }

  const createRes = await fetch(
    `https://graph.facebook.com/v21.0/${instagramId}/media`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image_url: params.image_url,
        caption: params.caption,
        access_token: token,
      }),
    },
  );
  const createData = (await createRes.json()) as { id?: string; error?: { message: string } };
  if (!createRes.ok || !createData.id) {
    return { ok: false, error: createData.error?.message ?? "Failed to create Instagram media" };
  }

  const publishRes = await fetch(
    `https://graph.facebook.com/v21.0/${instagramId}/media_publish`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creation_id: createData.id,
        access_token: token,
      }),
    },
  );
  const publishData = (await publishRes.json()) as { id?: string; error?: { message: string } };
  if (!publishRes.ok || !publishData.id) {
    return { ok: false, error: publishData.error?.message ?? "Failed to publish Instagram media" };
  }

  return { ok: true, id: publishData.id };
}
