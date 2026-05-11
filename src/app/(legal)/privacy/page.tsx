export const metadata = { title: "Privacy · Tether" };

export default function PrivacyPage() {
  return (
    <article className="prose-tether">
      <h1 className="h1">Privacy Policy</h1>
      <p className="muted">Last updated: 2026-05-11</p>

      <p className="mt-6">Tether is built around one principle: your private life is yours. This page explains what data we hold, where, and who can see it.</p>

      <Section title="1. What we collect">
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>Account:</strong> your email and a hashed password (handled by Supabase Auth). We never see your password in plain text.</li>
          <li><strong>Profile:</strong> the display name and birthday you enter. Your &quot;preferences&quot; (sizes, wishlist) which are visible to your paired partner only.</li>
          <li><strong>Content you create:</strong> memories, journal entries, photos and audio you upload, lists, mood check-ins, and so on. Stored in our database and storage bucket.</li>
          <li><strong>Private vault:</strong> gift ideas you enter into the vault. Stored encrypted-at-rest (Supabase default) and scoped at the database level so that <em>only your own account</em> can read them. Your partner cannot access these rows even via the API.</li>
          <li><strong>Vault PIN:</strong> stored as a salted scrypt hash, not in plain text.</li>
          <li><strong>Spotify (optional):</strong> if you connect Spotify, we store a refresh token to read your account name and create/modify the dedicated Tether playlist. We never read your other playlists, listening history, or follow data.</li>
        </ul>
      </Section>

      <Section title="2. Where data is stored">
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>Database & files:</strong> Supabase (Postgres + Storage) — the project operator is responsible for choosing the region.</li>
          <li><strong>App hosting:</strong> Vercel.</li>
          <li><strong>AI prompts:</strong> when you press an AI button (e.g. Generate ideas, Suggest a recipe), the relevant text is sent to Groq for one-shot inference. Vault contents are never sent to AI.</li>
          <li><strong>Spotify:</strong> tokens are stored server-side only; they are never exposed to the browser.</li>
        </ul>
      </Section>

      <Section title="3. Who can see your data">
        <ul className="list-disc pl-6 space-y-1">
          <li><strong>You</strong> see your own data.</li>
          <li><strong>Your paired partner</strong> sees shared-zone content (memories, journal, dates, etc.) and your readable profile preferences. They do <em>not</em> see your private vault or any mood entries you chose not to share.</li>
          <li><strong>The operator</strong> (the person who runs the Tether instance you signed up on) can technically access the database. We rely on Supabase row-level security, but service-role keys held by the operator can bypass it. If you would not be comfortable with the operator seeing something, do not put it in the app.</li>
          <li><strong>Sub-processors</strong>: Supabase, Vercel, Groq (only when AI features are used), Spotify (only when you connect it).</li>
          <li><strong>No third parties</strong> beyond those receive your data. We do not sell or trade personal information.</li>
        </ul>
      </Section>

      <Section title="4. AI specifics">
        <p>
          AI features call the Groq API with a system prompt and a user prompt containing the relevant context for the requested feature. For example, generating date ideas sends the budget/effort/weather you selected — not your full journal. Generating gift suggestions sends only your partner&apos;s <em>readable</em> preferences plus the occasion/budget you typed; it never sends your private vault rows.
        </p>
      </Section>

      <Section title="5. Cookies">
        We use cookies for authentication (session and refresh tokens) and a short-lived cookie to keep your vault unlocked for 30 minutes after you enter the PIN. We do not use third-party analytics or advertising cookies.
      </Section>

      <Section title="6. Data retention">
        Content stays until you delete it. Deleted accounts have their rows removed by cascade in the database; uploaded files in storage may take additional time to purge depending on the provider&apos;s backup policy.
      </Section>

      <Section title="7. Your rights">
        You may delete your account, request a copy of your data, or revoke Spotify access at any time. Contact the operator of your Tether instance.
      </Section>

      <Section title="8. Children">
        Tether is for users 18 and over. We do not knowingly collect data from minors.
      </Section>

      <Section title="9. Changes">
        Material changes to this policy will be posted on this page with a new &quot;last updated&quot; date.
      </Section>

      <Section title="10. Contact">
        For privacy-related questions, contact the operator who shared Tether with you.
      </Section>

      <p className="muted text-xs mt-12">
        This policy describes how Tether is built today; it is a good-faith plain-language summary, not legal advice. If you have specific regulatory requirements (GDPR, CCPA, etc.) this hobby-scale service may not satisfy them.
      </p>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="h2 mb-2">{title}</h2>
      <div className="text-sm leading-relaxed text-ink/90">{children}</div>
    </section>
  );
}
