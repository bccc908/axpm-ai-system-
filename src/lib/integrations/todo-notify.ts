import { readAppSettings } from "@/lib/finance/settings";
import { sendTelegramMessage } from "@/lib/integrations/telegram";
import { sendWhatsAppMessage } from "@/lib/integrations/whatsapp";
import type { PersonalTodo } from "@/types/personal";

const priorityLabel: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  urgent: "Urgent",
};

function formatTodoPlain(todo: PersonalTodo) {
  const lines = [
    "📌 AXPM — New To-Do",
    "",
    todo.title,
    `Priority: ${priorityLabel[todo.priority] ?? todo.priority}`,
  ];
  if (todo.due_at) lines.push(`Due: ${todo.due_at}`);
  if (todo.notes) lines.push(`Notes: ${todo.notes}`);
  return lines.join("\n");
}

function formatTodoHtml(todo: PersonalTodo) {
  const lines = [
    "📌 <b>New To-Do</b>",
    "",
    `<b>${escapeHtml(todo.title)}</b>`,
    `Priority: ${priorityLabel[todo.priority] ?? todo.priority}`,
  ];
  if (todo.due_at) lines.push(`Due: ${todo.due_at}`);
  if (todo.notes) lines.push(`Notes: ${escapeHtml(todo.notes)}`);
  return lines.join("\n");
}

function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export type TodoNotifyResult = {
  telegram: { sent: boolean; error?: string };
  whatsapp: { sent: boolean; error?: string };
};

export async function notifyNewTodo(todo: PersonalTodo): Promise<TodoNotifyResult> {
  const settings = await readAppSettings();
  const wantTelegram = settings.todoNotifyTelegram !== false;
  const wantWhatsapp = settings.todoNotifyWhatsapp !== false;
  const whatsappPhone =
    settings.whatsappNotifyPhone?.trim() ||
    process.env.WHATSAPP_NOTIFY_PHONE?.trim() ||
    "";

  const result: TodoNotifyResult = {
    telegram: { sent: false },
    whatsapp: { sent: false },
  };

  if (wantTelegram) {
    const tg = await sendTelegramMessage(formatTodoHtml(todo));
    result.telegram = tg.ok ? { sent: true } : { sent: false, error: tg.error };
  }

  if (wantWhatsapp) {
    if (!whatsappPhone) {
      result.whatsapp = {
        sent: false,
        error: "Set your WhatsApp number in Settings (or WHATSAPP_NOTIFY_PHONE in .env.local)",
      };
    } else {
      const sent = await sendWhatsAppMessage(whatsappPhone, formatTodoPlain(todo));
      result.whatsapp = sent
        ? { sent: true }
        : {
            sent: false,
            error:
              "WhatsApp send failed — check WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID in .env.local",
          };
    }
  }

  return result;
}
