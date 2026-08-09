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

// Prompt without echoing, so the password doesn't sit in the scrollback (or in
// a screenshot pasted somewhere later).
function askHidden(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    let promptWritten = false;
    rl._writeToOutput = (str) => {
      if (!promptWritten) {
        rl.output.write(str);
        promptWritten = true;
      }
      // Every later write is a keystroke echo — swallow it.
    };
    rl.question(question, (answer) => {
      rl.output.write("\n");
      rl.close();
      resolve(answer);
    });
  });
}

async function listUsers(admin) {
  const all = [];
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    all.push(...data.users);
    if (data.users.length < 200) break;
  }
  return all;
}

const arg = process.argv[2];
if (!arg) {
  console.error("Usage: node scripts/set-password.mjs <email>");
  console.error("       node scripts/set-password.mjs --list   (show registered accounts)");
  process.exit(1);
}
const listOnly = arg === "--list" || arg === "-l";

const fileEnv = loadEnvLocal();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || fileEnv.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || fileEnv.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (env or .env.local).");
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const users = await listUsers(admin);

function describe(u) {
  const confirmed = u.email_confirmed_at ? "confirmed" : "UNCONFIRMED";
  const seen = u.last_sign_in_at ? `last sign-in ${u.last_sign_in_at.slice(0, 10)}` : "never signed in";
  return `  ${u.email ?? "(no email)"}  —  ${confirmed}, ${seen}`;
}

if (listOnly) {
  console.log(`${users.length} account(s) in this Supabase project:\n`);
  for (const u of users) console.log(describe(u));
  process.exit(0);
}

const email = arg;
const user = users.find((u) => (u.email ?? "").toLowerCase() === email.toLowerCase());
if (!user) {
  console.error(`No account with email ${email}. Registered accounts:\n`);
  for (const u of users) console.error(describe(u));
  console.error("\nRe-run with one of the addresses above.");
  process.exit(1);
}

// Look the user up before prompting, so a typo can't waste a typed password.
const password = (await askHidden(`New password for ${email} (not shown): `)).trim();
if (password.length < 6) {
  console.error("Supabase requires at least 6 characters.");
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
