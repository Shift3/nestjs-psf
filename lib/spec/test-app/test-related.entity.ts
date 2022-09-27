import { BaseEntity, Column, CreateDateColumn, Entity, OneToOne, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";
import { Test } from "./test.entity";

@Entity()
export class TestRelated extends BaseEntity {
	@PrimaryGeneratedColumn()
	id: number;

	@Column()
	name: string;

    @OneToOne(() => Test, t => t.related)
    test: Test;
}