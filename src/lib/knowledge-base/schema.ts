import { z } from "zod";
import { KNOWLEDGE_SECTION_IDS, KNOWLEDGE_STATUSES } from "@/lib/knowledge-base/sections";

const sectionSchema = z.enum(KNOWLEDGE_SECTION_IDS);
const statusSchema = z.enum(KNOWLEDGE_STATUSES);

const titleSchema = z.string().trim().min(1, "请填写标题").max(180, "标题过长");
const bodySchema = z.string().trim().min(1, "请填写正文").max(80_000, "正文过长");
const ownerSchema = z.string().trim().min(1, "请填写负责人").max(80, "负责人姓名过长");

export const createArticleSchema = z.object({
  title: titleSchema,
  section: sectionSchema,
  body: bodySchema,
  ownerName: ownerSchema.optional(),
  status: statusSchema.optional(),
});

export const updateArticleSchema = z
  .object({
    title: titleSchema.optional(),
    section: sectionSchema.optional(),
    body: bodySchema.optional(),
    ownerName: ownerSchema.optional(),
    status: statusSchema.optional(),
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.section !== undefined ||
      value.body !== undefined ||
      value.ownerName !== undefined ||
      value.status !== undefined,
    { message: "没有可保存的修改" },
  );

export type CreateArticleInput = z.infer<typeof createArticleSchema>;
export type UpdateArticleInput = z.infer<typeof updateArticleSchema>;
