import LegalPage from '../LegalPage';
import { TERMS_ES, TERMS_EN } from '@/lib/legal/terms-of-service';

export const metadata = {
  title: 'Términos de Servicio / Terms of Service — Noetia',
};

export default function TermsPage() {
  return (
    <LegalPage
      titleEs="Términos de Servicio"
      titleEn="Terms of Service"
      contentEs={TERMS_ES}
      contentEn={TERMS_EN}
    />
  );
}
