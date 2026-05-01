import LegalPage from '../LegalPage';
import { COOKIE_POLICY_ES, COOKIE_POLICY_EN } from '@/lib/legal/cookie-policy';

export const metadata = {
  title: 'Política de Cookies / Cookie Policy — Noetia',
};

export default function CookiesPage() {
  return (
    <LegalPage
      titleEs="Política de Cookies"
      titleEn="Cookie Policy"
      contentEs={COOKIE_POLICY_ES}
      contentEn={COOKIE_POLICY_EN}
    />
  );
}
