import { describe, expect, it } from "vitest";
import {
  NEUTRAL_SENDER_LABEL_FALLBACK,
  resolveWeChatWorkSenderLabel,
} from "./sender-label";

describe("resolveWeChatWorkSenderLabel (Compliance Hold B4)", () => {
  it("uses the workspace display name when set", () => {
    expect(
      resolveWeChatWorkSenderLabel({
        workspaceDisplayName: "  Acme Trading Sdn Bhd  ",
        env: { WECHAT_WORK_SENDER_USERID: "zhangsan", WORKSPACE_DISPLAY_NAME: "Env Name" },
      }),
    ).toBe("Acme Trading Sdn Bhd");
  });

  it("falls back to WORKSPACE_DISPLAY_NAME env, then the WeCom sender userid", () => {
    expect(
      resolveWeChatWorkSenderLabel({ env: { WORKSPACE_DISPLAY_NAME: "Env Name", WECHAT_WORK_SENDER_USERID: "zhangsan" } }),
    ).toBe("Env Name");
    expect(resolveWeChatWorkSenderLabel({ env: { WECHAT_WORK_SENDER_USERID: "zhangsan" } })).toBe("zhangsan");
  });

  it("falls back to the neutral label when nothing is configured (incl. blank values)", () => {
    expect(resolveWeChatWorkSenderLabel({ env: {} })).toBe(NEUTRAL_SENDER_LABEL_FALLBACK);
    expect(
      resolveWeChatWorkSenderLabel({
        workspaceDisplayName: "   ",
        env: { WORKSPACE_DISPLAY_NAME: "", WECHAT_WORK_SENDER_USERID: "  " },
      }),
    ).toBe("Kayden Chiew CRM");
  });

  it("never returns an AXPM label", () => {
    const label = resolveWeChatWorkSenderLabel({ env: {} });
    expect(label).not.toMatch(/axpm/i);
  });
});
