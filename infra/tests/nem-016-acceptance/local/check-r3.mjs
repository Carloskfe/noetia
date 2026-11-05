// Compares the audit report with what seed-r3.mjs created. Exit 0 only if every
// class is right and only the two safe classes are proposed for action.
import { readFileSync } from 'node:fs';
const [seedFile, reportFile, oldKey] = process.argv.slice(2);
const seed = JSON.parse(readFileSync(seedFile, 'utf8'));
const report = JSON.parse(readFileSync(reportFile, 'utf8'));
const problems = [];
for (const cls of ['book_deleted', 'revoked_not_deleted', 'queued', 'live_book_ineligible', 'unreferenced']) {
  if (!report.keys[cls].includes(seed[cls].key)) problems.push(`${cls}: seeded key not classified there`);
  console.log(`${cls}: ${report.counts[cls]}`);
}
if (report.counts.in_use !== 1) problems.push(`in_use: ${report.counts.in_use}, expected 1`);
console.log(`in_use: ${report.counts.in_use}`);
if (!report.keys.unreferenced_before_shares.includes(oldKey)) problems.push('the object older than every share is not in unreferenced_before_shares');
console.log(`unreferenced_before_shares: ${report.counts.unreferenced_before_shares}`);
if (report.ignoredNonCards !== 1) problems.push(`ignoredNonCards: ${report.ignoredNonCards}, expected 1 (the cover)`);
console.log(`ignored non-cards: ${report.ignoredNonCards}`);
const del = [...report.proposedActions.deleteObjects].sort();
const want = [seed.book_deleted.key, seed.revoked_not_deleted.key].sort();
if (JSON.stringify(del) !== JSON.stringify(want)) problems.push(`plan would delete ${del.length} object(s), expected exactly the 2 safe ones`);
if (JSON.stringify(report.proposedActions.revokeShares) !== JSON.stringify([seed.book_deleted.id])) problems.push('plan revokes the wrong shares');
console.log(`dry-run plan: revoke ${report.proposedActions.revokeShares.length} share(s), delete ${del.length} object(s)`);
if (report.readOnly !== true) problems.push('report does not say read-only');
for (const p of problems) console.log(`WRONG ${p}`);
process.exit(problems.length ? 1 : 0);
