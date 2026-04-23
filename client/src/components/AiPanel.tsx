import { useRef, useState } from "react";
import { api } from "../lib/api";

interface Props {
  relativePath: string;
  hasApiKey: boolean;
  model: string;
  /**
   * Append the generated text to the current editor buffer. Called with the
   * full generated text.
   */
  onAccept: (text: string) => void;
}

type Status = "idle" | "streaming" | "done" | "error";

export function AiPanel({ relativePath, hasApiKey, model, onAccept }: Props) {
  const [instruction, setInstruction] = useState("");
  const [result, setResult] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function run() {
    if (!hasApiKey) return;
    if (status === "streaming") return;
    setResult("");
    setStatus("streaming");
    setErrorMsg(null);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      await api.aiExtendStream(
        relativePath,
        instruction,
        (chunk) => setResult((prev) => prev + chunk),
        ctrl.signal,
      );
      setStatus("done");
    } catch (err: any) {
      if (ctrl.signal.aborted) {
        setStatus("idle");
        return;
      }
      setErrorMsg(err?.message ?? "AI request failed");
      setStatus("error");
    }
  }

  function stop() {
    abortRef.current?.abort();
  }

  function accept() {
    if (!result.trim()) return;
    onAccept(result.trim());
    setResult("");
    setStatus("idle");
  }

  function discard() {
    setResult("");
    setStatus("idle");
    setErrorMsg(null);
  }

  return (
    <div className="side-section ai-panel">
      <h3 className="side-title">AI · Extend</h3>
      {!hasApiKey ? (
        <div className="side-empty">
          No ANTHROPIC_API_KEY. Add one to <code className="kbd">.env</code> and
          restart the server.
        </div>
      ) : (
        <>
          <textarea
            className="ai-instruction"
            placeholder="Optional instruction (default: add one new section that fits the tone)."
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            disabled={status === "streaming"}
          />
          <div className="ai-actions">
            {status !== "streaming" ? (
              <button className="btn btn-primary" onClick={run}>
                Extend this entry
              </button>
            ) : (
              <button className="btn" onClick={stop}>
                Stop
              </button>
            )}
          </div>
          {(result || status === "streaming" || status === "error") && (
            <div className={`ai-result ${status === "streaming" ? "streaming" : ""}`}>
              {result || (status === "streaming" ? "…" : "")}
            </div>
          )}
          {status === "done" && result.trim() && (
            <div className="ai-actions">
              <button className="btn btn-primary" onClick={accept}>
                Append to editor
              </button>
              <button className="btn" onClick={discard}>
                Discard
              </button>
            </div>
          )}
          {status === "error" && (
            <div className="ai-status error">{errorMsg}</div>
          )}
          <div className="ai-status">
            Model: <code className="kbd">{model}</code>. Append goes into the
            editor buffer — nothing is written to disk until you save.
          </div>
        </>
      )}
    </div>
  );
}
