import { NextResponse } from "next/server";
import { isDalleConfigured } from "@/lib/ai/market-dalle-images";
import { isGammaConfigured } from "@/lib/ai/gamma-config";
import { isUnstructuredConfigured } from "@/lib/ai/unstructured-config";
import { getActiveWebSearchProvider, isWebSearchConfigured } from "@/lib/ai/web-search-config";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    unstructured: isUnstructuredConfigured(),
    gamma: isGammaConfigured(),
    dalle: isDalleConfigured(),
    webSearch: isWebSearchConfigured(),
    webSearchProvider: getActiveWebSearchProvider(),
  });
}
