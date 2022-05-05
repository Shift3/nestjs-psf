import { BaseEntity, Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

export enum SomeEnum {
	Choice1 = '1',
	Choice2 = '2',
	Choice3 = '3',
};

@Entity()
export class Test extends BaseEntity {
	@PrimaryGeneratedColumn()
	id: number;

	@Column()
	name: string;

	@Column()
	email: string;

	@Column({
		type: 'enum',
		enum: SomeEnum,
		array: true,
		default: '{}'
	})
	someArray: SomeEnum[];

	@UpdateDateColumn()
	updatedAt: Date;

	@CreateDateColumn()
	createdAt: Date;
}
