"use client";

import { useEffect, useState } from "react";

type Mode = "absolute" | "relative" | "date" | "time";

export default function LocalTime({ iso, mode = "absolute" }: { iso: string; mode?: Mode }) {
  const [text, setText] = useState<string>("");

  useEffect(() => {
    function render() {
      setText(format(iso, mode));
    }
    render();
    if (mode === "relative") {
      const id = window.setInterval(render, 60_000);
      return () => window.clearInterval(id);
    }
  }, [iso, mode]);

  return <span suppressHydrationWarning>{text}</span>;
}

function format(iso: string, mode: Mode): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  if (mode === "date") return d.toLocaleDateString();
  if (mode === "time") return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  if (mode === "relative") return relative(d);
  return d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function relative(d: Date): string {
  const diff = Date.now() - d.getTime();
  const sec = Math.round(diff / 1000);
  if (sec < 45) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;

  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfThat = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDelta = Math.round((startOfToday - startOfThat) / 86_400_000);
  if (dayDelta === 1) return `yesterday, ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  if (dayDelta < 7) return `${dayDelta}d ago`;
  if (sameYear) return d.toLocaleDateString([], { month: "short", day: "numeric" });
  return d.toLocaleDateString([], { year: "numeric", month: "short", day: "numeric" });
}
