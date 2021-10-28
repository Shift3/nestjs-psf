import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TestController } from "./test.controller";
import { Test } from "./test.entity";

@Module({
	imports: [TypeOrmModule.forFeature([Test])],
	controllers: [TestController]
})
export class TestModule {}