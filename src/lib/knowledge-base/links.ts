import type { KnowledgeLinkKind } from "@/lib/knowledge-base/types";

const DRIVE_ID = /^[a-zA-Z0-9_-]{10,}$/;

export type ParsedSourceLink = {
  kind: KnowledgeLinkKind;
  url: string;
  label: string;
  fileId: string | null;
  folderId: string | null;
  vault: string | null;
  notePath: string | null;
};

export function parseDriveFolderId(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  try {
    if (text.startsWith("https://")) {
      const url = new URL(text);
      if (url.username || url.password) return null;
      const match = url.pathname.match(/\/folders\/([a-zA-Z0-9_-]+)/);
      if (match?.[1] && DRIVE_ID.test(match[1])) return match[1];
      return null;
    }
  } catch {
    return null;
  }
  return DRIVE_ID.test(text) ? text : null;
}

export function safeNotePath(input: string): string | null {
  const parts = input
    .replace(/\\/g, "/")
    .split("/")
    .map((part) => part.trim())
    .filter((part) => part && part !== "." && part !== "..");
  if (parts.length === 0) return null;
  const joined = parts.join("/");
  if (joined.length > 300) return null;
  if (/[\u0000-\u001f]/.test(joined)) return null;
  return joined;
}

function decodePart(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parseDriveLink(text: string): ParsedSourceLink | null {
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password) return null;
  const host = url.hostname.toLowerCase();
  if (host !== "drive.google.com" && host !== "docs.google.com") return null;

  const folder = url.pathname.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folder?.[1] && DRIVE_ID.test(folder[1])) {
    return {
      kind: "google_drive",
      url: url.toString(),
      label: "Google Drive folder",
      fileId: null,
      folderId: folder[1],
      vault: null,
      notePath: null,
    };
  }

  const pathId = url.pathname.match(/\/d\/([a-zA-Z0-9_-]+)/);
  const queryId = url.searchParams.get("id");
  const fileId = pathId?.[1] && DRIVE_ID.test(pathId[1]) ? pathId[1] : queryId && DRIVE_ID.test(queryId) ? queryId : null;
  if (!fileId) return null;
  const doc = host === "docs.google.com" || url.pathname.includes("/document/");
  return {
    kind: "google_drive",
    url: url.toString(),
    label: doc ? "Google Drive document" : "Google Drive file",
    fileId,
    folderId: null,
    vault: null,
    notePath: null,
  };
}

function parseObsidianLink(text: string, vaultName?: string): ParsedSourceLink | null {
  if (/^obsidian:/i.test(text)) {
    let url: URL;
    try {
      url = new URL(text);
    } catch {
      return null;
    }
    const vault = url.searchParams.get("vault");
    const file = url.searchParams.get("file") || url.searchParams.get("filepath");
    const notePath = file ? safeNotePath(decodePart(file)) : null;
    const label = notePath?.split("/").pop() || "Obsidian note";
    return {
      kind: "obsidian",
      url: url.toString(),
      label,
      fileId: null,
      folderId: null,
      vault,
      notePath,
    };
  }

  if (/^https:\/\//i.test(text)) {
    let url: URL;
    try {
      url = new URL(text);
    } catch {
      return null;
    }
    if (url.username || url.password) return null;
    if (!url.hostname.toLowerCase().includes("obsidian")) return null;
    const last = decodePart(url.pathname.split("/").filter(Boolean).pop() || "Obsidian");
    return {
      kind: "obsidian",
      url: url.toString(),
      label: last,
      fileId: null,
      folderId: null,
      vault: null,
      notePath: null,
    };
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(text)) return null;
  const notePath = safeNotePath(text);
  if (!notePath) return null;
  const vault = vaultName?.trim() || "";
  const url = vault
    ? `obsidian://open?vault=${encodeURIComponent(vault)}&file=${encodeURIComponent(notePath)}`
    : `obsidian-note:${notePath}`;
  return {
    kind: "obsidian",
    url,
    label: notePath.split("/").pop() || notePath,
    fileId: null,
    folderId: null,
    vault: vault || null,
    notePath,
  };
}

export function parseStaffSourceLink(
  raw: string,
  hint?: KnowledgeLinkKind,
  options?: { vaultName?: string },
): { ok: true; link: ParsedSourceLink } | { ok: false } {
  const text = raw.trim();
  if (!text || text.length > 2000) return { ok: false };
  if (hint !== "obsidian") {
    const drive = parseDriveLink(text);
    if (drive) return { ok: true, link: drive };
    if (hint === "google_drive") return { ok: false };
  }
  const obsidian = parseObsidianLink(text, options?.vaultName);
  if (!obsidian) return { ok: false };
  return { ok: true, link: obsidian };
}

export function externalKeyForLink(link: ParsedSourceLink): string {
  if (link.kind === "google_drive") {
    return `drive-link:${link.fileId || link.folderId || link.url}`.slice(0, 500);
  }
  return `obsidian-link:${link.notePath || link.url}`.slice(0, 500);
}

export function linkIsOpenable(url: string): boolean {
  return url.startsWith("https://") || url.startsWith("obsidian://");
}
