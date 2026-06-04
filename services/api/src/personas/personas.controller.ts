import {
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserPersona } from './user-persona.entity';
import { PersonaComputerService } from './persona-computer.service';

@Controller('admin/personas')
@UseGuards(JwtAuthGuard)
export class PersonasController {
  constructor(
    private readonly computer: PersonaComputerService,
    @InjectRepository(UserPersona)
    private readonly personaRepo: Repository<UserPersona>,
  ) {}

  /** Trigger a full recompute for all active users. Admin only. */
  @Post('recompute')
  async recomputeAll(@Request() req: { user: { isAdmin: boolean } }) {
    if (!req.user.isAdmin) throw new ForbiddenException();
    void this.computer.computeAll().catch(() => {});
    return { message: 'Persona recompute started' };
  }

  /** Trigger recompute for a single user. Admin only. */
  @Post(':userId/recompute')
  async recomputeOne(
    @Param('userId') userId: string,
    @Request() req: { user: { isAdmin: boolean } },
  ) {
    if (!req.user.isAdmin) throw new ForbiddenException();
    const persona = await this.computer.computeForUser(userId);
    return persona;
  }

  /** Fetch the current persona for a user. Admin only. */
  @Get(':userId')
  async getPersona(
    @Param('userId') userId: string,
    @Request() req: { user: { isAdmin: boolean } },
  ) {
    if (!req.user.isAdmin) throw new ForbiddenException();
    const persona = await this.personaRepo.findOneBy({ userId });
    if (!persona) throw new NotFoundException(`No persona computed yet for user ${userId}`);
    return persona;
  }
}
