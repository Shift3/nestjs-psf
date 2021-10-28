import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { Connection, getConnection } from "typeorm";
import { AppModule } from "./test-app/app.module";

export let connection: Connection;
export let app: INestApplication;
export let appModule: TestingModule;

export class SpecHelper {
  public static async setup() {
    appModule = await Test.createTestingModule({
      imports: [
        AppModule,
      ]
    }).compile();


    app = appModule.createNestApplication();
    await app.init();

    connection = getConnection();
  }

  public static async teardown() {
    await connection.close();
  }
}
