import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Test } from "./test.entity";
import { TestModule } from "./test.module";

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      username: process.env.DB_USER || undefined,
      host: 'localhost',
      database: 'nestjs-psf-tests',
      entities: [Test],
      synchronize: true,
    }),

    TestModule
  ],
})
export class AppModule {};
