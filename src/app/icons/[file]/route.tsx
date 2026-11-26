import { isPwaIconFile, PWA_ICONS, renderKcIcon } from "@/lib/pwa/icons";

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(PWA_ICONS).map((file) => ({ file }));
}

export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  if (!isPwaIconFile(file)) return new Response("Not found", { status: 404 });
  const icon = PWA_ICONS[file];
  return renderKcIcon(icon.size, icon.maskable);
}
