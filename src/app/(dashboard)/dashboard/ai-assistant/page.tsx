import { redirect } from "next/navigation";

export default async function AiAssistantPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams({ tab: "reply-agent" });
  if (params.client) query.set("client", params.client);
  redirect(`/dashboard/conversations?${query.toString()}`);
}
