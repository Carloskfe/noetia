import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { MetricsModule } from './metrics/metrics.module';
import { MetricsMiddleware } from './metrics/metrics.middleware';
import { ClubsModule } from './clubs/clubs.module';
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
import { CodesModule } from './codes/codes.module';
import { WaitlistModule } from './waitlist/waitlist.module';
import { CausesModule } from './causes/causes.module';
import { GiftsModule } from './gifts/gifts.module';
import { PushModule } from './push/push.module';
import { StatsModule } from './stats/stats.module';
import { EventsModule } from './events/events.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      { name: 'global', ttl: 60_000, limit: 120 },
    ]),
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
    MetricsModule,
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
    CodesModule,
    WaitlistModule,
    CausesModule,
    GiftsModule,
    PushModule,
    ClubsModule,
    StatsModule,
    EventsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(MetricsMiddleware).forRoutes('*');
  }
}
