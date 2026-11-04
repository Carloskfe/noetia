// Staging setup is read-only: the fixture and administrator already exist.
import { FIXTURE_TITLE } from './cases.mjs';
import { STAGING } from './guard.mjs';

/** Confirms the pinned staging fixture is what's expected. Never creates or changes it. */
export async function verifyStagingFixture(client) {
  const res = await client.request('GET', `/books?search=${encodeURIComponent('Cuaderno de pruebas de citas')}`);
  const found = Array.isArray(res.body) ? res.body.filter((b) => b.title === FIXTURE_TITLE) : [];
  if (found.length !== 1) throw new Error(`Expected exactly one staging fixture, found ${found.length}. Nothing was changed; ask the operator to check.`);
  const [book] = found;
  if (book.id !== STAGING.fixtureBookId) throw new Error(`The staging fixture has an unexpected id: ${book.id}`);
  if (book.uploadedById !== STAGING.adminId) throw new Error('The staging fixture has an unexpected uploader');
  if (book.isPublished !== true) throw new Error('The staging fixture is not published');
  return { id: book.id, textFileKey: book.textFileKey ?? null, reused: true, preexisting: true };
}
