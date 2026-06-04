import fs from "fs/promises";
import path from "path";
import type { ConversationData } from "@/types/conversation";

const DATA_FILE = path.join(process.cwd(), "data", "conversations.json");

async function readData(): Promise<ConversationData> {
  const raw = await fs.readFile(DATA_FILE, "utf-8");
  return JSON.parse(raw) as ConversationData;
}

async function writeData(data: ConversationData) {
  await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

/** Link orphan messages to a CRM client when auto-created or matched */
export async function attachMessagesToClient(params: {
  client_id: string;
  client_name: string;
  wechat_id?: string | null;
  whatsapp_id?: string | null;
}) {
  try {
    const data = await readData();
    const wechat = params.wechat_id?.trim().toLowerCase();
    const wa = params.whatsapp_id?.replace(/\D/g, "");
    let changed = false;

    for (const msg of data.messages) {
      if (msg.client_id === params.client_id) continue;

      const msgWechat = msg.wechat_id?.trim().toLowerCase();
      const msgWa = msg.wechat_id?.replace(/\D/g, "");
      const matchWechat =
        wechat && msgWechat && (msgWechat === wechat || msgWechat.includes(wechat));
      const matchWhatsapp =
        wa && msgWa && msg.channel === "whatsapp" && msgWa === wa;

      if (
        matchWechat ||
        matchWhatsapp ||
        (!msg.client_id && msg.client_name === params.client_name)
      ) {
        msg.client_id = params.client_id;
        msg.client_name = params.client_name;
        changed = true;
      }
    }

    if (changed) await writeData(data);
  } catch {
    // conversations file may not exist yet
  }
}
