import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { JobsModule } from './jobs/jobs.module';

const ENV = process.env.NODE_ENV;

@Module({
  imports: [
    ConfigModule.forRoot(
      {
        envFilePath: !ENV ? '.env' : `.env.${ENV}`,
        isGlobal: true,
      }
    ),
    ScheduleModule.forRoot(),
    JobsModule
  ],
})
export class AppModule { }
