import ResearchSession from '@/components/research/ResearchSession';

/**
 * NEM-024 Checkpoint D — minimal research Q&A for one existing session. Reachable by URL only (no navigation entry,
 * mission §5.1). Hidden unless the capability probe allows it (the component renders a neutral notice otherwise).
 */
export default function ResearchSessionPage({ params }: { params: { sessionId: string } }) {
  return <ResearchSession sessionId={params.sessionId} />;
}
