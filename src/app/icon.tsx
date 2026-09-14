import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
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
          borderRadius: 96,
        }}
      >
        <div
          style={{
            fontSize: 200,
            fontWeight: 800,
            color: "white",
            letterSpacing: -8,
          }}
        >
          G
        </div>
      </div>
    ),
    { ...size },
  );
}
