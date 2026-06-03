"use client";

export default function PrintButton() {
  return (
    <button className="btn btn-primary cta-glow" onClick={() => window.print()}>
      Save as PDF / Print
    </button>
  );
}
