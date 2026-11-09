import { RightsRecord } from '../../../../src/knowledge/rights/rights.service';

export const FIXTURE_TEXT_HASH = 'sha256:fixture-text-v2';
export const RESEARCH_OP = 'research_analysis';

/** A complete, verified, invented public-domain record (no real book). */
export function verifiedRecord(over: Partial<RightsRecord> = {}): RightsRecord {
  return {
    status: 'verified',
    textHash: FIXTURE_TEXT_HASH,
    workTitle: 'Invented Fixture Treatise',
    workAuthors: ['Fixture Author'],
    authorDeathDate: '1801-01-01',
    firstPublicationDate: '1790',
    edition: 'Fixture edition',
    editionPublisher: 'Fixture Press',
    editionYear: 1890,
    textSource: 'fixture-source',
    isTranslation: false,
    translators: null,
    translatorDeathDate: null,
    translationDate: null,
    addedMaterial: 'excluded',
    sourceUrl: 'https://example.invalid/fixture',
    rightsBasis: 'public_domain',
    rightsEvidence: 'fixture evidence',
    jurisdiction: 'fixture-jurisdiction',
    permittedOperations: [RESEARCH_OP],
    verifier: 'fixture-verifier',
    verifiedAt: '2026-01-01T00:00:00Z',
    evidenceLinks: ['https://example.invalid/evidence'],
    reviewDate: '2099-01-01',
    ...over,
  };
}

