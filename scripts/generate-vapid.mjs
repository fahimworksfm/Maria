// Generate VAPID keys for Web Push. Run once: `node scripts/generate-vapid.mjs`
// then paste the values into .env.local (Vercel env vars too).

import webpush from "web-push";

const { publicKey, privateKey } = webpush.generateVAPIDKeys();
console.log("Add these to your .env.local and Vercel project:\n");
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log(`VAPID_SUBJECT=mailto:you@example.com   # change to your email`);
