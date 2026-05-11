import { cookies } from "next/headers";

const COOKIE = "tether_vault";

export async function isVaultUnlocked(userId: string): Promise<boolean> {
  const c = await cookies();
  const v = c.get(COOKIE)?.value;
  if (!v) return false;
  try {
    const [uid, expiry] = v.split("|");
    if (uid !== userId) return false;
    const expMs = Number(expiry);
    return Number.isFinite(expMs) && Date.now() < expMs;
  } catch {
    return false;
  }
}

export async function unlockVault(userId: string, minutes = 30) {
  const c = await cookies();
  const expMs = Date.now() + minutes * 60 * 1000;
  c.set(COOKIE, `${userId}|${expMs}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: minutes * 60,
    path: "/",
  });
}

export async function lockVault() {
  const c = await cookies();
  c.delete(COOKIE);
}
