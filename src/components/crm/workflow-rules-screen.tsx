"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Loader2, Plus } from "lucide-react";
import { useLocale } from "@/components/providers/locale-provider";
import { Card, CardHeader } from "@/components/ui/card";
import { formatWorkflowTimestamp } from "@/lib/crm/workflow-time";
import { WORKFLOW_ERROR_I18N_KEYS } from "@/lib/crm/workflow-engine";
import { cn } from "@/lib/utils";
import type {
  CrmWorkflow,
  CrmWorkflowCondition,
  CrmWorkflowConditionField,
  CrmWorkflowRunPublic,
  CrmWorkflowRunResult,
} from "@/types/crm-workflows";

const inputClass =
  "w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none disabled:opacity-60";

const LEAD_STATUSES = [
  ["new", "workflowRules.leadNew"],
  ["contacted", "workflowRules.leadContacted"],
  ["qualified", "workflowRules.leadQualified"],
  ["unqualified", "workflowRules.leadUnqualified"],
  ["converted", "workflowRules.leadConverted"],
] as const;

const DEAL_STAGES = [
  ["stage-new", "workflowRules.stageNew"],
  ["stage-contacted", "workflowRules.stageContacted"],
  ["stage-qualified", "workflowRules.stageQualified"],
  ["stage-negotiation", "workflowRules.stageNegotiation"],
  ["stage-deposited", "workflowRules.stageDeposited"],
  ["stage-active", "workflowRules.stageActive"],
] as const;

const ERROR_KEYS: Record<string, string> = WORKFLOW_ERROR_I18N_KEYS;

type Approver = { id: string; name: string; role: string };

type Bundle = {
  workflows: CrmWorkflow[];
  access: "view" | "edit";
  can_approve: boolean;
  telegram: { ready: boolean; configured: boolean; paused: boolean };
  default_approver_id: string | null;
  approvers: Approver[];
};

function cloneRule(rule: CrmWorkflow): CrmWorkflow {
  return { ...rule, condition: rule.condition ? { ...rule.condition } : null };
}

function conditionFor(field: CrmWorkflowConditionField): CrmWorkflowCondition {
  if (field === "deal.amount") return { field, op: "gte", value: "0" };
  if (field === "deal.currency") return { field, op: "eq", value: "CNY" };
  return { field, op: "eq", value: "" };
}

export function WorkflowRulesScreen() {
  const { t, locale } = useLocale();
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [runs, setRuns] = useState<CrmWorkflowRunPublic[]>([]);
  const [waiting, setWaiting] = useState<CrmWorkflowRunPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState<number | null>(null);
  const [draft, setDraft] = useState<CrmWorkflow | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [resultFilter, setResultFilter] = useState<CrmWorkflowRunResult | "all">("all");

  const load = useCallback(async () => {
    const [rulesRes, historyRes] = await Promise.all([
      fetch("/api/crm/workflows"),
      fetch("/api/crm/workflows/history"),
    ]);
    if (rulesRes.status === 401 || rulesRes.status === 403) {
      setDenied(rulesRes.status);
      setBundle(null);
      return;
    }
    const rulesJson = await rulesRes.json();
    const historyJson = historyRes.ok ? await historyRes.json() : { runs: [] };
    setDenied(null);
    setBundle({
      workflows: rulesJson.workflows ?? [],
      access: rulesJson.access === "edit" ? "edit" : "view",
      can_approve: Boolean(rulesJson.can_approve),
      telegram: rulesJson.telegram ?? { ready: false, configured: false, paused: false },
      default_approver_id: rulesJson.default_approver_id ?? null,
      approvers: rulesJson.approvers ?? [],
    });
    setWaiting(rulesJson.waiting ?? []);
    setRuns(historyJson.runs ?? []);
  }, []);

  useEffect(() => {
    void load().finally(() => setLoading(false));
  }, [load]);

  const canEdit = bundle?.access === "edit";
  const workflows = bundle?.workflows ?? [];

  const lastByRule = useMemo(() => {
    const map = new Map<string, CrmWorkflowRunPublic>();
    for (const run of runs) {
      if (!map.has(run.rule_id)) map.set(run.rule_id, run);
    }
    return map;
  }, [runs]);

  const visibleRuns =
    resultFilter === "all" ? runs : runs.filter((run) => run.result === resultFilter);

  function explain(message: string | null | undefined) {
    if (!message) return "";
    const key = ERROR_KEYS[message];
    return key ? t(key) : message;
  }

  function resultLabel(result: CrmWorkflowRunResult) {
    if (result === "ok") return t("workflowRules.resultOk");
    if (result === "error") return t("workflowRules.resultError");
    if (result === "rejected") return t("workflowRules.resultRejected");
    return t("workflowRules.resultWaiting");
  }

  function triggerLabel(rule: CrmWorkflow) {
    if (rule.trigger === "lead_status") {
      const match = LEAD_STATUSES.find((item) => item[0] === rule.trigger_value);
      const value = match ? t(match[1]) : rule.trigger_value;
      return `${t("workflowRules.leadStatus")} · ${value}`;
    }
    const match = DEAL_STAGES.find((item) => item[0] === rule.trigger_value);
    const value = match ? t(match[1]) : rule.trigger_value;
    return `${t("workflowRules.dealStage")} · ${value}`;
  }

  function conditionLabel(rule: CrmWorkflow) {
    if (!rule.condition) return t("workflowRules.firesAlone");
    const value = rule.condition.value;
    if (rule.condition.field === "lead.source") return `${t("workflowRules.conditionSource")} ${value}`;
    if (rule.condition.field === "lead.assigned_to") return `${t("workflowRules.conditionAssignee")} ${value}`;
    if (rule.condition.field === "deal.currency") return `${t("workflowRules.conditionCurrency")} ${value}`;
    return `${t("workflowRules.conditionAmount")} ${value}`;
  }

  function actionLabel(rule: CrmWorkflow) {
    if (rule.action === "notify_telegram") return t("workflowRules.notifyTelegram");
    return `${t("workflowRules.createTask")}: ${rule.task_title}`;
  }

  function selectRule(rule: CrmWorkflow) {
    setIsNew(false);
    setDraft(cloneRule(rule));
    setNotice(null);
  }

  function startNew() {
    if (!bundle || !canEdit) return;
    const created: CrmWorkflow = {
      id: crypto.randomUUID(),
      name: "",
      enabled: true,
      trigger: "lead_status",
      trigger_value: "qualified",
      condition: null,
      action: "create_task",
      task_title: "",
      telegram_message: "",
      approver_user_id: bundle.default_approver_id,
      position: workflows.length,
    };
    setIsNew(true);
    setDraft(created);
    setNotice(null);
  }

  async function persist(next: CrmWorkflow[], okMessage: string) {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/crm/workflows", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflows: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice(explain(data.error) || t("workflowRules.errGeneric"));
        return;
      }
      setIsNew(false);
      setNotice(okMessage);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function saveDraft() {
    if (!draft || !canEdit) return;
    const next = isNew
      ? [...workflows, draft]
      : workflows.map((rule) => (rule.id === draft.id ? draft : rule));
    await persist(next, t("workflowRules.saved"));
  }

  async function toggle(rule: CrmWorkflow, enabled: boolean) {
    if (!canEdit) return;
    if (draft && draft.id === rule.id) setDraft({ ...draft, enabled });
    const next = workflows.map((item) => (item.id === rule.id ? { ...item, enabled } : item));
    await persist(next, enabled ? t("workflowRules.enabled") : t("workflowRules.disabled"));
  }

  async function move(rule: CrmWorkflow, direction: -1 | 1) {
    if (!canEdit) return;
    const index = workflows.findIndex((item) => item.id === rule.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= workflows.length) return;
    const next = [...workflows];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    await persist(next, t("workflowRules.saved"));
  }

  async function decide(run: CrmWorkflowRunPublic, decision: "approve" | "reject", retry = false) {
    if (!bundle?.can_approve) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/crm/workflows/runs/${run.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, retry }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setNotice(explain(data.error) || t("workflowRules.errGeneric"));
        return;
      }
      const updated = data.run as CrmWorkflowRunPublic | undefined;
      if (updated?.result === "error") setNotice(explain(updated.error_message));
      else if (updated?.result === "rejected") setNotice(t("workflowRules.rejectedDone"));
      else setNotice(t("workflowRules.approveDone"));
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted" />
      </div>
    );
  }

  if (denied) {
    return (
      <Card>
        <p className="text-sm text-foreground">
          {denied === 401 ? t("workflowRules.denyUnauthorized") : t("workflowRules.denyForbidden")}
        </p>
      </Card>
    );
  }

  if (!bundle) return null;

  return (
    <div className="space-y-6" data-testid="workflow-rules-page">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("workflowRules.title")}</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted">{t("workflowRules.subtitle")}</p>
        </div>
        {canEdit ? (
          <button
            type="button"
            onClick={startNew}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:bg-accent-muted"
          >
            <Plus className="h-4 w-4" />
            {t("workflowRules.newRule")}
          </button>
        ) : null}
      </div>

      <p data-testid="workflow-readiness" className="text-sm text-muted">
        {bundle.telegram.paused ? t("workflowRules.telegramPaused") : null}{" "}
        {!bundle.telegram.configured ? t("workflowRules.telegramNotConfigured") : null}
        {bundle.telegram.configured && !bundle.telegram.paused ? t("workflowRules.telegramReady") : null}
      </p>
      <p className="text-sm text-muted">{t("workflowRules.telegramPersonal")}</p>
      {!canEdit ? <p className="text-sm text-muted">{t("workflowRules.readOnly")}</p> : null}
      {notice ? <p className="text-sm text-foreground">{notice}</p> : null}

      {waiting.length > 0 ? (
        <section className="space-y-3" data-testid="workflow-approval">
          <h2 className="text-lg font-semibold text-foreground">{t("workflowRules.waitingTitle")}</h2>
          {waiting.map((run) => (
            <Card key={run.id}>
              <div className="space-y-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium text-foreground">{run.rule_name}</p>
                  <p className="text-xs text-muted">
                    {formatWorkflowTimestamp(run.created_at, locale === "zh" ? "zh" : "en")}
                  </p>
                </div>
                {run.outbound_message ? (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted">
                      {t("workflowRules.exactMessage")}
                    </p>
                    <pre className="mt-1 whitespace-pre-wrap rounded-lg border border-card-border bg-background p-3 text-sm text-foreground">
                      {run.outbound_message}
                    </pre>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <HistoryPreview payload={run.payload_redacted} />
                    <p className="text-sm text-muted">{t("workflowRules.approversOnly")}</p>
                  </div>
                )}
                <p className="text-xs text-muted">
                  {t("workflowRules.approver")}: {approverName(bundle.approvers, run.approver_user_id, t("workflowRules.approverMissing"))}
                </p>
                {bundle.telegram.paused ? (
                  <p className="text-sm text-foreground">{t("workflowRules.pausedCard")}</p>
                ) : null}
                {!bundle.telegram.configured ? (
                  <p className="text-sm text-foreground">{t("workflowRules.notConfiguredCard")}</p>
                ) : null}
                {bundle.can_approve ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void decide(run, "approve")}
                      className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground disabled:opacity-50"
                    >
                      {t("workflowRules.approve")}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void decide(run, "reject")}
                      className="rounded-lg border border-card-border px-3 py-1.5 text-sm text-foreground disabled:opacity-50"
                    >
                      {t("workflowRules.reject")}
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-muted">{t("workflowRules.cannotApprove")}</p>
                )}
              </div>
            </Card>
          ))}
        </section>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card data-testid="workflow-rule-list">
          <CardHeader title={t("workflowRules.title")} />
          {workflows.length === 0 && !isNew ? (
            <div className="space-y-2 text-sm text-muted">
              <p>{t("workflowRules.empty")}</p>
              <p>{t("workflowRules.emptyHint")}</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {workflows.map((rule, index) => {
                const last = lastByRule.get(rule.id);
                const active = draft?.id === rule.id && !isNew;
                return (
                  <li key={rule.id} className={cn("rounded-lg border px-3 py-2", active ? "border-accent" : "border-card-border")}>
                    <button type="button" className="w-full text-left" onClick={() => selectRule(rule)}>
                      <p className="font-medium text-foreground">{rule.name}</p>
                      <p className="mt-1 text-xs text-muted">
                        {t("workflowRules.when")} {triggerLabel(rule)}
                        {" → "}
                        {t("workflowRules.if")} {conditionLabel(rule)}
                        {" → "}
                        {t("workflowRules.then")} {actionLabel(rule)}
                      </p>
                      <p className="mt-1 text-xs text-muted">
                        {t("workflowRules.lastRun")}:{" "}
                        {last
                          ? `${resultLabel(last.result)} · ${formatWorkflowTimestamp(last.created_at, locale === "zh" ? "zh" : "en")}`
                          : t("workflowRules.neverRun")}
                      </p>
                    </button>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <label className="flex items-center gap-2 text-xs text-muted">
                        <input
                          type="checkbox"
                          checked={rule.enabled}
                          disabled={!canEdit || busy}
                          onChange={(event) => void toggle(rule, event.target.checked)}
                        />
                        {rule.enabled ? t("workflowRules.enabled") : t("workflowRules.disabled")}
                      </label>
                      {canEdit ? (
                        <>
                          <button
                            type="button"
                            aria-label={t("workflowRules.moveUp")}
                            disabled={busy || index === 0}
                            onClick={() => void move(rule, -1)}
                            className="rounded border border-card-border p-1 disabled:opacity-40"
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label={t("workflowRules.moveDown")}
                            disabled={busy || index === workflows.length - 1}
                            onClick={() => void move(rule, 1)}
                            className="rounded border border-card-border p-1 disabled:opacity-40"
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>
                        </>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          {draft ? (
            <WorkflowCanvas
              draft={draft}
              canEdit={Boolean(canEdit)}
              busy={busy}
              approvers={bundle.approvers}
              onChange={setDraft}
              onSave={() => void saveDraft()}
              onCancel={() => {
                setDraft(null);
                setIsNew(false);
              }}
              defaultApproverId={bundle.default_approver_id}
            />
          ) : (
            <p className="text-sm text-muted">{t("workflowRules.selectPrompt")}</p>
          )}
        </Card>
      </div>

      <Card data-testid="workflow-history">
        <CardHeader title={t("workflowRules.history")} description={t("workflowRules.historyHint")} />
        <label className="mb-3 flex items-center gap-2 text-sm text-muted">
          {t("workflowRules.result")}
          <select
            className={inputClass}
            value={resultFilter}
            onChange={(event) => setResultFilter(event.target.value as CrmWorkflowRunResult | "all")}
          >
            <option value="all">{t("workflowRules.filterAll")}</option>
            <option value="ok">{t("workflowRules.resultOk")}</option>
            <option value="error">{t("workflowRules.resultError")}</option>
            <option value="waiting-approval">{t("workflowRules.resultWaiting")}</option>
            <option value="rejected">{t("workflowRules.resultRejected")}</option>
          </select>
        </label>
        {visibleRuns.length === 0 ? (
          <p className="text-sm text-muted">{t("workflowRules.noHistory")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs uppercase text-muted">
                <tr>
                  <th className="py-2 pr-3">{t("workflowRules.time")}</th>
                  <th className="py-2 pr-3">{t("workflowRules.rule")}</th>
                  <th className="py-2 pr-3">{t("workflowRules.result")}</th>
                  <th className="py-2 pr-3">{t("workflowRules.actor")}</th>
                  <th className="py-2">{t("workflowRules.payload")}</th>
                </tr>
              </thead>
              <tbody>
                {visibleRuns.map((run) => (
                  <tr key={run.id} className="border-t border-card-border align-top">
                    <td className="py-2 pr-3 text-muted">
                      {formatWorkflowTimestamp(run.created_at, locale === "zh" ? "zh" : "en")}
                    </td>
                    <td className="py-2 pr-3">{run.rule_name}</td>
                    <td className="py-2 pr-3">
                      <p>{resultLabel(run.result)}</p>
                      {run.error_message ? <p className="text-xs text-muted">{explain(run.error_message)}</p> : null}
                      {run.approved_by && run.approved_at ? (
                        <p className="text-xs text-muted">
                          {run.approved_by.name} · {formatWorkflowTimestamp(run.approved_at, locale === "zh" ? "zh" : "en")}
                        </p>
                      ) : null}
                      {run.rejected_by && run.rejected_at ? (
                        <p className="text-xs text-muted">
                          {run.rejected_by.name} · {formatWorkflowTimestamp(run.rejected_at, locale === "zh" ? "zh" : "en")}
                        </p>
                      ) : null}
                      {bundle.can_approve && run.result === "error" && run.action === "notify_telegram" && run.send_attempts < 2 ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void decide(run, "approve", true)}
                          className="mt-1 rounded border border-card-border px-2 py-1 text-xs"
                        >
                          {t("workflowRules.retry")}
                        </button>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3">{run.actor_name}</td>
                    <td className="py-2">
                      <HistoryPreview payload={run.payload_redacted} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function approverName(approvers: Approver[], id: string | null, fallback: string) {
  if (!id) return fallback;
  return approvers.find((person) => person.id === id)?.name ?? fallback;
}

function HistoryPreview({ payload }: { payload: CrmWorkflowRunPublic["payload_redacted"] }) {
  const parts = [payload.display_name, payload.company, payload.status].filter(Boolean);
  return <p className="text-xs text-muted">{parts.join(" · ") || "—"}</p>;
}

function WorkflowCanvas({
  draft,
  canEdit,
  busy,
  approvers,
  onChange,
  onSave,
  onCancel,
  defaultApproverId,
}: {
  draft: CrmWorkflow;
  canEdit: boolean;
  busy: boolean;
  approvers: Approver[];
  onChange: (rule: CrmWorkflow) => void;
  onSave: () => void;
  onCancel: () => void;
  defaultApproverId: string | null;
}) {
  const { t } = useLocale();
  const locked = !canEdit || busy;

  function patch(partial: Partial<CrmWorkflow>) {
    onChange({ ...draft, ...partial });
  }

  return (
    <div className="space-y-4" data-testid="workflow-canvas">
      <label className="block text-sm">
        <span className="text-muted">{t("workflowRules.name")}</span>
        <input
          className={cn(inputClass, "mt-1")}
          value={draft.name}
          disabled={locked}
          placeholder={t("workflowRules.namePlaceholder")}
          onChange={(event) => patch({ name: event.target.value })}
        />
      </label>

      <div className="flex items-stretch gap-1 overflow-x-auto pb-1">
        <FlowNode step="1" title={t("workflowRules.stepTrigger")}>
          <p className="text-base font-semibold text-foreground">{draft.trigger === "lead_status" ? t("workflowRules.leadStatus") : t("workflowRules.dealStage")}</p>
          <select
            className={inputClass}
            disabled={locked}
            value={draft.trigger}
            onChange={(event) => {
              const trigger = event.target.value as CrmWorkflow["trigger"];
              patch({
                trigger,
                trigger_value: trigger === "lead_status" ? "qualified" : "stage-deposited",
              });
            }}
          >
            <option value="lead_status">{t("workflowRules.leadStatus")}</option>
            <option value="deal_stage">{t("workflowRules.dealStage")}</option>
          </select>
          {draft.trigger === "lead_status" ? (
            <select
              className={inputClass}
              disabled={locked}
              value={draft.trigger_value}
              onChange={(event) => patch({ trigger_value: event.target.value })}
            >
              {LEAD_STATUSES.map(([value, key]) => (
                <option key={value} value={value}>{t(key)}</option>
              ))}
            </select>
          ) : (
            <select
              className={inputClass}
              disabled={locked}
              value={draft.trigger_value}
              onChange={(event) => patch({ trigger_value: event.target.value })}
            >
              {DEAL_STAGES.map(([value, key]) => (
                <option key={value} value={value}>{t(key)}</option>
              ))}
              {DEAL_STAGES.some((item) => item[0] === draft.trigger_value) ? null : (
                <option value={draft.trigger_value}>{draft.trigger_value}</option>
              )}
            </select>
          )}
        </FlowNode>
        <FlowArrow />
        <FlowNode step="2" title={t("workflowRules.stepCondition")}>
          <p className="text-base font-semibold text-foreground">
            {draft.condition ? t("workflowRules.condition") : t("workflowRules.noCondition")}
          </p>
          <select
            className={inputClass}
            disabled={locked}
            value={draft.condition?.field ?? ""}
            onChange={(event) => {
              const field = event.target.value as CrmWorkflowConditionField | "";
              patch({ condition: field ? conditionFor(field) : null });
            }}
          >
            <option value="">{t("workflowRules.noCondition")}</option>
            <option value="lead.source">{t("workflowRules.conditionSource")}</option>
            <option value="lead.assigned_to">{t("workflowRules.conditionAssignee")}</option>
            <option value="deal.currency">{t("workflowRules.conditionCurrency")}</option>
            <option value="deal.amount">{t("workflowRules.conditionAmount")}</option>
          </select>
          {draft.condition ? (
            <input
              className={inputClass}
              disabled={locked}
              value={draft.condition.value}
              onChange={(event) =>
                patch({ condition: { ...draft.condition!, value: event.target.value } })
              }
            />
          ) : (
            <p className="text-xs text-muted">{t("workflowRules.firesAlone")}</p>
          )}
        </FlowNode>
        <FlowArrow />
        <FlowNode step="3" title={t("workflowRules.stepAction")}>
          <p className="text-base font-semibold text-foreground">
            {draft.action === "notify_telegram" ? t("workflowRules.notifyTelegram") : t("workflowRules.createTask")}
          </p>
          <select
            className={inputClass}
            disabled={locked}
            value={draft.action}
            onChange={(event) => {
              const action = event.target.value as CrmWorkflow["action"];
              patch({
                action,
                approver_user_id:
                  action === "notify_telegram"
                    ? draft.approver_user_id || defaultApproverId || approvers[0]?.id || null
                    : null,
              });
            }}
          >
            <option value="create_task">{t("workflowRules.createTask")}</option>
            <option value="notify_telegram">{t("workflowRules.notifyTelegram")}</option>
          </select>
          {draft.action === "create_task" ? (
            <input
              className={inputClass}
              disabled={locked}
              value={draft.task_title}
              placeholder={t("workflowRules.taskTitle")}
              onChange={(event) => patch({ task_title: event.target.value })}
            />
          ) : (
            <>
              <textarea
                className={cn(inputClass, "min-h-20")}
                disabled={locked}
                value={draft.telegram_message ?? ""}
                placeholder={t("workflowRules.message")}
                onChange={(event) => patch({ telegram_message: event.target.value })}
              />
              <p className="text-xs text-muted">{t("workflowRules.placeholders")}</p>
              <label className="block text-xs text-muted">
                {t("workflowRules.approver")}
                <select
                  className={cn(inputClass, "mt-1")}
                  disabled={locked}
                  value={draft.approver_user_id ?? ""}
                  onChange={(event) => patch({ approver_user_id: event.target.value })}
                >
                  <option value="">{t("workflowRules.approverMissing")}</option>
                  {approvers.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-xs text-muted">{t("workflowRules.approverHint")}</p>
            </>
          )}
        </FlowNode>
      </div>

      <p className="text-sm text-muted">
        {t("workflowRules.when")} {draft.trigger === "lead_status" ? t("workflowRules.leadStatus") : t("workflowRules.dealStage")}
        {" → "}
        {t("workflowRules.if")} {draft.condition ? draft.condition.field : t("workflowRules.noCondition")}
        {" → "}
        {t("workflowRules.then")} {draft.action === "notify_telegram" ? t("workflowRules.notifyTelegram") : t("workflowRules.createTask")}
      </p>

      {canEdit ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onSave}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground disabled:opacity-50"
          >
            {busy ? t("workflowRules.saving") : t("workflowRules.save")}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-lg border border-card-border px-4 py-2 text-sm"
          >
            {t("workflowRules.cancel")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function FlowNode({
  step,
  title,
  children,
}: {
  step: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="min-w-[240px] flex-1 rounded-xl border border-card-border bg-background">
      <header className="flex items-center gap-2 border-b border-card-border px-3 py-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
          {step}
        </span>
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</span>
      </header>
      <div className="space-y-2 p-3">{children}</div>
    </section>
  );
}

function FlowArrow() {
  return (
    <div className="flex w-8 shrink-0 items-center justify-center text-accent" aria-hidden>
      <svg width="28" height="16" viewBox="0 0 28 16">
        <path d="M0 8 H18" stroke="currentColor" strokeWidth="1.6" />
        <path d="M16 3 L24 8 L16 13" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    </div>
  );
}
