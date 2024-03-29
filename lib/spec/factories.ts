import { Factory, Sequence } from '@linnify/typeorm-factory';
import { Test } from './test-app/test.entity';
import * as faker from 'faker';
import { TestRelated } from './test-app/test-related.entity';

export class TestRelatedFactory extends Factory<TestRelated> {
	entity = TestRelated;

	name = new Sequence((i: number) => `Related ${i}`)
}

export class TestFactory extends Factory<Test> {
	entity = Test;

	name = new Sequence((i: number) => `Name ${i}`)
	email = faker.internet.email();
}