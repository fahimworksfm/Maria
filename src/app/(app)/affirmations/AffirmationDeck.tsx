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
    <div className="card p-5 space-y-4 text-center">
      <p className="label !mb-0">A card for now</p>
      <div
        className="mx-auto select-none"
        style={{
          width: "100%",
          maxWidth: 320,
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
      <button type="button" className="btn btn-primary w-full" onClick={draw}>Draw another</button>
      <p className="text-muted text-[13px]">{cards.length} cards in the deck</p>
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
        // The drawn card is the one message on this screen, so it takes the
        // accent the way your own bubbles do.
        background: "rgb(var(--c-prim-bg))",
        color: "rgb(var(--c-prim-fg))",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 28,
      }}
    >
      <p className="font-bold text-2xl leading-snug tracking-[-0.01em]">{text}</p>
    </div>
  );
}
