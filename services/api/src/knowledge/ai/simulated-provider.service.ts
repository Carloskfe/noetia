import { Injectable } from '@nestjs/common';
import { ModelProvider, ProviderResponse, ToolCall } from './model-provider';
import { VerifiedContext } from './verified-context';

export type SimulatedBehavior =
  | { kind: 'success'; units?: number; toolCalls?: ToolCall[] }
  | { kind: 'failure'; units: number | null }
  | { kind: 'abort' }
  | { kind: 'hang' }
  | { kind: 'throw' };

/**
 * The ONLY provider in NEM-019. No SDK, no network, no spend. Deterministic:
 * by default it succeeds and reports `items + 1` units. Tests script behaviours.
 */
@Injectable()
export class SimulatedProviderService implements ModelProvider {
  readonly id = 'simulated';
  readonly modelKey = 'simulated-v1';
  readonly simulated = true;
  private readonly script: SimulatedBehavior[] = [];
  /** Test hook, awaited before responding (e.g. to race a downgrade). */
  beforeRespond?: () => Promise<void>;

  enqueue(...behaviors: SimulatedBehavior[]) {
    this.script.push(...behaviors);
  }

  async invoke(context: VerifiedContext, signal: AbortSignal): Promise<ProviderResponse> {
    const b = this.script.shift() ?? { kind: 'success' };
    if (this.beforeRespond) await this.beforeRespond();
    switch (b.kind) {
      case 'success':
        return {
          outcome: 'success',
          unitsReported: b.units ?? context.items.length + 1,
          segments: [
            ...context.allowedBookIds.map((bookId) => ({ origin: 'library' as const, text: 'Simulated analysis.', bookId })),
            { origin: 'synthesis', text: 'Simulated synthesis.' },
          ],
          toolCalls: b.toolCalls ?? [],
        };
      case 'failure':
        return { outcome: 'failure', unitsReported: b.units, segments: [], toolCalls: [] };
      case 'abort':
        return { outcome: 'aborted', unitsReported: null, segments: [], toolCalls: [] };
      case 'throw':
        throw new Error('simulated provider error');
      case 'hang':
        return new Promise<ProviderResponse>((_, reject) => {
          signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
        });
    }
  }
}
