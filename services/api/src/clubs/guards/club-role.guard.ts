import { CanActivate, ExecutionContext, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClubMember, ClubRole } from '../club-member.entity';

export const CLUB_ROLES_KEY = 'clubRoles';

export const RequireClubRole = (...roles: ClubRole[]) =>
  (target: object, key?: string | symbol, descriptor?: PropertyDescriptor) => {
    Reflect.defineMetadata(CLUB_ROLES_KEY, roles, descriptor?.value ?? target);
    return descriptor ?? target;
  };

@Injectable()
export class ClubRoleGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(ClubMember)
    private readonly memberRepo: Repository<ClubMember>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required: ClubRole[] = this.reflector.get(CLUB_ROLES_KEY, context.getHandler()) ?? ['member', 'moderator', 'admin'];
    const req = context.switchToHttp().getRequest();
    const userId: string = req.user?.sub;
    const clubId: string = req.params?.id ?? req.params?.clubId;

    if (!userId || !clubId) throw new ForbiddenException();

    const member = await this.memberRepo.findOne({ where: { clubId, userId, status: 'active' } });
    if (!member) throw new NotFoundException('Not a member of this club');
    if (!required.includes(member.role)) throw new ForbiddenException('Insufficient club role');

    req.clubMember = member;
    return true;
  }
}
