import { Body, Controller, Delete, Get, HttpCode, Patch, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateOnboardingDto } from './dto/update-onboarding.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getMe(@Request() req: any) {
    const user = await this.usersService.findById(req.user.id);
    if (!user) return null;
    const { passwordHash: _, ...safe } = user;
    return safe;
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me')
  async updateMe(@Request() req: any, @Body() dto: UpdateUserDto) {
    await this.usersService.update(req.user.id, dto);
    const user = await this.usersService.findById(req.user.id);
    if (!user) return null;
    const { passwordHash: _, ...safe } = user;
    return safe;
  }

  @UseGuards(JwtAuthGuard)
  @Patch('me/onboarding')
  updateOnboarding(@Request() req: any, @Body() dto: UpdateOnboardingDto) {
    return this.usersService.updateOnboarding(req.user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('me')
  @HttpCode(204)
  deleteMe(@Request() req: any) {
    return this.usersService.deleteAccount(req.user.id);
  }
}
