"use client";

import { useState } from "react";

export default function CopyButton({ url, name }: { url: string; name: string | null }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const payload = {
      title: "Tether",
      text: `${name ? name + " " : ""}wants to share a Tether with you 💗`,
      url,
    };
    try {
      const nav = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
      if (nav.share) {
        await nav.share(payload);
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      // user cancelled share; ignore
    }
  }

  return (
    <button type="button" className="btn btn-primary cta-glow w-full text-base py-3" onClick={share}>
      {copied ? "Copied ✓" : "Share invite link"}
    </button>
  );
}
