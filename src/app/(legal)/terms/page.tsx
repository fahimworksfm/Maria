export const metadata = { title: "Terms · Tether" };

export default function TermsPage() {
  return (
    <article className="prose-tether">
      <h1 className="h1">Terms of Service</h1>
      <p className="muted">Last updated: 2026-05-11</p>

      <p className="mt-6">By creating an account on Tether you agree to these terms. They&apos;re short on purpose.</p>

      <Section title="1. Who can use Tether">
        You must be at least 18 years old (or the legal age of consent in your jurisdiction, whichever is higher). One account per person.
      </Section>

      <Section title="2. What Tether is">
        Tether is a private digital space for two people: shared notes, memories, journal prompts, planning, and one private vault per user. It is provided as-is, with no warranty of any kind. The service is offered free of charge and is operated as a personal project.
      </Section>

      <Section title="3. Your content">
        You own the content you upload. By uploading, you grant us the limited right to store, transmit, and display it to you and your paired partner — only for the purpose of running the service. We do not sell, share, or analyze your content for advertising. AI features (when enabled) transmit relevant content to the configured AI provider (e.g. Groq) to generate the requested output; see our <a className="underline" href="/privacy">Privacy Policy</a> for specifics.
      </Section>

      <Section title="4. What you may not do">
        <ul className="list-disc pl-6 space-y-1">
          <li>Upload content that is illegal, infringing, threatening, or contains another person&apos;s personal data without their consent.</li>
          <li>Use the service to harass anyone, including your paired partner.</li>
          <li>Attempt to break the service, evade access controls, or access another couple&apos;s data.</li>
          <li>Use automated means to scrape, mine, or stress-test the service.</li>
        </ul>
      </Section>

      <Section title="5. Accounts and pairing">
        Each couple is a container of exactly two paired users. Pairing requires both parties to consent (one creates an invite code, the other enters it). Either party may unpair or delete their account; doing so may make shared content inaccessible to the other party.
      </Section>

      <Section title="6. Termination">
        You may delete your account at any time by contacting the operator. We may suspend or terminate accounts that violate these terms.
      </Section>

      <Section title="7. No warranty, limitation of liability">
        The service is provided &quot;as is&quot; without warranty. To the maximum extent permitted by law, we are not liable for any indirect, incidental, or consequential damages, lost data, or lost profits arising from your use of Tether.
      </Section>

      <Section title="8. Changes">
        We may update these terms; material changes will be posted on this page with a new &quot;last updated&quot; date. Continued use after a change constitutes acceptance.
      </Section>

      <Section title="9. Contact">
        Operated as a personal project. For questions or data requests, contact the person who shared Tether with you (the account operator).
      </Section>

      <p className="muted text-xs mt-12">
        These terms are written in plain language and are not legal advice. They are a good-faith summary of how Tether operates. If you need formal legal guarantees, this service is not appropriate for you.
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
