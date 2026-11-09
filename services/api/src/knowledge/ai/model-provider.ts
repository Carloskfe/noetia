import { SegmentOrigin } from '../knowledge.types';
import { VerifiedContext } from './verified-context';

export interface AnswerSegment {
  origin: SegmentOrigin;
  text: string;
  /** Book a `library` segment cites; must be in the allowed set. */
  bookId?: string;
}

export interface ToolCall {
  name: string;
  bookId: string;
}

export interface ProviderResponse {
  outcome: 'success' | 'failure' | 'aborted';
  /** null = usage unknown. */
  unitsReported: number | null;
  segments: AnswerSegment[];
  toolCalls: ToolCall[];
}

export interface ModelProvider {
  readonly id: string;
  readonly modelKey: string;
  /** Only simulated providers may be registered under NEM-019. */
  readonly simulated: boolean;
  invoke(context: VerifiedContext, signal: AbortSignal): Promise<ProviderResponse>;
}

export const MODEL_PROVIDERS = Symbol('MODEL_PROVIDERS');
