import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';

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
  ],
})
export class AppModule { }
