import "server-only";

import { readAppSettings } from "@/lib/finance/settings";
import {
  DEFAULT_EDGE_VOICE,
  DEFAULT_MAC_VOICE,
  type TtsPriority,
} from "@/lib/social/presenter-voices";
import { getDefaultTtsPriority } from "@/lib/local/self-hosted-config";

export type PresenterSettings = {
  edgeVoice: string;
  macVoice: string;
  ttsPriority: TtsPriority;
};

export async function getPresenterSettings(): Promise<PresenterSettings> {
  const s = await readAppSettings();
  const envEdge = process.env.PRESENTER_EDGE_VOICE?.trim();
  const envMac = process.env.PRESENTER_MAC_VOICE?.trim();

  return {
    edgeVoice: s.presenterEdgeVoice?.trim() || envEdge || DEFAULT_EDGE_VOICE,
    macVoice: s.presenterMacVoice?.trim() || envMac || DEFAULT_MAC_VOICE,
    ttsPriority: (s.presenterTtsPriority as TtsPriority | null | undefined) ?? getDefaultTtsPriority(),
  };
}
