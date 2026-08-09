// Set a user's password directly, without sending any email.
//
// Supabase's built-in email service does not reliably deliver to addresses
// outside the project's org members, and this app has no password-reset flow
// wired up, so the dashboard's "send recovery link" is a dead end. This uses
// the Admin API (service-role key) to set the password in place.
//
// Usage:  node scripts/set-password.mjs <email>
// The new password is read from stdin so it never lands in shell history.
//
// Reads NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the
// environment, falling back to .env.local.

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline";

function loadEnvLocal() {
  let raw;
  try {
    raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  } catch {
    return {};
  }
  const out = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (a) => { rl.close(); resolve(a); }));
}

async function findUserByEmail(admin, email) {
  const target = email.toLowerCase();
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    const hit = data.users.find((u) => (u.email ?? "").toLowerCase() === target);
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
  return null;
}

const email = process.argv[2];
if (!email) {
  console.error("Usage: node scripts/set-password.mjs <email>");
  process.exit(1);
}

const fileEnv = loadEnvLocal();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || fileEnv.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || fileEnv.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (env or .env.local).");
  process.exit(1);
}

const password = (await ask(`New password for ${email}: `)).trim();
if (password.length < 6) {
  console.error("Supabase requires at least 6 characters.");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

const user = await findUserByEmail(admin, email);
if (!user) {
  console.error(`No auth user found with email ${email}.`);
  console.error("Check the exact address in Supabase → Authentication → Users.");
  process.exit(1);
}

// email_confirm ensures an unconfirmed signup can sign in afterwards.
const { error } = await admin.auth.admin.updateUserById(user.id, { password, email_confirm: true });
if (error) {
  console.error(`Failed to update password: ${error.message}`);
  process.exit(1);
}

console.log(`\nPassword updated for ${email} (user ${user.id}).`);
console.log("She can now sign in at /login. No email involved.");
