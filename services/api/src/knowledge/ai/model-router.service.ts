import { Inject, Injectable } from '@nestjs/common';
import { MODEL_PATHS, ModelPathId } from './model-paths';
import { MODEL_PROVIDERS, ModelProvider } from './model-provider';

/**
 * Router (interface + simulated-only implementation). Refuses any provider not
 * marked simulated, so no real provider can be reached under NEM-019.
 */
@Injectable()
export class ModelRouterService {
  constructor(@Inject(MODEL_PROVIDERS) private readonly providers: ModelProvider[]) {}

  select(pathId: ModelPathId): ModelProvider {
    if (!(pathId in MODEL_PATHS)) throw new Error('unregistered model path');
    const provider = this.providers.find((p) => p.simulated === true);
    if (!provider) throw new Error('no simulated provider registered');
    return provider;
  }
}
