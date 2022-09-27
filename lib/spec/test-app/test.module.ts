import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TestRelated } from "./test-related.entity";
import { TestController } from "./test.controller";
import { Test } from "./test.entity";

@Module({
	imports: [TypeOrmModule.forFeature([TestRelated, Test])],
	controllers: [TestController]
})
export class TestModule {}