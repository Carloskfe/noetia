import type { Type } from '@nestjs/common';

/**
 * Conditional registration of KnowledgeModule (NEM-019 §5.6). DEFAULT OFF.
 *
 * This file deliberately imports nothing from knowledge/*: when the flag is
 * off, the module's code is never required, the module is not loaded, and no
 * `knowledge` route exists. Only the exact string 'true' enables it.
 */
export const KNOWLEDGE_MODULE_FLAG = 'KNOWLEDGE_MODULE_ENABLED';

export function isKnowledgeModuleEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[KNOWLEDGE_MODULE_FLAG] === 'true';
}

export function knowledgeModules(env: NodeJS.ProcessEnv = process.env): Type<unknown>[] {
  if (!isKnowledgeModuleEnabled(env)) return [];
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { KnowledgeModule } = require('./knowledge.module');
  return [KnowledgeModule];
}
