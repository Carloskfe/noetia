import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AuthorsService } from './authors.service';

@Controller('authors')
export class AuthorsController {
  constructor(private readonly authorsService: AuthorsService) {}

  @Get('me/books')
  @UseGuards(JwtAuthGuard)
  getMyBooks(@Request() req: any) {
    return this.authorsService.findMyBooks(req.user.id);
  }
}
