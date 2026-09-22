"use client";

import { trpc } from "@/app/lib/trpc/client";
import { useState, useEffect, useRef } from "react";
import { ProjectsHeader } from "../projects/_components/ProjectsHeader";

interface ParsedLog {
  id: string;
  raw: string;
  message: string;
  type?: "info" | "error" | "success" | string;
  timestamp?: string;
}

export default function PlaygroundPage() {
  const [targetId, setTargetId] = useState("");
  const [singleMessage, setSingleMessage] = useState("");
  const [logs, setLogs] = useState<ParsedLog[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);

  // Denylist tester state (acts on the logged-in user's own session only)
  const [ttlInput, setTtlInput] = useState<number>(60);
  const [denylistResult, setDenylistResult] = useState<string | null>(null);

  const eventSourceRef = useRef<EventSource | null>(null);
  const terminalEndRef = useRef<HTMLDivElement | null>(null);

  const publishLog = trpc.deployments.simulateBuildLogs.useMutation();
  const triggerOrchestrator = trpc.deployments.triggerOrchestratorJob.useMutation();

  // Denylist tRPC mutations/queries — scoped to the caller's own session server-side
  const revokeTokenMutation = trpc.auth.revokeToken.useMutation();
  const checkTokenQuery = trpc.auth.checkTokenRevoked.useQuery(undefined, {
    refetchInterval: 3000,
  });

  // Connect / Disconnect SSE stream
  const connectStream = (idToConnect: string) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    if (!idToConnect.trim()) return;

    const es = new EventSource(`/api/log/${encodeURIComponent(idToConnect.trim())}`);
    eventSourceRef.current = es;

    es.onopen = () => {
      setIsConnected(true);
    };

    es.onmessage = (event) => {
      const rawData = event.data;
      let parsedMessage = rawData;
      let logType = "info";
      let timestamp = new Date().toLocaleTimeString();

      try {
        const json = JSON.parse(rawData);
        if (json.Message) parsedMessage = json.Message;
        if (json.Timestamp) timestamp = new Date(json.Timestamp).toLocaleTimeString();
        if (json.Type !== undefined) {
          if (json.Type === 0 || json.Type === "Info") logType = "info";
          else if (json.Type === 1 || json.Type === "Error") logType = "error";
          else if (json.Type === 2 || json.Type === "Success") logType = "success";
        }
      } catch {
        if (rawData.toLowerCase().includes("error") || rawData.toLowerCase().includes("failed")) {
          logType = "error";
        } else if (rawData.toLowerCase().includes("success") || rawData.toLowerCase().includes("successfully")) {
          logType = "success";
        }
      }

      setLogs((prev) => [
        ...prev,
        {
          id: `${Date.now()}-${Math.random()}`,
          raw: rawData,
          message: parsedMessage,
          type: logType,
          timestamp,
        },
      ]);
    };

    es.onerror = () => {
      setIsConnected(false);
    };
  };

  const disconnectStream = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsConnected(false);
  };

  useEffect(() => {
    return () => {
      disconnectStream();
    };
  }, []);

  useEffect(() => {
    if (autoScroll && terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoScroll]);

  const handleSendSingleLog = async () => {
    if (!targetId || !singleMessage) return;
    await publishLog.mutateAsync({ deploymentId: targetId, message: singleMessage });
    setSingleMessage("");
  };

  const handleTriggerOrchestrator = async () => {
    if (!targetId) return;
    if (!window.confirm(`Queue a real orchestrator job for deployment ${targetId}?`)) return;
    if (!isConnected) {
      connectStream(targetId);
    }
    await triggerOrchestrator.mutateAsync({ deploymentId: targetId });
  };

  const handleRevokeToken = async () => {
    if (!window.confirm("This will revoke your current session token and sign you out. Continue?")) return;
    const res = await revokeTokenMutation.mutateAsync({
      expiresInSeconds: ttlInput,
      reason: "Manual playground revocation (own session)",
    });
    setDenylistResult(JSON.stringify(res, null, 2));
    checkTokenQuery.refetch();
  };

  return (
    <div className="min-h-screen bg-[#121115] text-[#f3f2f2] font-sans">
      <ProjectsHeader />
      <div className="max-w-5xl mx-auto p-8 space-y-8">
        
        {/* Header */}
        <div className="border-b border-[#3a383f] pb-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">DeployBox Developer Playground</h1>
            <p className="text-sm text-[#9b979d]">
              Live SSE log streaming &amp; Redis Denylist (TTL) Tester.
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <span
              className={`w-3 h-3 rounded-full ${
                isConnected ? "bg-[#4fbf79] animate-pulse" : "bg-red-500"
              }`}
            />
            <span className="text-xs font-mono uppercase text-[#cfcdd2]">
              {isConnected ? "Connected (Live)" : "Disconnected"}
            </span>
          </div>
        </div>

        {/* SECTION 1: REDIS DENYLIST & TTL TESTER */}
        <div className="bg-[#1b1a20] border-2 border-[#3a383f] p-6 rounded-lg space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>🚫 Redis Denylist &amp; TTL Manager</span>
            </h2>
            <span className="text-xs font-mono bg-[#26252b] border border-[#3a383f] text-[#7db8d8] px-2 py-1 rounded">
              Pattern: denylist:token:&lt;jti&gt;
            </span>
          </div>

          <p className="text-xs text-[#9b979d]">
            Revoke your own current session token with a specific TTL in seconds. When the TTL expires, Redis automatically cleans up the key!
          </p>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-[#9b979d] uppercase mb-1">
                Your Session JTI
              </label>
              <input
                className="w-full bg-[#0f0e12] border border-[#3a383f] rounded px-3 py-2 text-sm font-mono text-white/60 cursor-not-allowed"
                value={checkTokenQuery.data?.jtiOrToken ?? "loading…"}
                readOnly
                disabled
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#9b979d] uppercase mb-1">
                TTL (Seconds)
              </label>
              <input
                type="number"
                className="w-full bg-[#0f0e12] border border-[#3a383f] rounded px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-[#ec3013]"
                value={ttlInput}
                onChange={(e) => setTtlInput(Number(e.target.value))}
                placeholder="60"
              />
            </div>
            <div>
              <button
                onClick={handleRevokeToken}
                disabled={revokeTokenMutation.isPending}
                className="w-full bg-[#ec3013] hover:bg-[#ff563c] text-white font-bold py-2 px-4 text-sm rounded shadow transition disabled:opacity-50"
              >
                {revokeTokenMutation.isPending ? "Revoking..." : "Revoke My Token (signs you out)"}
              </button>
            </div>
          </div>

          {/* Status Display Card */}
          <div className="bg-[#0f0e12] border border-[#2a292f] p-4 rounded font-mono text-xs space-y-2">
            <div className="flex items-center justify-between border-b border-[#2a292f] pb-2">
              <span className="text-[#9b979d]">Redis Live Key:</span>
              <code className="text-[#7db8d8]">{checkTokenQuery.data?.key ?? "—"}</code>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#9b979d]">Revocation Status:</span>
              <span
                className={`font-bold px-2 py-0.5 rounded text-xs ${
                  checkTokenQuery.data?.isRevoked
                    ? "bg-red-900/50 text-red-400 border border-red-500"
                    : "bg-green-900/50 text-green-400 border border-green-500"
                }`}
              >
                {checkTokenQuery.data?.isRevoked ? "REVOKED (IN DENYLIST)" : "ACTIVE (VALID)"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[#9b979d]">Remaining TTL:</span>
              <span className="text-amber-400 font-bold">
                {checkTokenQuery.data?.ttl !== undefined && checkTokenQuery.data.ttl > 0
                  ? `${checkTokenQuery.data.ttl} seconds left`
                  : checkTokenQuery.data?.ttl === -2
                  ? "Expired / Not in Redis"
                  : "No TTL / Active"}
              </span>
            </div>
            {denylistResult && (
              <div className="mt-2 pt-2 border-t border-[#2a292f]">
                <span className="text-[#9b979d] block mb-1">Mutation Output:</span>
                <pre className="text-xs text-[#4fbf79] bg-[#141318] p-2 rounded overflow-x-auto">
                  {denylistResult}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* SECTION 2: LIVE SSE LOGGING & ORCHESTRATOR */}
        <div className="bg-[#1b1a20] border-2 border-[#3a383f] p-6 rounded-lg space-y-5">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>📡 Live Log Streamer (.NET Orchestrator &amp; SSE)</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-[#9b979d] uppercase mb-1">
                Your Deployment ID (Redis Channel: logs:id)
              </label>
              <input
                className="w-full bg-[#0f0e12] border border-[#3a383f] rounded px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-[#ec3013]"
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                placeholder="paste a deployment ID you own"
              />
            </div>
            <div>
              {isConnected ? (
                <button
                  onClick={disconnectStream}
                  className="w-full bg-red-600/20 border border-red-500 text-red-400 hover:bg-red-600/30 px-4 py-2 text-sm font-semibold rounded transition"
                >
                  Disconnect Stream
                </button>
              ) : (
                <button
                  onClick={() => connectStream(targetId)}
                  disabled={!targetId.trim()}
                  className="w-full bg-[#4fbf79] hover:bg-[#3ea567] text-[#0f0e12] disabled:opacity-50 px-4 py-2 text-sm font-bold rounded transition"
                >
                  Subscribe to Live Logs
                </button>
              )}
            </div>
          </div>

          <hr className="border-[#2a292f]" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-[#9b979d] uppercase">
                Option A: Direct Publish (tRPC → Redis Publish)
              </label>
              <div className="flex space-x-2">
                <input
                  className="flex-1 bg-[#0f0e12] border border-[#3a383f] rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-[#ec3013]"
                  value={singleMessage}
                  onChange={(e) => setSingleMessage(e.target.value)}
                  placeholder="Type test log line..."
                  onKeyDown={(e) => e.key === "Enter" && handleSendSingleLog()}
                />
                <button
                  onClick={handleSendSingleLog}
                  disabled={!targetId || !singleMessage || publishLog.isPending}
                  className="bg-[#2a292f] hover:bg-[#3a383f] text-white border border-[#5a5760] disabled:opacity-50 px-4 py-2 text-sm font-semibold rounded transition"
                >
                  {publishLog.isPending ? "Sending..." : "Publish"}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-[#9b979d] uppercase">
                Option B: .NET Orchestrator (Redis List deploy:queue)
              </label>
              <button
                onClick={handleTriggerOrchestrator}
                disabled={!targetId || triggerOrchestrator.isPending}
                className="w-full bg-[#ec3013] hover:bg-[#ff563c] text-white font-bold py-2 px-4 text-sm rounded shadow transition flex items-center justify-center space-x-2"
              >
                <span>⚡ Trigger .NET Orchestrator Worker</span>
              </button>
            </div>
          </div>
        </div>

        {/* Live Terminal Log Stream Container */}
        <div className="bg-[#0f0e12] border-2 border-[#3a383f] rounded-lg overflow-hidden shadow-2xl">
          <div className="bg-[#141318] px-4 py-2.5 border-b border-[#2a292f] flex items-center justify-between">
            <div className="flex items-center space-x-2 font-mono text-xs text-[#9b979d]">
              <span className="text-[#4fbf79]">●</span>
              <span>LIVE LOG STREAM ({logs.length} lines)</span>
            </div>
            <div className="flex items-center space-x-4 text-xs font-mono">
              <label className="flex items-center space-x-1 cursor-pointer text-[#cfcdd2]">
                <input
                  type="checkbox"
                  checked={autoScroll}
                  onChange={(e) => setAutoScroll(e.target.checked)}
                  className="rounded border-[#3a383f] bg-[#0f0e12]"
                />
                <span>Auto-scroll</span>
              </label>
              <button
                onClick={() => setLogs([])}
                className="text-[#9b979d] hover:text-white transition"
              >
                Clear Console
              </button>
            </div>
          </div>

          <div className="p-4 h-80 overflow-y-auto font-mono text-xs space-y-1.5 bg-[#09080c]">
            {logs.length === 0 ? (
              <div className="text-[#63616a] italic py-8 text-center">
                No logs received yet. Enter a Deployment ID, click &quot;Subscribe to Live Logs&quot;, and trigger a log!
              </div>
            ) : (
              logs.map((log) => {
                let colorClass = "text-[#cfcdd2]";
                if (log.type === "error") colorClass = "text-[#ff6b57]";
                else if (log.type === "success") colorClass = "text-[#4fbf79]";

                return (
                  <div key={log.id} className="flex space-x-3 leading-relaxed hover:bg-white/5 px-1 py-0.5 rounded">
                    <span className="text-[#63616a] shrink-0 select-none">[{log.timestamp}]</span>
                    <span className={`${colorClass} break-all`}>{log.message}</span>
                  </div>
                );
              })
            )}
            <div ref={terminalEndRef} />
          </div>
        </div>

      </div>
    </div>
  );
}
