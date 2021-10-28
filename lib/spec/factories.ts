import { Factory, Sequence } from '@linnify/typeorm-factory';
import { Test } from './test-app/test.entity';
import * as faker from 'faker';

export class TestFactory extends Factory<Test> {
	entity = Test;

	name = new Sequence((i: number) => `Name ${i}`)
	email = faker.internet.email();
}