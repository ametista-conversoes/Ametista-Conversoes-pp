import { renderToStaticMarkup } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import PrivacyPolicy from '../src/pages/legal/PrivacyPolicy'
import PrivacyPolicyEn from '../src/pages/legal/PrivacyPolicyEn'
import TermsOfUse from '../src/pages/legal/TermsOfUse'
import TermsOfUseEn from '../src/pages/legal/TermsOfUseEn'

const pages = {
  '/privacy': PrivacyPolicy,
  '/privacy/en': PrivacyPolicyEn,
  '/terms': TermsOfUse,
  '/terms/en': TermsOfUseEn,
} as const

export function renderLegalPage(path: keyof typeof pages): string {
  const Page = pages[path]
  return renderToStaticMarkup(
    <StaticRouter location={path}>
      <Page />
    </StaticRouter>,
  )
}
