export type JobPriority = "low" | "medium" | "urgent";
export type JobStatus = "todo" | "in_progress" | "done" | "cancelled";
export type PlanPeriod = "daily" | "weekly";

export interface PersonalJob {
  id: string;
  title: string;
  description: string | null;
  category: string;
  priority: JobPriority;
  status: JobStatus;
  due_at: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

export interface WorkLogEntry {
  id: string;
  title: string;
  content: string;
  category: string;
  duration_minutes: number | null;
  logged_at: string;
  created_at: string;
}

export interface PlanItem {
  id: string;
  text: string;
  done: boolean;
}

export interface PlanEntry {
  id: string;
  title: string;
  period: PlanPeriod;
  plan_date: string;
  notes: string | null;
  items: PlanItem[];
  created_at: string;
  updated_at: string;
}

export interface TodoPhoto {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  uploaded_at: string;
}

export interface PersonalTodo {
  id: string;
  title: string;
  notes: string | null;
  done: boolean;
  priority: JobPriority;
  due_at: string | null;
  photos?: TodoPhoto[];
  created_at: string;
  completed_at: string | null;
}

export interface PersonalData {
  jobs: PersonalJob[];
  workLogs: WorkLogEntry[];
  plans: PlanEntry[];
  todos: PersonalTodo[];
}
