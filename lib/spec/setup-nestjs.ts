import { DatabaseCleaner } from "typeorm-database-cleaner";
import { connection, SpecHelper } from "./helper";
import * as sinon from 'sinon';

before(async () => {
  await SpecHelper.setup();
  await DatabaseCleaner.clean(connection);
});

after(async () => {
  await SpecHelper.teardown();
});

beforeEach(async () => {
  await DatabaseCleaner.clean(connection);
});

afterEach(() => {
  sinon.restore();
});
