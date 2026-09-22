"use client";

import { useEffect, useRef, useState } from "react";
import { Box, Typography } from "@mui/material";
import { colors } from "@/app/theme";

// Backend log lines are prefixed with an emoji for terminal-friendly reading
// server-side (🚀 📦 🔨 ✅ ❌), but that clashes with this panel's otherwise
// plain monospace/muted-color treatment — strip the leading emoji + space
// before rendering.
const LEADING_EMOJI = /^\p{Extended_Pictographic}️?\s*/u;

function stripLeadingEmoji(message: string): string {
  return message.replace(LEADING_EMOJI, "");
}

interface ParsedLog {
  id: string;
  message: string;
  type: "info" | "error" | "success";
}

interface DeploymentLogsPanelProps {
  deploymentId: string;
}

export function DeploymentLogsPanel({ deploymentId }: DeploymentLogsPanelProps) {
  const [logs, setLogs] = useState<ParsedLog[]>([]);
  const [connectionState, setConnectionState] = useState<"connecting" | "open" | "reconnecting">(
    "connecting"
  );
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const es = new EventSource(`/api/log/${encodeURIComponent(deploymentId)}`);

    es.onopen = () => {
      setConnectionState("open");
    };

    es.onerror = () => {
      // Native EventSource auto-reconnects; surface that state to the user
      // instead of leaving the log panel silently stalled.
      setConnectionState("reconnecting");
    };

    es.onmessage = (event) => {
      let message = event.data;
      let type: ParsedLog["type"] = "info";

      try {
        const json = JSON.parse(event.data);
        if (json.Message) message = json.Message;
        if (json.Type === 1 || json.Type === "Error") type = "error";
        else if (json.Type === 2 || json.Type === "Success") type = "success";
      } catch {
        // Plain-text log line.
      }

      setLogs((prev) => [
        ...prev,
        { id: `${Date.now()}-${Math.random()}`, message: stripLeadingEmoji(message), type },
      ]);
    };

    return () => es.close();
  }, [deploymentId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  return (
    <Box
      sx={{
        mt: 2,
        p: 2,
        height: 220,
        overflowY: "auto",
        bgcolor: colors.bgSunken,
        border: `1px solid ${colors.borderDefault}`,
        borderRadius: "8px",
        fontFamily: "var(--font-geist-mono)",
        fontSize: "12px",
      }}
    >
      {connectionState === "reconnecting" && (
        <Typography sx={{ color: colors.warning, fontSize: "12px", fontStyle: "italic", mb: 1 }}>
          Reconnecting to log stream…
        </Typography>
      )}
      {logs.length === 0 ? (
        <Typography sx={{ color: colors.textFaint, fontSize: "12px", fontStyle: "italic" }}>
          Waiting for build output…
        </Typography>
      ) : (
        logs.map((log) => (
          <Box
            key={log.id}
            sx={{
              color:
                log.type === "error" ? colors.error : log.type === "success" ? colors.success : "#cfcdd2",
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
            }}
          >
            {log.message}
          </Box>
        ))
      )}
      <div ref={endRef} />
    </Box>
  );
}
