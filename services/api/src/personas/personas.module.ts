import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserPersona } from './user-persona.entity';
import { PersonaComputerService } from './persona-computer.service';
import { PersonasController } from './personas.controller';

@Module({
  imports: [TypeOrmModule.forFeature([UserPersona])],
  providers: [PersonaComputerService],
  controllers: [PersonasController],
  exports: [PersonaComputerService],
})
export class PersonasModule {}
