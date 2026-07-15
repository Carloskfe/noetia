import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Unblock OAuth accounts stuck behind the email-confirmation gate.
 *
 * Users who signed in with Google/Facebook/Apple before emailConfirmed was set
 * on creation were left emailConfirmed=false, so EmailConfirmedGuard rejects
 * their requests — and there is no remedy in-app, because OAuth users never
 * receive (or can resend) a confirmation email (that flow is local-provider
 * only). Their email is already verified by the provider, so confirm them.
 *
 * The code path (upsertOAuthUser) now self-heals on next login; this clears the
 * backlog immediately without requiring a re-login. Idempotent.
 */
export class ConfirmOAuthUserEmails1748300000063 implements MigrationInterface {
  name = 'ConfirmOAuthUserEmails1748300000063';

  async up(runner: QueryRunner): Promise<void> {
    const result = await runner.query(
      `UPDATE users SET "emailConfirmed" = true
       WHERE provider <> 'local' AND "emailConfirmed" = false`,
    );
    const affected = Array.isArray(result) ? result[1] : (result?.rowCount ?? 0);
    // eslint-disable-next-line no-console
    console.log(`[ConfirmOAuthUserEmails] confirmed ${affected ?? 0} OAuth user(s)`);
  }

  async down(): Promise<void> {
    // Intentional no-op — re-unconfirming provider-verified emails would only
    // re-trap these users behind the gate.
  }
}
