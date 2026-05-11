"use client";

import { useEffect, useRef, useState } from "react";
import { tap, HAPTIC } from "@/lib/haptic";

type State = "idle" | "recording" | "ready";

export default function VoiceRecorder({ name = "audio" }: { name?: string }) {
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [url, setUrl] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedRef = useRef<number>(0);
  const timerRef = useRef<number | null>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  function pickMimeType(): string {
    const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/aac"];
    for (const m of candidates) {
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(m)) return m;
    }
    return "";
  }

  async function start() {
    setError(null);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Recording isn't supported on this browser. Use upload instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const type = chunksRef.current[0]?.type || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        const ext = type.includes("mp4") ? "m4a" : "webm";
        const file = new File([blob], `voice-${Date.now()}.${ext}`, { type });
        if (hiddenRef.current) {
          const dt = new DataTransfer();
          dt.items.add(file);
          hiddenRef.current.files = dt.files;
        }
        if (url) URL.revokeObjectURL(url);
        setUrl(URL.createObjectURL(blob));
        setState("ready");
        if (timerRef.current) window.clearInterval(timerRef.current);
      };
      recorder.start();
      recorderRef.current = recorder;
      startedRef.current = Date.now();
      setSeconds(0);
      tap(HAPTIC.tap);
      timerRef.current = window.setInterval(() => {
        setSeconds(Math.floor((Date.now() - startedRef.current) / 1000));
      }, 250);
      setState("recording");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Microphone permission denied");
    }
  }

  function stop() {
    tap(HAPTIC.tap);
    recorderRef.current?.stop();
    recorderRef.current = null;
  }

  function discard() {
    if (hiddenRef.current) hiddenRef.current.value = "";
    if (url) URL.revokeObjectURL(url);
    setUrl(null);
    setState("idle");
  }

  return (
    <div className="space-y-3">
      {state === "idle" && (
        <>
          <button type="button" onClick={start} className="btn btn-primary w-full text-base py-3">
            🎙️ Record voice letter
          </button>
          <details className="text-xs muted">
            <summary className="cursor-pointer">Or upload an audio file</summary>
            <input className="input mt-2" name={name} type="file" accept="audio/*" />
          </details>
        </>
      )}
      {state === "recording" && (
        <div className="card p-3 flex items-center justify-between gap-3 border-accent/40 bg-accent/5">
          <div className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-full bg-accent animate-pulse" />
            <span className="font-mono text-sm">Recording · {formatSeconds(seconds)}</span>
          </div>
          <button type="button" onClick={stop} className="btn btn-primary text-sm">Stop</button>
        </div>
      )}
      {state === "ready" && url && (
        <div className="card p-3 space-y-2">
          <audio src={url} controls className="w-full" />
          <div className="flex justify-between items-center">
            <span className="muted text-xs">{formatSeconds(seconds)} · ready to send</span>
            <button type="button" onClick={discard} className="btn btn-ghost text-xs">Re-record</button>
          </div>
          <input ref={hiddenRef} name={name} type="file" accept="audio/*" hidden />
        </div>
      )}
      {error && <p className="text-accent text-xs">{error}</p>}
    </div>
  );
}

function formatSeconds(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}
