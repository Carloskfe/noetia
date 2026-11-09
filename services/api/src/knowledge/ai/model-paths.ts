/**
 * Registry of EVERY path to a model created in knowledge/* (NEM-019 B-3,
 * AC-12a). Each path declares its context invariant and the test that proves
 * it. An architecture test fails if code calls the Gateway from a file that is
 * not registered here, or if a registered test is missing.
 */
export const MODEL_PATHS = {
  'research_session.turn': {
    invariant: 'research_session_context',
    description:
      'Every chunk, highlight, and note must belong to a selected, currently eligible book; ' +
      'highlights and notes must belong to the requesting user; planner/tool arguments must name allowed books.',
    source: 'src/knowledge/sessions/turn.service.ts',
    test: 'tests/unit/knowledge/sessions/turn.service.spec.ts',
  },
} as const;

export type ModelPathId = keyof typeof MODEL_PATHS;
