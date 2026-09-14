import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #1d4ed8 0%, #0a0f1a 100%)",
        }}
      >
        <div style={{ fontSize: 96, fontWeight: 800, color: "white" }}>G</div>
      </div>
    ),
    { ...size },
  );
}
