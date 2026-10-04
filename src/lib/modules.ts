import {
  History, Images, NotebookPen, Dices, Globe, Brain, Clapperboard, MapPin, Music, Map as MapIcon,
  ChefHat, Mic, CalendarRange, Compass, HeartHandshake, Gem, Sparkles, HeartPulse, Newspaper,
  Sprout, Mail, ClipboardList, Gift, Smile, Heart, Settings2, Gamepad2, Plane, type LucideIcon,
} from "lucide-react";

/**
 * Every space in the app, in one place.
 *
 * Grouped by what you came to do, not by who can see it — "I want to plan
 * something" is a thought people actually have, where "shared vs personal" is a
 * property of the data. Privacy hasn't been dropped, it moved to a badge on the
 * two entries where it changes what you can expect.
 */

export type ModuleBadge = "private" | "yours";

export type AppModule = {
  href: string;
  title: string;
  desc: string;
  group: GroupKey;
  Icon: LucideIcon;
  badge?: ModuleBadge;
  /** Extra search terms — what you might type looking for this. */
  keywords?: string[];
};

export type GroupKey = "today" | "remember" | "plan" | "grow" | "play" | "yours";

export type ModuleGroup = { key: GroupKey; label: string; blurb: string; defaultOpen?: boolean };

export const GROUPS: ModuleGroup[] = [
  { key: "today", label: "Us, today", blurb: "The day-to-day ones", defaultOpen: true },
  { key: "remember", label: "Remember", blurb: "Everything you've kept" },
  { key: "plan", label: "Plan something", blurb: "Things to do, watch, eat, see" },
  { key: "grow", label: "Grow together", blurb: "The deeper work" },
  { key: "play", label: "Play", blurb: "For when you just want to play" },
  { key: "yours", label: "Just yours", blurb: "Only you see these" },
];

export const MODULES: AppModule[] = [
  // Us, today
  { group: "today", Icon: Plane, href: "/together", title: "Together", desc: "Distance, countdown, good time to call.", keywords: ["distance", "globe", "visit", "timezone", "weather"] },
  { group: "today", Icon: HeartPulse, href: "/pulse", title: "Pulse", desc: "Their phone buzzes.", keywords: ["nudge", "poke", "notification"] },
  { group: "today", Icon: NotebookPen, href: "/journal", title: "Journal", desc: "A daily prompt for two.", keywords: ["prompt", "diary", "write"] },
  { group: "today", Icon: Smile, href: "/mood", title: "Mood", desc: "Daily check-in.", badge: "yours", keywords: ["feeling", "checkin"] },
  { group: "today", Icon: Sprout, href: "/gratitude", title: "Gratitude Tree", desc: "A leaf for each thanks.", keywords: ["thanks", "grateful", "leaf"] },

  // Remember
  { group: "remember", Icon: History, href: "/timeline", title: "Timeline", desc: "Your whole story, woven together.", keywords: ["history", "story"] },
  { group: "remember", Icon: Images, href: "/memories", title: "Memory Jar", desc: "Photos, notes, and moments.", keywords: ["photos", "pictures", "jar"] },
  { group: "remember", Icon: Mic, href: "/voice-letters", title: "Voice Letters", desc: "Audio for later.", keywords: ["audio", "recording", "letter"] },
  { group: "remember", Icon: Mail, href: "/postcards", title: "Postcards", desc: "A note from anywhere.", keywords: ["card", "note"] },
  { group: "remember", Icon: Compass, href: "/anniversaries", title: "Anniversaries", desc: "Countdowns to every date.", keywords: ["birthday", "dates", "countdown"] },
  { group: "remember", Icon: CalendarRange, href: "/year", title: "Year in Review", desc: "Auto-generated recap.", keywords: ["recap", "annual", "book"] },
  { group: "remember", Icon: Newspaper, href: "/digest", title: "Weekly Digest", desc: "Sunday auto-recap.", keywords: ["weekly", "summary"] },

  // Plan something
  { group: "plan", Icon: Dices, href: "/date-roulette", title: "Date Roulette", desc: "Spin up a plan for tonight.", keywords: ["date night", "idea", "tonight"] },
  { group: "plan", Icon: Globe, href: "/bucket-list", title: "Bucket List", desc: "Dreams in progress.", keywords: ["goals", "someday", "dreams"] },
  { group: "plan", Icon: MapPin, href: "/places", title: "Places", desc: "Restaurants and spots.", keywords: ["restaurant", "food", "map", "eat"] },
  { group: "plan", Icon: Clapperboard, href: "/watchlist", title: "Watchlist", desc: "Movies and shows for us.", keywords: ["movie", "film", "tv", "show", "netflix"] },
  { group: "plan", Icon: MapIcon, href: "/travel", title: "Travel", desc: "Pins and itineraries.", keywords: ["trip", "holiday", "vacation", "flight"] },
  { group: "plan", Icon: ChefHat, href: "/recipes", title: "Recipes", desc: "What we cook together.", keywords: ["cook", "food", "dinner"] },
  { group: "plan", Icon: Music, href: "/songs", title: "Our Songs", desc: "A playlist with stories.", keywords: ["music", "playlist", "spotify"] },

  // Grow together
  { group: "grow", Icon: Brain, href: "/quiz", title: "Know Me", desc: "Ask. Guess. Compare.", keywords: ["quiz", "questions", "guess"] },
  { group: "grow", Icon: ClipboardList, href: "/worksheets", title: "Worksheets", desc: "Languages, attachment, conflict.", keywords: ["exercise", "attachment", "conflict"] },
  { group: "grow", Icon: Heart, href: "/love-language", title: "Love Language", desc: "Notice the patterns.", badge: "yours", keywords: ["languages", "acts", "words"] },
  { group: "grow", Icon: HeartHandshake, href: "/repair-log", title: "Repair Log", desc: "What you both learned.", keywords: ["argument", "fight", "conflict", "apology"] },
  { group: "grow", Icon: Gem, href: "/affirmations", title: "Affirmations", desc: "Shuffle, draw, send.", keywords: ["quote", "kind", "words"] },
  { group: "grow", Icon: Sparkles, href: "/random-acts", title: "Random Acts", desc: "Tiny love-acts each week.", keywords: ["kindness", "weekly", "challenge"] },

  // Play
  { group: "play", Icon: Gamepad2, href: "/arrows", title: "Arrows", desc: "A calm puzzle for two.", keywords: ["game", "puzzle", "daily"] },

  // Just yours
  { group: "yours", Icon: Gift, href: "/vault", title: "Gift Vault", desc: "Private to you. PIN locked.", badge: "private", keywords: ["present", "surprise", "secret", "pin"] },
  { group: "yours", Icon: Settings2, href: "/profile", title: "My Preferences", desc: "Sizes, favourites, wishlist.", badge: "yours", keywords: ["settings", "profile", "wishlist", "sizes", "theme"] },
];

export function modulesInGroup(key: GroupKey): AppModule[] {
  return MODULES.filter((m) => m.group === key);
}

/** Loose match across title, description and keywords. */
export function searchModules(query: string): AppModule[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const terms = q.split(/\s+/);
  return MODULES.filter((m) => {
    const hay = `${m.title} ${m.desc} ${(m.keywords ?? []).join(" ")}`.toLowerCase();
    return terms.every((t) => hay.includes(t));
  });
}
