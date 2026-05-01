import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthModule } from './health/health.module';
import { StorageModule } from './storage/storage.module';
import { AuthModule } from './auth/auth.module';
import { BooksModule } from './books/books.module';
import { FragmentsModule } from './fragments/fragments.module';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { AuthorsModule } from './authors/authors.module';
import { SharingModule } from './sharing/sharing.module';
import { SocialModule } from './social/social.module';
import { UsersModule } from './users/users.module';
import { LibraryModule } from './library/library.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DB_HOST', 'db'),
        port: config.get<number>('DB_PORT', 5432),
        database: config.get('DB_NAME', 'noetia'),
        username: config.get('DB_USER', 'noetia'),
        password: config.get('DB_PASS', 'changeme'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: false,
        autoLoadEntities: true,
      }),
    }),
    HealthModule,
    StorageModule,
    AuthModule,
    BooksModule,
    FragmentsModule,
    SubscriptionsModule,
    AuthorsModule,
    SharingModule,
    SocialModule,
    UsersModule,
    LibraryModule,
  ],
})
export class AppModule {}
