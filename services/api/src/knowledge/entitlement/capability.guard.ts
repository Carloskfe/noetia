import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IntelligenceDenied } from '../common/intelligence-denied.error';
import { Capability } from '../knowledge.types';
import { EntitlementService } from './entitlement.service';

export const CAPABILITY_METADATA = 'knowledge:capability';

/**
 * `use` — the request consumes the capability and must resolve as allowed.
 * `history` — reading the caller's own existing history; no entitlement needed,
 * because downgrade or premium end never removes history (ADR-006).
 */
export type CapabilityAccess = 'use' | 'history';

export interface CapabilityDeclaration {
  capability: Capability;
  access: CapabilityAccess;
}

/** Every knowledge route must declare a capability (NEM-019 §10). */
export const DeclareCapability = (capability: Capability, access: CapabilityAccess = 'use') =>
  SetMetadata(CAPABILITY_METADATA, { capability, access } satisfies CapabilityDeclaration);

@Injectable()
export class CapabilityGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly entitlements: EntitlementService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const decl = this.reflector.getAllAndOverride<CapabilityDeclaration | undefined>(CAPABILITY_METADATA, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    // An undeclared route fails closed.
    if (!decl) throw new IntelligenceDenied('feature_disabled');

    const req = ctx.switchToHttp().getRequest();
    const userId: string | undefined = req.user?.id;
    if (!userId) throw new IntelligenceDenied('no_entitlement');
    if (decl.access === 'history') return true;

    const r = await this.entitlements.resolve(userId, decl.capability);
    if (!r.allowed) throw new IntelligenceDenied(r.reason);
    return true;
  }
}
