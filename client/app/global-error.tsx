"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  // This only renders if the root layout itself throws, so it can't rely on
  // the app's fonts/providers/theme — kept as plain HTML/inline styles.
  return (
    <html lang="en">
      <body
        style={{
          minHeight: "100vh",
          margin: 0,
          background: "#17161b",
          color: "#f3f2f2",
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "16px",
          textAlign: "center",
          padding: "0 24px",
        }}
      >
        <h1 style={{ fontSize: 22, margin: 0 }}>Something went wrong</h1>
        <p style={{ fontSize: 14, color: "#9b979d", maxWidth: 420, margin: 0 }}>
          An unexpected error occurred. Please try again.
        </p>
        <button
          onClick={reset}
          style={{
            marginTop: 8,
            padding: "10px 20px",
            borderRadius: 6,
            border: "1px solid #3a383f",
            background: "#201f24",
            color: "#f3f2f2",
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
