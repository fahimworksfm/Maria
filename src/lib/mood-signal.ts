import type { SupabaseClient } from "@supabase/supabase-js";
import { pushEnabled, sendToUser } from "@/lib/push";

// Moods at or below this (1=😞, 2=😕) are treated as a "heavy day".
export const LOW_MOOD_THRESHOLD = 2;

export type MoodPrefs = {
  // Default ON: partner gets the gentle "heavy day" nudge.
  mood_signal: boolean;
  // Default OFF: the nudge includes the actual score.
  mood_share_score: boolean;
};

export function readMoodPrefs(prefs: unknown): MoodPrefs {
  const p = (prefs ?? {}) as Record<string, unknown>;
  return {
    mood_signal: p.mood_signal !== false, // default true
    mood_share_score: p.mood_share_score === true, // default false
  };
}

/**
 * Keeps the partner-visible mood signal in sync with a freshly saved mood.
 * - low mood + nudge opted in  -> upsert a signal (score only if opted in),
 *   and push the partner once per day (on first low signal).
 * - otherwise (mood improved, or opted out) -> clear today's signal.
 *
 * Uses the caller's user-scoped client so RLS applies (the user can only write
 * their own signal). Never throws into the save path — empathy is best-effort.
 */
export async function applyMoodSignal(
  supabase: SupabaseClient,
  args: { userId: string; coupleId: string; mood: number; onDate: string }
): Promise<void> {
  try {
    const { data: prof } = await supabase
      .from("profiles")
      .select("prefs, display_name")
      .eq("user_id", args.userId)
      .single();
    const { mood_signal, mood_share_score } = readMoodPrefs(prof?.prefs);
    const isLow = args.mood <= LOW_MOOD_THRESHOLD;

    if (!isLow || !mood_signal) {
      await supabase
        .from("mood_signals")
        .delete()
        .eq("from_user", args.userId)
        .eq("on_date", args.onDate);
      return;
    }

    // Was there already a signal today? (only push on the first one)
    const { data: existing } = await supabase
      .from("mood_signals")
      .select("id")
      .eq("from_user", args.userId)
      .eq("on_date", args.onDate)
      .maybeSingle();

    await supabase.from("mood_signals").upsert(
      {
        couple_id: args.coupleId,
        from_user: args.userId,
        on_date: args.onDate,
        level: "low",
        mood: mood_share_score ? args.mood : null,
      },
      { onConflict: "from_user,on_date" }
    );

    if (!existing && pushEnabled()) {
      const { data: partner } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("couple_id", args.coupleId)
        .neq("user_id", args.userId)
        .limit(1)
        .maybeSingle();
      if (partner?.user_id) {
        const name = prof?.display_name ?? "Your partner";
        // Push stays gentle and score-free regardless of share setting
        // (lock-screen exposure); the exact score, if shared, shows in-app.
        await sendToUser(partner.user_id, {
          title: "Tether",
          body: `${name} is having a heavy day. A pulse might help. 💗`,
          url: "/pulse",
          vibrate: [120, 60, 120],
        });
      }
    }
  } catch {
    // best-effort; never break the mood save
  }
}

/** Clears today's signal — used when a user opts out of mood signals. */
export async function clearTodaySignal(
  supabase: SupabaseClient,
  userId: string,
  onDate: string
): Promise<void> {
  try {
    await supabase.from("mood_signals").delete().eq("from_user", userId).eq("on_date", onDate);
  } catch {
    /* ignore */
  }
}
