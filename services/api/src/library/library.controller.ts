import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { LibraryService } from './library.service';

@Controller('library')
@UseGuards(JwtAuthGuard)
export class LibraryController {
  constructor(private readonly libraryService: LibraryService) {}

  @Get()
  getLibrary(@Request() req: any) {
    return this.libraryService.getUserLibrary(req.user.id);
  }

  @Get('ids')
  getLibraryIds(@Request() req: any) {
    return this.libraryService.getUserBookIds(req.user.id);
  }

  @Post(':bookId')
  @HttpCode(200)
  addBook(@Param('bookId') bookId: string, @Request() req: any) {
    return this.libraryService.addBook(req.user.id, bookId);
  }

  @Delete(':bookId')
  @HttpCode(204)
  removeBook(@Param('bookId') bookId: string, @Request() req: any) {
    return this.libraryService.removeBook(req.user.id, bookId);
  }
}
