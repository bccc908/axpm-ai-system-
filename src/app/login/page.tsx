"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { LoginScreen } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="premium-canvas flex min-h-dvh items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      }
    >
      <LoginScreen space="staff" />
    </Suspense>
  );
}
