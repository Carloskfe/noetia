/**
 * Environment indicator for the STAGING deployment (NEM-006A).
 *
 * Renders a small fixed "STAGING" ribbon ONLY when NEXT_PUBLIC_APP_ENV === 'staging'.
 * In production (and dev) that variable is unset, so this component returns null and
 * has zero visual/behavioral effect — production application behavior is unchanged.
 * Its sole purpose is to prevent a tester from mistaking staging for production.
 */
export default function StagingBanner() {
  if (process.env.NEXT_PUBLIC_APP_ENV !== 'staging') return null;

  return (
    <div
      aria-label="Staging environment"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: '#b8791a',
        color: '#fff',
        textAlign: 'center',
        fontSize: '12px',
        fontWeight: 700,
        letterSpacing: '0.12em',
        padding: '3px 8px',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        pointerEvents: 'none',
      }}
    >
      STAGING · NOT PRODUCTION
    </div>
  );
}
