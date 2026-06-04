import { z } from "zod";
import type { JobPriority } from "@/types/personal";

export const JOB_PRIORITIES: JobPriority[] = ["low", "medium", "urgent"];

export const jobPrioritySchema = z.preprocess(
  (v) => (v === "high" ? "urgent" : v),
  z.enum(["low", "medium", "urgent"]),
);
