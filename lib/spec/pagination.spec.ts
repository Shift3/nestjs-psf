import { ROUTE_ARGS_METADATA } from "@nestjs/common/constants";
import { expect } from "chai";
import { Paginate, PaginateConfig, PaginateParams } from "../paginators";

describe('@Paginate', () => {
	it('interprets page query params', () => {
		const executionContext = executionContextWithQueryParams({
			page: 50,
			pageSize: 100
		})

		const factory = getPaginationFactory();
		const result = factory(executionContext);

		expect(result.page).to.eq(50);
		expect(result.pageSize).to.eq(100);
	});

	it('defaults page to 1 if not provided', () => {
		const executionContext = executionContextWithQueryParams({})

		const factory = getPaginationFactory();
		const result = factory(executionContext);

		expect(result.page).to.eq(1);
	})

	it('it passes the called url through', () => {
		const executionContext = executionContextWithQueryParams({})

		const factory = getPaginationFactory();
		const result = factory(executionContext);

		expect(result.baseUrl).to.eq('http://localhost:3000/');
	})

	it('does not allow a page size beyond the max', () => {
		const executionContext = executionContextWithQueryParams({
			pageSize: 1000
		});

		const factory = getPaginationFactory({
			maxPageSize: 10
		});
		const result = factory(executionContext);

		expect(result.pageSize).to.eq(10);
	})

	it('defaults page size to defaultPageSize if not provided', () => {
		const executionContext = executionContextWithQueryParams({});

		const factory = getPaginationFactory({
			defaultPageSize: 20
		});
		const result = factory(executionContext);

		expect(result.pageSize).to.eq(20);
	})


	it('respects pageSize query param over defaultPageSize', () => {
		const executionContext = executionContextWithQueryParams({
			pageSize: 30
		});

		const factory = getPaginationFactory({
			defaultPageSize: 20
		});
		const result = factory(executionContext);

		expect(result.pageSize).to.eq(30);
	})
})

function executionContextWithQueryParams(query: any) {
	return {
		switchToHttp: () => ({
			getRequest: () => ({
				query,
				protocol: 'http',
				baseUrl: '/',
				path: '',
				get() {
	      				return 'localhost:3000';
				},
			}),
		}),
	};
}

function getPaginationFactory(config?: PaginateConfig) {
	class SomeController {
		public test(@Paginate(config) _: PaginateParams) {}
	}
	const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, SomeController, 'test');
	const { factory, data } = args[Object.keys(args)[0]];
	return function(executionContext: any): PaginateParams {
		return factory(data || {}, executionContext);
	};
}
