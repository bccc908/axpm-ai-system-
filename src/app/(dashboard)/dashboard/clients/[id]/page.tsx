import { ContactDetail } from "@/components/crm/contact-detail";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ContactDetail clientId={id} />;
}
