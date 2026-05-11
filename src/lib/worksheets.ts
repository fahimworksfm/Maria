// Predefined couples worksheets. Lightweight, conversation-starting — not
// clinical instruments. Each sheet is a list of questions; some are multiple-
// choice (each option carries a score for a particular category), some are
// free-text reflections.

export type Question =
  | {
      kind: "choice";
      id: string;
      text: string;
      options: Array<{ value: string; label: string; tags?: string[] }>;
    }
  | {
      kind: "text";
      id: string;
      text: string;
      placeholder?: string;
    };

export type Worksheet = {
  id: string;
  title: string;
  intro: string;
  outro: string;
  questions: Question[];
  // Build a summary string given the user's answers (id -> value/text).
  summarize: (answers: Record<string, string>) => string;
};

export const WORKSHEETS: Worksheet[] = [
  {
    id: "love-languages",
    title: "Love Languages — a starter",
    intro:
      "Five categories: words of affirmation, acts of service, gifts, quality time, physical touch. Pick the option that feels closest. There are no right answers — just signals.",
    outro:
      "Compare your top one or two with your partner's. If they don't match, that's not a problem — it's a map.",
    questions: choice(
      ["When I feel most loved, it's when…", { acts: "they handled something I'd been dreading", time: "we spent unhurried time, no phones", words: "they told me something specific they appreciate", gifts: "they brought me something small that they knew I'd like", touch: "they held me long enough that I exhaled" }],
      ["I show love most easily by…", { acts: "doing the practical thing that needs doing", time: "clearing space to just be together", words: "saying it, out loud", gifts: "noticing what they'd want and getting it", touch: "the small, instinctive touches" }],
      ["When we've been distant, what I miss most is…", { words: "the warm specific things they say", time: "their full attention", touch: "their hand on my back", acts: "the way they look out for me", gifts: "the small thoughtful surprises" }],
      ["A 'good day' with you means…", { time: "we had a long stretch together with nothing to do", acts: "you made the day easier for me", words: "you said something I'll think about later", touch: "we were physically close for most of it", gifts: "you noticed something I needed" }],
      ["The pettiest thing I'll never admit hurt me…", { acts: "you didn't notice I was struggling and just do it", words: "you didn't say thank you for that thing", touch: "you didn't reach for me first", time: "you kept your headphones on", gifts: "you forgot a small thing I'd mentioned" }],
    ),
    summarize: (a) => {
      const counts: Record<string, number> = {};
      for (const v of Object.values(a)) counts[v] = (counts[v] ?? 0) + 1;
      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      const label: Record<string, string> = { words: "Words of affirmation", acts: "Acts of service", gifts: "Gifts", time: "Quality time", touch: "Physical touch" };
      const top = sorted.slice(0, 2).map(([k]) => label[k] ?? k).join(" + ");
      return `Top: ${top || "—"}`;
    },
  },
  {
    id: "attachment-style",
    title: "Attachment Styles — a soft intro",
    intro:
      "This is not a diagnosis. Pick the answer closest to what you do when things feel hard. The styles aren't fixed; just patterns.",
    outro:
      "Talk about which patterns you saw growing up. The point isn't to label — it's to know what each of you reaches for under stress.",
    questions: choice(
      ["When we have a fight, my first instinct is to…", { anxious: "want to talk it through right now and feel close again", avoidant: "go quiet and get some space", secure: "name what's happening and ask for what I need" }],
      ["When you're upset and I don't know why, I…", { anxious: "feel responsible until you tell me it's not me", avoidant: "give you space and wait for you to bring it up", secure: "ask once, simply, then let it land" }],
      ["When we go a few days with less contact, I feel…", { anxious: "wobbly", avoidant: "fine, often relieved", secure: "fine, but I miss them" }],
      ["When you reach for me, I most often…", { secure: "lean in", anxious: "lean in but check if it's real", avoidant: "feel a tiny flinch before I let go" }],
      ["The hardest sentence for me to say is…", { anxious: "I don't need you to fix it", avoidant: "I need you", secure: "I'm sorry, here's what I'll do differently" }],
    ),
    summarize: (a) => {
      const counts: Record<string, number> = {};
      for (const v of Object.values(a)) counts[v] = (counts[v] ?? 0) + 1;
      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      const label: Record<string, string> = { anxious: "Leaning anxious", avoidant: "Leaning avoidant", secure: "Leaning secure" };
      return `Pattern: ${label[sorted[0]?.[0] ?? ""] ?? "—"}`;
    },
  },
  {
    id: "conflict-styles",
    title: "Conflict Styles",
    intro:
      "When the two of you disagree, you each have a default. Knowing each other's default is half the work.",
    outro:
      "Share your top tendency with your partner and tell them what you wish they'd do instead when they spot it.",
    questions: choice(
      ["In an argument, I tend to…", { compete: "push my point harder", avoid: "go quiet or change the subject", accommodate: "drop my side to keep the peace", compromise: "look for a middle", collaborate: "slow down and try to actually understand" }],
      ["When you raise something I did wrong, I usually…", { compete: "defend or counter", avoid: "shut down", accommodate: "apologise quickly to end it", collaborate: "ask questions" }],
      ["After we fight, what I most want is…", { collaborate: "to debrief and learn from it", avoid: "to never talk about it again", accommodate: "reassurance that we're okay", compete: "for you to admit I was right" }],
      ["A repair move I rarely make…", { compete: "admitting I overreacted", avoid: "circling back unprompted", accommodate: "actually saying what bothered me", collaborate: "asking what you needed in the moment" }],
      ["I'm best in conflict when…", { collaborate: "we're both slow and honest", compete: "I feel respected and not dismissed", avoid: "we cool off first", accommodate: "you go first" }],
    ),
    summarize: (a) => {
      const counts: Record<string, number> = {};
      for (const v of Object.values(a)) counts[v] = (counts[v] ?? 0) + 1;
      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      const label: Record<string, string> = { compete: "Competer", avoid: "Avoider", accommodate: "Accommodator", compromise: "Compromiser", collaborate: "Collaborator" };
      return `Default: ${label[sorted[0]?.[0] ?? ""] ?? "—"}`;
    },
  },
];

function choice(
  ...qs: Array<[string, Record<string, string>]>
): Question[] {
  return qs.map(([text, opts], i) => ({
    kind: "choice" as const,
    id: `q${i + 1}`,
    text,
    options: Object.entries(opts).map(([value, label]) => ({ value, label })),
  }));
}
