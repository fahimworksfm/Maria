"use client";

import { useMemo, useState } from "react";

type Card = { id: string; text: string };

export default function AffirmationDeck({ cards }: { cards: Card[] }) {
  const initial = useMemo(() => Math.floor(Math.random() * cards.length), [cards.length]);
  const [idx, setIdx] = useState(initial);
  const [flipping, setFlipping] = useState(false);

  function draw() {
    if (cards.length < 2) return;
    setFlipping(true);
    setTimeout(() => {
      let next = idx;
      while (next === idx) next = Math.floor(Math.random() * cards.length);
      setIdx(next);
      setTimeout(() => setFlipping(false), 60);
    }, 220);
  }

  const card = cards[idx];

  return (
    <div className="card p-6 space-y-4 text-center">
      <div className="muted text-xs">A card for now</div>
      <div
        className="mx-auto select-none"
        style={{
          width: "100%",
          maxWidth: 360,
          aspectRatio: "5 / 7",
          perspective: 1000,
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            position: "relative",
            transition: "transform 0.45s",
            transformStyle: "preserve-3d",
            transform: flipping ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
        >
          <CardFace text={card?.text ?? ""} />
          <CardFace back text={card?.text ?? ""} />
        </div>
      </div>
      <button className="btn btn-primary cta-glow" onClick={draw}>Draw another</button>
      <div className="muted text-xs">{cards.length} cards in the deck</div>
    </div>
  );
}

function CardFace({ text, back = false }: { text: string; back?: boolean }) {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        backfaceVisibility: "hidden",
        transform: back ? "rotateY(180deg)" : "rotateY(0deg)",
        borderRadius: 20,
        background: "linear-gradient(160deg, rgba(249,115,115,0.18), rgba(168,123,255,0.18))",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 20px 40px -10px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 32,
      }}
    >
      <p className="font-display text-2xl leading-snug">{text}</p>
    </div>
  );
}
