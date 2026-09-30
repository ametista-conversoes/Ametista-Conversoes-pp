import { LegalPageLayout } from '@/components/legal/LegalPageLayout'

/** Tradução dos termos em `TermsOfUse.tsx` — mesma estrutura e
 * numeração de seção, pra ficar fácil conferir as duas lado a lado.
 * Sem troca de idioma automática: se o conteúdo em português mudar,
 * esse arquivo precisa ser atualizado à mão junto. */
export default function TermsOfUseEn() {
  return (
    <LegalPageLayout title="Terms of Use" lastUpdated="September 28, 2026" lang="en" altLangHref="/terms">
      <section>
        <h2>1. Acceptance</h2>
        <p>By creating an account or using Ametista Conversões, you agree to these terms. If you do not agree, do not use the app.</p>
      </section>

      <section>
        <h2>2. What the service is</h2>
        <p>
          Ametista Conversões is a management platform for performance marketing agencies — it centralizes the
          operation between agency and client (projects, tasks, files, comments, meetings, performance reports). It
          does not replace the advertising tools themselves (Google Ads, Meta Ads) nor marketing automation
          platforms — it only organizes and reports.
        </p>
      </section>

      <section>
        <h2>3. Accounts and access roles</h2>
        <p>
          There are 3 roles: admin and manager (agency staff) and client (access to their own portal). You are
          responsible for keeping your password confidential and for everything that happens using your account.
        </p>
      </section>

      <section>
        <h2>4. Acceptable use</h2>
        <ul>
          <li>Do not attempt to access another agency client's data beyond your own.</li>
          <li>Do not use the app for illegal purposes or in ways that violate third-party rights.</li>
          <li>Do not attempt to bypass the app's security measures.</li>
        </ul>
      </section>

      <section>
        <h2>5. Data ownership</h2>
        <p>The data you or your client register remains yours. We only use that data to operate the app, as described in the Privacy Policy.</p>
      </section>

      <section>
        <h2>6. Third-party integrations</h2>
        <p>
          By connecting Google Ads, Google Forms or Meta Ads, you are also subject to those platforms' terms of
          use. We are not responsible for the availability or operation of Google's and Meta's APIs.
        </p>
      </section>

      <section>
        <h2>7. Service availability</h2>
        <p>
          We make reasonable efforts to keep the app available, but it is offered "as is", with no guarantee of
          uninterrupted operation. Maintenance and instability may occur.
        </p>
      </section>

      <section>
        <h2>8. Limitation of liability</h2>
        <p>
          We are not responsible for business decisions made based on data shown in the app, nor for unavailability
          or errors of third-party platforms (Google, Meta, Supabase, OpenAI) outside our control.
        </p>
      </section>

      <section>
        <h2>9. Account termination</h2>
        <p>You may request the closure of your account at any time. We may suspend or terminate accounts that violate these terms.</p>
      </section>

      <section>
        <h2>10. Changes to these terms</h2>
        <p>We may update these terms as the app evolves. The date at the top always indicates the most recent version.</p>
      </section>

      <section>
        <h2>11. Governing law</h2>
        <p>These terms are governed by the laws of Brazil.</p>
      </section>

      <section>
        <h2>12. Contact</h2>
        <p>Questions about these terms: ametistaconversoes@gmail.com</p>
      </section>
    </LegalPageLayout>
  )
}
