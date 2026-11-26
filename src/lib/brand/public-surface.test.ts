import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { PUBLIC_BRAND, publicMetadata, renderPublicSurfaceHtml } from "@/lib/brand/public-brand";

const PUBLIC_FILES = [
  "src/app/layout.tsx",
  "src/app/login/page.tsx",
  "src/app/customer/login/page.tsx",
  "src/components/auth/login-form.tsx",
  "src/app/signup/page.tsx",
  "src/app/signup/layout.tsx",
  "src/app/verify-email/page.tsx",
  "src/app/forgot-password/page.tsx",
  "src/app/reset-password/page.tsx",
  "src/app/register/layout.tsx",
  "src/app/manifest.ts",
  "src/app/icon.tsx",
  "src/app/apple-icon.tsx",
  "public/sw.js",
  "public/offline.html",
  "src/components/layout/install-app-banner.tsx",
  "src/components/pwa/service-worker-register.tsx",
  "src/lib/pwa/install-prompt.ts",
  "src/lib/pwa/icons.tsx",
  "src/app/icons/[file]/route.tsx",
  "src/app/apple-touch-icon.png/route.tsx",
  "src/app/robots.ts",
  "src/components/auth/public-auth-forms.tsx",
  "src/lib/brand/public-brand.ts",
  "src/app/(dashboard)/dashboard/crm/layout.tsx",
  "src/app/(dashboard)/dashboard/clients/layout.tsx",
];

function PublicPage() {
  const meta = publicMetadata();
  return createElement(
    "html",
    null,
    createElement(
      "head",
      null,
      createElement("title", null, PUBLIC_BRAND),
      createElement("meta", { name: "application-name", content: meta.applicationName }),
    ),
    createElement("body", null, createElement("p", null, PUBLIC_BRAND), renderPublicSurfaceHtml()),
  );
}

describe("public pages do not show the internal brand", () => {
  it("greps the rendered public pages for the internal brand", () => {
    delete process.env.EMAIL_FROM;
    const html = renderToStaticMarkup(createElement(PublicPage));
    expect(html).not.toMatch(/axpm/i);
    expect(html).toContain(PUBLIC_BRAND);
  });

  it("greps the public page sources", () => {
    for (const file of PUBLIC_FILES) {
      const source = readFileSync(path.join(process.cwd(), file), "utf8");
      expect(source, file).not.toMatch(/axpm/i);
    }
  });
});
