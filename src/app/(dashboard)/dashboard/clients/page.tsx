import { redirect } from "next/navigation";

export default function ClientsPage() {
  redirect("/dashboard/crm?tab=contacts");
}
