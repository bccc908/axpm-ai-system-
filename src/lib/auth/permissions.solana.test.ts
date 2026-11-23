import { describe, expect, it } from "vitest";
import {
  NAV_MODULE,
  moduleForPath,
  modulesForRole,
  roleCanAccessModule,
  roleCanAccessPath,
} from "@/lib/auth/permissions";
import type { UserRole } from "@/lib/auth/types";

const PATH = "/dashboard/solana-bot";
const BLOCKED: UserRole[] = ["customer", "sales", "finance", "personal", "viewer"];

describe("solana bot watch page access", () => {
  it("maps the route to the solana module, not a client module", () => {
    expect(moduleForPath(PATH)).toBe("solana");
    expect(moduleForPath(`${PATH}/extra`)).toBe("solana");
    expect(NAV_MODULE[PATH]).toBe("solana");
    expect(moduleForPath(PATH)).not.toBe("market");
    expect(moduleForPath(PATH)).not.toBe("overview");
  });

  it("allows owner and admin only", () => {
    for (const role of ["owner", "admin"] as const) {
      expect(modulesForRole(role)).toContain("solana");
      expect(roleCanAccessModule(role, "solana")).toBe(true);
      expect(roleCanAccessPath(role, PATH)).toBe(true);
    }
  });

  it("hides the page from customer and other non-admin roles", () => {
    for (const role of BLOCKED) {
      expect(modulesForRole(role)).not.toContain("solana");
      expect(roleCanAccessModule(role, "solana")).toBe(false);
      expect(roleCanAccessPath(role, PATH)).toBe(false);
    }
  });

  it("does not grant solana by hanging it off fortune or account", () => {
    expect(roleCanAccessPath("customer", "/dashboard/fortune")).toBe(true);
    expect(roleCanAccessPath("customer", "/dashboard/account")).toBe(true);
    expect(roleCanAccessPath("customer", PATH)).toBe(false);
  });
});
