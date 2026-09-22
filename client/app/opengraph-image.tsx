import { ImageResponse } from "next/og";

export const alt = "DeployBox — Push to a GitHub repo, get a live URL.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#17161b",
          backgroundImage:
            "radial-gradient(circle at 25% 15%, rgba(236,48,19,0.25), transparent 45%)",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 36 }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              backgroundColor: "#ec3013",
              display: "flex",
            }}
          />
          <div style={{ fontSize: 44, fontWeight: 800, color: "#f3f2f2", letterSpacing: "-0.02em" }}>
            DeployBox
          </div>
        </div>
        <div
          style={{
            fontSize: 56,
            fontWeight: 700,
            color: "#f3f2f2",
            textAlign: "center",
            lineHeight: 1.15,
            maxWidth: 900,
          }}
        >
          Push to a GitHub repo.
        </div>
        <div
          style={{
            fontSize: 56,
            fontWeight: 700,
            color: "#ec3013",
            textAlign: "center",
            lineHeight: 1.15,
            marginBottom: 28,
          }}
        >
          Get a live URL.
        </div>
        <div style={{ fontSize: 24, color: "#9b979d", textAlign: "center" }}>
          No Dockerfile. No config files. No credit card.
        </div>
      </div>
    ),
    { ...size },
  );
}
