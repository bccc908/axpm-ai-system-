import { performLogin } from "@/lib/auth/perform-login";

export async function POST(request: Request) {
  return performLogin(request, "staff");
}
