import LegalPage from '../LegalPage';
import { PRIVACY_POLICY_ES, PRIVACY_POLICY_EN } from '@/lib/legal/privacy-policy';

export const metadata = {
  title: 'Política de Privacidad / Privacy Policy — Noetia',
};

export default function PrivacyPage() {
  return (
    <LegalPage
      titleEs="Política de Privacidad"
      titleEn="Privacy Policy"
      contentEs={PRIVACY_POLICY_ES}
      contentEn={PRIVACY_POLICY_EN}
    />
  );
}
