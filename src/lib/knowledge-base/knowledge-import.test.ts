import { mkdtemp, rm, readFile, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { attachmentPath, getKnowledgeFilesRoot } from "@/lib/knowledge-base/files";
import { externalKeyForLink, parseDriveFolderId, parseStaffSourceLink, safeNotePath } from "@/lib/knowledge-base/links";
import { inferKnowledgeSection } from "@/lib/knowledge-base/routing";
import { saveObsidianSettings } from "@/lib/knowledge-base/obsidian-settings";
import type { KnowledgeActor } from "@/lib/knowledge-base/types";

const tempDirs: string[] = [];
const owner: KnowledgeActor = { id: "owner-1", name: "Kayden Chiew", role: "owner" };
const viewer: KnowledgeActor = { id: "viewer-1", name: "Read Only", role: "viewer" };

beforeEach(async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "axpm-knowledge-import-"));
  tempDirs.push(dir);
  process.env.AXPM_KNOWLEDGE_BASE_FILE = path.join(dir, "knowledge-base.json");
  process.env.AXPM_KNOWLEDGE_FILES_DIR = path.join(dir, "files");
  process.env.AXPM_KNOWLEDGE_DRIVE_FILE = path.join(dir, "knowledge-drive.json");
  process.env.AXPM_KNOWLEDGE_OBSIDIAN_FILE = path.join(dir, "knowledge-obsidian.json");
  delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  delete process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
});

afterEach(async () => {
  delete process.env.AXPM_KNOWLEDGE_BASE_FILE;
  delete process.env.AXPM_KNOWLEDGE_FILES_DIR;
  delete process.env.AXPM_KNOWLEDGE_DRIVE_FILE;
  delete process.env.AXPM_KNOWLEDGE_OBSIDIAN_FILE;
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("knowledge source links and sections", () => {
  it("parses Drive links, Obsidian links, and note paths", () => {
    const drive = parseStaffSourceLink("https://drive.google.com/file/d/1AbCDefGhijkLmNoPqRst/view");
    expect(drive.ok && drive.link.kind).toBe("google_drive");
    expect(drive.ok && drive.link.fileId).toBe("1AbCDefGhijkLmNoPqRst");

    const folder = parseDriveFolderId("https://drive.google.com/drive/folders/1FolderId0000000001");
    expect(folder).toBe("1FolderId0000000001");

    const note = parseStaffSourceLink(
      "obsidian://open?vault=AXPM&file=Company%20Policy%2FKYC",
      "obsidian",
    );
    expect(note.ok && note.link.notePath).toBe("Company Policy/KYC");
    expect(note.ok && note.link.label).toBe("KYC");

    const pathLink = parseStaffSourceLink("运营流程/handover.md", "obsidian", { vaultName: "AXPM" });
    expect(pathLink.ok && pathLink.link.url.startsWith("obsidian://open?")).toBe(true);
    expect(parseStaffSourceLink("https://example.com/file", "google_drive").ok).toBe(false);
    expect(safeNotePath("../secret/note.md")).toBe("secret/note.md");
  });

  it("routes folder names into the existing six sections", () => {
    expect(inferKnowledgeSection("公司政策/员工手册.md")).toBe("company_policy");
    expect(inferKnowledgeSection("Brand and Marketing/logo-use.md")).toBe("brand_marketing");
    expect(inferKnowledgeSection("合规与风控/kyc-policy.md")).toBe("compliance_risk");
    expect(inferKnowledgeSection("客户支持/KYC checklist.md")).toBe("customer_support");
    expect(inferKnowledgeSection("产品与交易/account-types.md")).toBe("product_trading");
    expect(inferKnowledgeSection("Operations/daily-ops.md")).toBe("operations");
    expect(inferKnowledgeSection("misc-note.md")).toBeNull();
  });
});

describe("knowledge import and uploads", () => {
  it("creates one draft per file and updates the same note on a second import", async () => {
    const { importPreparedArticles, prepareLocalFileImport } = await import(
      "@/lib/knowledge-base/import-articles"
    );
    const { listKnowledgeArticles } = await import("@/lib/knowledge-base/store");

    const specs = [
      { path: "公司政策/staff-handbook.md", section: "company_policy" as const, body: "# Staff handbook\n\nApproved hours go here." },
      { path: "客户支持/kyc.md", section: "customer_support" as const, body: "# KYC\n\nAsk for the onboarding form." },
      { path: "运营流程/handover.md", section: "operations" as const, body: "# Handover\n\nClose the day in this order." },
    ];
    const prepared = await Promise.all(
      specs.map((spec) =>
        prepareLocalFileImport({
          source: "obsidian",
          fileName: spec.path.split("/").pop()!,
          mimeType: "text/markdown",
          buffer: Buffer.from(spec.body),
          section: spec.section,
          externalKey: externalKeyForLink({
            kind: "obsidian",
            url: `obsidian-note:${spec.path}`,
            label: spec.path,
            fileId: null,
            folderId: null,
            vault: "AXPM",
            notePath: spec.path,
          }),
          link: { kind: "obsidian", url: `obsidian-note:${spec.path}`, label: spec.path.split("/").pop()! },
        }),
      ),
    );
    const first = await importPreparedArticles(prepared, owner);
    expect(first.created).toBe(3);
    expect(first.articles.map((article) => article.section)).toEqual([
      "company_policy",
      "customer_support",
      "operations",
    ]);
    expect(new Set(first.articles.map((article) => article.id)).size).toBe(3);
    expect(first.articles.every((article) => article.status === "draft")).toBe(true);
    const handover = first.articles.find((article) => article.section === "operations");
    expect(handover?.body).toContain("Close the day");
    expect(handover?.attachments).toHaveLength(1);

    const again = await importPreparedArticles(
      [
        await prepareLocalFileImport({
          source: "obsidian",
          fileName: "handover.md",
          mimeType: "text/markdown",
          buffer: Buffer.from("# Handover\n\nUpdated close."),
          section: "operations",
          externalKey: prepared[2]!.externalKey,
          link: { kind: "obsidian", url: "obsidian-note:运营流程/handover.md", label: "handover.md" },
        }),
      ],
      owner,
    );
    expect(again.created).toBe(0);
    expect(again.updated).toBe(1);
    const library = await listKnowledgeArticles({ origin: "obsidian" });
    const handovers = library.articles.filter((article) => article.title === "Handover");
    expect(handovers).toHaveLength(1);
    expect(library.articles).toHaveLength(3);
  });

  it("keeps a pasted Drive link on the article and in the Drive filter", async () => {
    const { createKnowledgeArticle, listKnowledgeArticles } = await import("@/lib/knowledge-base/store");
    const { prepareLinkImport, importPreparedArticles } = await import("@/lib/knowledge-base/import-articles");
    const created = await createKnowledgeArticle(
      {
        title: "Account opening — KYC checklist",
        section: "customer_support",
        body: "Use the onboarding form already sent to the client.",
        links: [
          {
            kind: "google_drive",
            url: "https://drive.google.com/file/d/1AbCDefGhijkLmNoPqRst/view",
            label: "KYC pack",
          },
          {
            kind: "obsidian",
            url: "obsidian://open?vault=AXPM&file=Customer%20Support%2FKYC",
            label: "KYC",
          },
        ],
      },
      owner,
    );
    expect(created.links.map((link) => link.kind)).toEqual(["google_drive", "obsidian"]);
    const drive = await listKnowledgeArticles({ origin: "google_drive" });
    expect(drive.articles.map((article) => article.id)).toContain(created.id);
    const obsidian = await listKnowledgeArticles({ origin: "obsidian" });
    expect(obsidian.articles.map((article) => article.id)).toContain(created.id);

    const linked = prepareLinkImport(
      "https://docs.google.com/document/d/1AbCDefGhijkLmNoPqRsu/edit",
      "google_drive",
      "operations",
    );
    expect(linked?.section).toBe("operations");
    const imported = await importPreparedArticles([linked!], owner);
    expect(imported.created).toBe(1);
    expect(imported.articles[0]?.source).toBe("google_drive");
    expect(imported.articles[0]?.id).not.toBe(created.id);
  });

  it("stores uploads outside the public site and rejects path traversal", async () => {
    const { createKnowledgeArticle } = await import("@/lib/knowledge-base/store");
    const { addArticleAttachment } = await import("@/lib/knowledge-base/import-articles");
    const article = await createKnowledgeArticle(
      {
        title: "Logo use",
        section: "brand_marketing",
        body: "Use the orange mark on dark backgrounds.",
      },
      owner,
    );
    const saved = await addArticleAttachment(
      article.id,
      {
        fileName: "mark.png",
        mimeType: "image/png",
        buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
      },
      owner,
    );
    expect(saved.attachments).toHaveLength(1);
    const root = path.resolve(getKnowledgeFilesRoot());
    expect(root.includes(`${path.sep}public${path.sep}`)).toBe(false);
    const stored = attachmentPath(article.id, saved.attachments[0]!.id);
    expect(stored.startsWith(`${root}${path.sep}`)).toBe(true);
    const bytes = await readFile(stored);
    expect(bytes[0]).toBe(0x89);
    expect(() => attachmentPath("../outside", saved.attachments[0]!.id)).toThrow();
    expect(() => attachmentPath(article.id, "../secret")).toThrow();

    const uploaded = (await import("@/lib/knowledge-base/store")).listKnowledgeArticles({ origin: "uploaded" });
    expect((await uploaded).articles.map((item) => item.id)).toContain(article.id);
  });

  it("reads an older library file that has no source fields", async () => {
    const { getKnowledgeBaseFile, listKnowledgeArticles } = await import("@/lib/knowledge-base/store");
    await writeFile(
      getKnowledgeBaseFile(),
      JSON.stringify({
        articles: [
          {
            id: "legacy-1",
            title: "Legacy policy",
            section: "company_policy",
            body: "An older document without source fields.",
            status: "draft",
            ownerName: "Kayden Chiew",
            ownerUserId: null,
            createdAt: "2026-11-01T00:00:00.000Z",
            updatedAt: "2026-11-01T00:00:00.000Z",
            updatedBy: null,
          },
        ],
      }),
      "utf-8",
    );
    const library = await listKnowledgeArticles();
    expect(library.articles[0]).toMatchObject({
      id: "legacy-1",
      source: "manual",
      links: [],
      attachments: [],
    });
  });

  it("does not let a viewer import, and does not read a local Obsidian path", async () => {
    const { importPreparedArticles, prepareLinkImport } = await import("@/lib/knowledge-base/import-articles");
    const { importSelectedDriveFiles } = await import("@/lib/knowledge-base/drive-import");
    const { isGoogleServiceAccountConfigured } = await import("@/lib/integrations/google-drive");
    const link = prepareLinkImport("运营流程/handover.md", "obsidian", "operations", "AXPM");
    await expect(importPreparedArticles([link!], viewer)).rejects.toMatchObject({ code: "forbidden" });
    expect(isGoogleServiceAccountConfigured()).toBe(false);
    await expect(
      importSelectedDriveFiles([{ fileId: "1AbCDefGhijkLmNoPqRst", section: "operations" }], owner),
    ).rejects.toMatchObject({ code: "not_connected" });

    const settings = await saveObsidianSettings({
      vaultName: "AXPM",
      localPathLabel: "/Users/kayden/Documents/AXPM",
    });
    expect(settings).toEqual({
      vaultName: "AXPM",
      localPathLabel: "/Users/kayden/Documents/AXPM",
      readsLocalVault: false,
    });
    const raw = await readFile(process.env.AXPM_KNOWLEDGE_OBSIDIAN_FILE!, "utf-8");
    expect(raw).not.toMatch(/readFile|readdir/);
    expect(JSON.parse(raw).readsLocalVault).toBe(false);
  });
});
