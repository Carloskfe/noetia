import { Controller, Get, Param } from '@nestjs/common';
import { CollectionsService } from './collections.service';

@Controller('collections')
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  @Get()
  findAll() {
    return this.collectionsService.findAll();
  }

  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.collectionsService.findBySlug(slug);
  }
}
