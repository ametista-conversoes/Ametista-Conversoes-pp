import { LegalPageLayout } from '@/components/legal/LegalPageLayout'

/** Tradução da política em `PrivacyPolicy.tsx` — mesma estrutura e
 * numeração de seção, pra ficar fácil conferir as duas lado a lado.
 * Sem troca de idioma automática: se o conteúdo em português mudar,
 * esse arquivo precisa ser atualizado à mão junto. */
export default function PrivacyPolicyEn() {
  return (
    <LegalPageLayout title="Privacy Policy" lastUpdated="September 28, 2026" lang="en">
      <section>
        <h2>1. Who we are</h2>
        <p>
          Ametista Conversões is the internal platform of the Ametista Conversões agency ("we", "our agency"), used
          to manage our clients' projects and report to them the results of the campaigns we run on their behalf.
          This policy explains what data the app collects, what we use it for, who we share it with, and what
          rights you have over it, in accordance with Brazil's General Data Protection Law (LGPD — Law No.
          13,709/2018).
        </p>
      </section>

      <section>
        <h2>2. What data we collect</h2>
        <p>Depending on how you use the app, we collect:</p>
        <ul>
          <li><strong>Account data</strong>: name, email, phone number and access role (admin, manager or client).</li>
          <li>
            <strong>Data registered about agency clients</strong>: name, company, email, phone, plan, monthly fee,
            internal notes, and business assumptions used to estimate revenue (e.g. leads needed to close 1 sale,
            average ticket).
          </li>
          <li>
            <strong>Ad campaign metrics</strong>: spend, clicks, impressions and conversions, automatically synced
            from the Google Ads and Meta Ads accounts you connect — always aggregated campaign-level data, never
            personal data about who saw or clicked the ad.
          </li>
          <li>
            <strong>Google Forms responses</strong>: when a lead-capture form is connected, we sync that form's
            questions and responses — which may include personal data of the respondent (name, email, phone, open
            answers). This data belongs to the agency client who created the form; we process it on their behalf.
          </li>
          <li>
            <strong>Conversations with Cassie (AI assistant)</strong> and with the Persuasive Copy tool — the
            content of the messages exchanged, including, when relevant, excerpts of form responses used as
            context.
          </li>
          <li>
            <strong>Files and comments</strong> submitted through the Client Portal or the Manager Portal, including
            audio messages.
          </li>
          <li>
            <strong>Push notification subscription</strong>: a technical identifier for your browser/device, used
            only to deliver notifications — we cannot read anything beyond that from it.
          </li>
        </ul>
      </section>

      <section>
        <h2>3. Google user data (Google Ads and Google Forms)</h2>
        <p>
          When you connect a Google account, the app requests 3 permissions (scopes), always with the explicit
          consent of whoever connects it:
        </p>
        <ul>
          <li>
            <strong>forms.body.readonly</strong> and <strong>forms.responses.readonly</strong>: a client shares
            their lead form with our agency account as editor, and the app reads the form's questions and responses
            to build an audience breakdown and lead funnel in that client's report. Both are read-only; the body
            scope alone has no answers, and the responses scope alone lacks the question text needed to label them
            — so both are used together.
          </li>
          <li>
            <strong>adwords</strong>: we connect our manager (MCC) account once; the app lists the client accounts
            under it and reads campaigns, ad groups and metrics (spend, clicks, impressions, conversions) for
            reporting. The Google Ads API offers no narrower or read-only scope, so <strong>adwords</strong> is the
            only option; the app never creates, edits or deletes anything in Google Ads.
          </li>
        </ul>
        <p>
          Data is shown only to our agency and the respective client, protected by row-level security (see section
          6), and is never sold or shared outside the service providers listed in section 5.
        </p>
        <p>
          Ametista Conversões' use of information received from Google APIs will adhere to the{' '}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noreferrer"
            className="text-purple-400 hover:underline"
          >
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements.
        </p>
        <p>
          You can revoke this access at any time — from the app itself (Digital Assets → Integrations → "Disconnect
          integration") or directly from your Google Account, at{' '}
          <a
            href="https://myaccount.google.com/permissions"
            target="_blank"
            rel="noreferrer"
            className="text-purple-400 hover:underline"
          >
            myaccount.google.com/permissions
          </a>
          .
        </p>
      </section>

      <section>
        <h2>4. What we use this data for</h2>
        <ul>
          <li>Operating the app: showing dashboards, tasks, projects, reports, and enabling communication between agency and client.</li>
          <li>Syncing real campaign metrics for performance reports.</li>
          <li>Generating Cassie's replies and persuasive copy suggestions, using AI.</li>
          <li>Sending relevant notifications (meetings, tasks, alerts, incidents).</li>
          <li>Keeping an audit log of important actions, for security.</li>
        </ul>
      </section>

      <section>
        <h2>5. Who we share it with</h2>
        <p>
          We do not sell data. We share it only with service providers that operate the app, each receiving only
          what it needs for its function:
        </p>
        <ul>
          <li><strong>Supabase</strong> — hosts the database, authentication, uploaded files and server logic.</li>
          <li>
            <strong>OpenAI</strong> — receives the content of messages exchanged with Cassie and with Persuasive
            Copy, to generate the replies. This data, including any form-response excerpt used as context, is not
            used to train AI models — neither by Ametista Conversões nor by OpenAI.
          </li>
          <li>
            <strong>Google</strong> — when you connect an account (login, Google Ads, Google Forms), we exchange
            authentication data and sync metrics/responses with the Google API.
          </li>
          <li><strong>Meta</strong> — same logic, for connected Meta Ads accounts.</li>
          <li><strong>Vercel</strong> — hosts the app's website.</li>
          <li>Your browser's push notification providers (e.g. Google/Mozilla) — only deliver the notification, cannot read its content.</li>
        </ul>
      </section>

      <section>
        <h2>6. How we protect the data</h2>
        <ul>
          <li>Each agency client only sees their own data — enforced by database access rules (Row Level Security), not just in the UI.</li>
          <li>Access tokens for Google/Meta Ads accounts are encrypted, never stored in plain text.</li>
          <li>All communication between your browser and the app is done over HTTPS.</li>
        </ul>
      </section>

      <section>
        <h2>7. How long we keep it</h2>
        <p>
          We keep the data for as long as your account or relationship with the agency is active. When an account
          or contract ends, data can be deleted upon request, subject to legal retention periods where applicable
          (e.g. tax records).
        </p>
      </section>

      <section>
        <h2>8. Your rights (LGPD)</h2>
        <p>You may, at any time, request:</p>
        <ul>
          <li>Confirmation of what data we hold about you and access to it.</li>
          <li>Correction of incomplete, outdated or incorrect data.</li>
          <li>Deletion of your data, when there is no legal basis to keep it.</li>
          <li>Portability of the data to another provider.</li>
          <li>Withdrawal of consent, when processing depends on it.</li>
        </ul>
        <p>Requests can be made through the email at the bottom of this page.</p>
      </section>

      <section>
        <h2>9. Cookies</h2>
        <p>
          We only use the local storage necessary to keep you logged in (login session). We do not use tracking or
          third-party advertising cookies.
        </p>
      </section>

      <section>
        <h2>10. Minors</h2>
        <p>The app is a professional/business tool, not directed at anyone under 18 years old.</p>
      </section>

      <section>
        <h2>11. Changes to this policy</h2>
        <p>We may update this page as the app evolves. The date at the top always indicates the most recent version.</p>
      </section>

      <section>
        <h2>12. Contact</h2>
        <p>Questions or requests about your data: ametistaconversoes@gmail.com</p>
      </section>
    </LegalPageLayout>
  )
}
