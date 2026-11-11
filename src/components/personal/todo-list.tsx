"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Circle, ImagePlus, Loader2, Pencil, Plus, Trash2, X } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { VoiceInput, VoiceTextarea } from "@/components/ui/voice-field";
import {
  dueInputValue,
  formatCompletedAt,
  formatDueRelative,
  formatDueTime,
  getDueUrgency,
  parseDueInput,
} from "@/lib/personal/todo-due";
import type { JobPriority, PersonalTodo, TodoPhoto } from "@/types/personal";

type Filter = "all" | "today" | "done";

const inputClass =
  "w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none";
const btnPrimary =
  "inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-muted disabled:opacity-50";
const btnGhost =
  "inline-flex items-center gap-1.5 rounded-lg border border-card-border px-3 py-1.5 text-xs font-medium text-muted hover:text-foreground";

const urgencyBorder: Record<string, string> = {
  overdue: "border-danger/40 bg-danger/5",
  today: "border-warning/40 bg-warning/5",
  soon: "border-accent/30 bg-accent/5",
  later: "border-card-border bg-background/50",
  none: "border-card-border bg-background/50",
};

const urgencyBadge: Record<string, "danger" | "warning" | "default" | "muted"> = {
  overdue: "danger",
  today: "warning",
  soon: "default",
  later: "muted",
  none: "muted",
};

const priorityVariant: Record<JobPriority, "default" | "warning" | "danger" | "muted"> = {
  low: "muted",
  medium: "default",
  urgent: "danger",
};

const priorityLabelKey: Record<
  JobPriority,
  "todos.priorityLow" | "todos.priorityMedium" | "todos.priorityUrgent"
> = {
  low: "todos.priorityLow",
  medium: "todos.priorityMedium",
  urgent: "todos.priorityUrgent",
};

export function TodoList() {
  const { t, locale } = useLocale();
  const [todos, setTodos] = useState<PersonalTodo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [priority, setPriority] = useState<JobPriority>("medium");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDueAt, setEditDueAt] = useState("");
  const [editPriority, setEditPriority] = useState<JobPriority>("medium");
  const [editNotes, setEditNotes] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [notifyMsg, setNotifyMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/personal/todos");
      const data = await res.json();
      if (!res.ok) {
        setLoadError(data.error ?? t("todos.loadFailed"));
        setTodos([]);
        return;
      }
      setTodos(data.todos ?? []);
    } catch {
      setLoadError(t("todos.loadFailed"));
      setTodos([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const today = new Date().toISOString().split("T")[0];

  const isDueToday = (dueAt: string | null) => {
    if (!dueAt) return true;
    const d = new Date(dueAt);
    if (Number.isNaN(d.getTime())) return dueAt.startsWith(today);
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  };

  const filtered = todos.filter((todo) => {
    if (filter === "done") return todo.done;
    if (filter === "today") {
      return !todo.done && isDueToday(todo.due_at);
    }
    return !todo.done;
  });

  const openCount = todos.filter((t) => !t.done).length;
  const doneCount = todos.filter((t) => t.done).length;
  const todayCount = todos.filter((t) => !t.done && isDueToday(t.due_at)).length;
  const overdueCount = todos.filter(
    (t) => !t.done && getDueUrgency(t.due_at, false) === "overdue",
  ).length;

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setNotifyMsg(null);
    try {
      const res = await fetch("/api/personal/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          priority,
          due_at: parseDueInput(dueAt),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const parts: string[] = [];
        if (data.notify?.telegram?.sent) parts.push("Telegram");
        if (data.notify?.whatsapp?.sent) parts.push("WhatsApp");
        const anySent = parts.length > 0;
        if (anySent) {
          setNotifyMsg(t("todos.sentTo", { channels: parts.join(" + ") }));
        } else if (data.notify) {
          const errs = [
            data.notify?.telegram?.error,
            data.notify?.whatsapp?.error,
          ].filter(Boolean);
          setNotifyMsg(
            errs[0]?.toString() ?? t("todos.notifyNotConfigured"),
          );
        }
        setTitle("");
        setDueAt("");
        load();
      }
    } finally {
      setSaving(false);
    }
  }

  async function toggleDone(todo: PersonalTodo) {
    const markingDone = !todo.done;
    await fetch(`/api/personal/todos/${todo.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: markingDone }),
    });
    if (markingDone) {
      setNotifyMsg(t("todos.recordKept"));
    }
    load();
  }

  async function deleteItem(id: string) {
    await fetch(`/api/personal/todos/${id}`, { method: "DELETE" });
    if (editingId === id) setEditingId(null);
    load();
  }

  function startEdit(todo: PersonalTodo) {
    setEditingId(todo.id);
    setEditTitle(todo.title);
    setEditDueAt(dueInputValue(todo.due_at));
    setEditPriority(todo.priority);
    setEditNotes(todo.notes ?? "");
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(id: string) {
    if (!editTitle.trim()) return;
    setEditSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/personal/todos/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          due_at: parseDueInput(editDueAt),
          priority: editPriority,
          notes: editNotes.trim() || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setEditingId(null);
        await load();
      } else {
        setSaveError(
          typeof data.error === "string" ? data.error : t("todos.saveFailed"),
        );
      }
    } catch {
      setSaveError(t("todos.saveFailed"));
    } finally {
      setEditSaving(false);
    }
  }

  async function uploadPhotos(todoId: string, files: FileList | null) {
    if (!files?.length) return;
    setPhotoUploading(true);
    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append("file", file);
        await fetch(`/api/personal/todos/${todoId}/photos`, {
          method: "POST",
          body: form,
        });
      }
      await load();
    } finally {
      setPhotoUploading(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  }

  async function removePhoto(todoId: string, photoId: string) {
    await fetch(`/api/personal/todos/${todoId}/photos/${photoId}`, {
      method: "DELETE",
    });
    await load();
  }

  function renderCompletionRecord(todo: PersonalTodo) {
    if (!todo.done) return null;
    const completedLabel = formatCompletedAt(todo.completed_at, locale);

    return (
      <div className="mt-2 rounded-lg border border-success/20 bg-success/5 px-3 py-2">
        <p className="text-[11px] font-medium text-success">{t("todos.completionRecord")}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {completedLabel && (
            <Badge variant="success">
              {t("todos.completedAt", { time: completedLabel })}
            </Badge>
          )}
          {todo.due_at && (
            <span className="text-xs text-muted">
              {t("todos.originallyDue", { time: formatDueTime(todo.due_at, locale) })}
            </span>
          )}
          {(todo.photos?.length ?? 0) > 0 && (
            <span className="text-xs text-muted">
              {t("todos.photoCount", { n: todo.photos!.length })}
            </span>
          )}
        </div>
        {todo.notes && (
          <p className="mt-1 whitespace-pre-wrap text-xs text-muted">{todo.notes}</p>
        )}
        {renderPhotoGrid(todo, false)}
      </div>
    );
  }

  function renderPhotoGrid(todo: PersonalTodo, editable: boolean) {
    const photos = todo.photos ?? [];
    if (photos.length === 0 && !editable) return null;
    return (
      <div className="mt-2">
        {photos.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {photos.map((photo: TodoPhoto) => (
              <div key={photo.id} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/personal/todos/${todo.id}/photos/${photo.id}`}
                  alt=""
                  className="h-16 w-16 rounded-lg border border-card-border object-cover"
                />
                {editable && (
                  <button
                    type="button"
                    onClick={() => removePhoto(todo.id, photo.id)}
                    className="absolute -right-1 -top-1 rounded-full bg-danger p-0.5 text-white"
                    aria-label={t("todos.removePhoto")}
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {editable && (
          <div className="mt-2">
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              className="hidden"
              onChange={(e) => uploadPhotos(todo.id, e.target.files)}
            />
            <button
              type="button"
              disabled={photoUploading}
              onClick={() => photoInputRef.current?.click()}
              className={btnGhost}
            >
              {photoUploading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ImagePlus className="h-3.5 w-3.5" />
              )}
              {photoUploading ? t("todos.photoUploading") : t("todos.photoRecord")}
            </button>
            <p className="mt-1 text-[10px] text-muted">{t("todos.photoHint")}</p>
          </div>
        )}
      </div>
    );
  }

  const filters: { id: Filter; label: string; count?: number }[] = [
    { id: "all", label: t("todos.filterAll"), count: openCount },
    { id: "today", label: t("todos.filterToday"), count: todayCount },
    { id: "done", label: t("todos.filterDone"), count: doneCount },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{t("todos.title")}</h1>
        <p className="mt-1 text-muted">{t("todos.subtitle")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="text-center py-4">
          <p className="text-3xl font-bold text-accent">{openCount}</p>
          <p className="mt-1 text-sm text-muted">{t("todos.open")}</p>
        </Card>
        <Card className="text-center py-4">
          <p className="text-3xl font-bold text-warning">{todayCount}</p>
          <p className="mt-1 text-sm text-muted">{t("todos.forToday")}</p>
        </Card>
        <Card className="text-center py-4">
          <p className="text-3xl font-bold text-danger">{overdueCount}</p>
          <p className="mt-1 text-sm text-muted">{t("todos.overdue")}</p>
        </Card>
        <Card className="text-center py-4">
          <p className="text-3xl font-bold text-success">
            {todos.filter((t) => t.done).length}
          </p>
          <p className="mt-1 text-sm text-muted">{t("todos.completed")}</p>
        </Card>
      </div>

      <Card>
        <CardHeader title={t("todos.addNew")} description={t("todos.addNewDesc")} />
        <form onSubmit={handleAdd} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <VoiceInput
              className={inputClass}
              placeholder={t("todos.placeholder")}
              value={title}
              onValueChange={setTitle}
            />
          </div>
          <input
            type="datetime-local"
            className={`${inputClass} sm:w-52`}
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            title={t("todos.dueDateTime")}
          />
          <select
            className={`${inputClass} sm:w-32`}
            value={priority}
            onChange={(e) => setPriority(e.target.value as JobPriority)}
          >
            <option value="low">{t("todos.priorityLow")}</option>
            <option value="medium">{t("todos.priorityMedium")}</option>
            <option value="urgent">{t("todos.priorityUrgent")}</option>
          </select>
          <button type="submit" disabled={saving || !title.trim()} className={btnPrimary}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {t("todos.add")}
          </button>
        </form>
        {notifyMsg && (
          <p className="mt-3 text-sm text-success">{notifyMsg}</p>
        )}
      </Card>

      {loadError && (
        <Card className="border-danger/30 bg-danger/5 p-4">
          <p className="text-sm text-danger">{loadError}</p>
          <p className="mt-2 text-xs text-muted">{t("help.pageErrorFix")}</p>
          <button type="button" onClick={() => load()} className={`${btnGhost} mt-3`}>
            {t("common.refresh")}
          </button>
        </Card>
      )}

      <Card>
        <div className="mb-4 flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === f.id
                  ? "border-accent bg-accent/15 text-accent"
                  : "border-card-border text-muted hover:text-foreground"
              }`}
            >
              {f.label}
              {f.count !== undefined ? ` (${f.count})` : ""}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">
            {filter === "done" ? t("todos.emptyDone") : t("todos.empty")}
          </p>
        ) : (
          <ul className="space-y-2">
            {filtered.map((todo) => {
              const isEditing = editingId === todo.id;
              const urgency = getDueUrgency(todo.due_at, todo.done);
              const dueInfo = formatDueRelative(todo.due_at, todo.done, locale);
              return (
                <li
                  key={todo.id}
                  className={`rounded-lg border px-4 py-3 transition-colors ${
                    todo.done
                      ? "border-success/25 bg-success/5"
                      : urgencyBorder[urgency]
                  } ${isEditing ? "ring-1 ring-accent/40" : ""}`}
                >
                  {isEditing ? (
                    <div className="space-y-3">
                      <VoiceInput
                        className={inputClass}
                        value={editTitle}
                        onValueChange={setEditTitle}
                        placeholder={t("todos.placeholder")}
                      />
                      <div className="flex flex-wrap gap-2">
                        <input
                          type="datetime-local"
                          className={`${inputClass} min-w-[180px] flex-1`}
                          value={editDueAt}
                          onChange={(e) => setEditDueAt(e.target.value)}
                          title={t("todos.dueDateTime")}
                        />
                        <select
                          className={`${inputClass} w-28`}
                          value={editPriority}
                          onChange={(e) => setEditPriority(e.target.value as JobPriority)}
                        >
                          <option value="low">{t("todos.priorityLow")}</option>
                          <option value="medium">{t("todos.priorityMedium")}</option>
                          <option value="urgent">{t("todos.priorityUrgent")}</option>
                        </select>
                      </div>
                      <VoiceTextarea
                        className={`${inputClass} min-h-[56px] resize-y`}
                        value={editNotes}
                        onValueChange={setEditNotes}
                        placeholder={t("todos.notesPlaceholder")}
                      />
                      {renderPhotoGrid(todo, true)}
                      {saveError && (
                        <p className="text-sm text-danger">{saveError}</p>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={editSaving || !editTitle.trim()}
                          onClick={() => saveEdit(todo.id)}
                          className={btnPrimary}
                        >
                          {editSaving ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                          {t("common.save")}
                        </button>
                        <button type="button" onClick={cancelEdit} className={btnGhost}>
                          <X className="h-4 w-4" />
                          {t("common.cancel")}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <button
                        type="button"
                        onClick={() => toggleDone(todo)}
                        className={`mt-0.5 shrink-0 rounded-full border p-0.5 transition-colors ${
                          todo.done
                            ? "border-success bg-success text-white"
                            : "border-card-border text-muted hover:border-accent hover:text-accent"
                        }`}
                        aria-label={todo.done ? t("todos.markOpen") : t("todos.markDone")}
                      >
                        {todo.done ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Circle className="h-4 w-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => startEdit(todo)}
                      >
                        <p
                          className={`font-medium ${
                            todo.done ? "text-muted line-through" : "text-foreground"
                          }`}
                        >
                          {todo.title}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <Badge variant={priorityVariant[todo.priority]}>
                            {t(priorityLabelKey[todo.priority])}
                          </Badge>
                          {!todo.done && (
                            <Badge variant={urgencyBadge[urgency]}>
                              {dueInfo.label}
                            </Badge>
                          )}
                          {!todo.done && (todo.photos?.length ?? 0) > 0 && (
                            <span className="text-xs text-muted">
                              {t("todos.photoCount", { n: todo.photos!.length })}
                            </span>
                          )}
                        </div>
                        {!todo.done && todo.notes && (
                          <p className="mt-1 text-xs text-muted line-clamp-2">{todo.notes}</p>
                        )}
                        {!todo.done && renderPhotoGrid(todo, false)}
                        {renderCompletionRecord(todo)}
                        {todo.done && (
                          <span className="mt-1 inline-block text-xs text-accent">
                            {t("todos.addCompletionRecord")}
                          </span>
                        )}
                        {!todo.done && (
                          <span className="mt-1 inline-block text-xs text-accent">
                            {t("todos.tapToEdit")}
                          </span>
                        )}
                      </button>
                      <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
                        <button
                          type="button"
                          onClick={() => startEdit(todo)}
                          className="rounded-lg p-1.5 text-muted hover:text-accent"
                          aria-label={t("common.edit")}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteItem(todo.id)}
                          className="rounded-lg p-1.5 text-muted hover:text-danger"
                          aria-label={t("common.delete")}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
