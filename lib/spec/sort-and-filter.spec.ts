import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { expect } from "chai";
import { SortAndFilter, SortAndFilterConfig, SortAndFilterParams } from '../sort-and-filter';

describe('@SortAndFilter', () => {
	describe('sorting', () => {
		it('interprets sort query params', () => {
			const executionContext = executionContextWithQueryParams({
				sort: 'name'
			})

			const factory = getSortAndFilterFactory();
			const result = factory(executionContext);

			expect(result.sort).to.have.key('name');
			expect(result.sort.name).to.eq('ASC');
		});

		it('interprets descending sort query params', () => {
			const executionContext = executionContextWithQueryParams({
				sort: '-name'
			})

			const factory = getSortAndFilterFactory();
			const result = factory(executionContext);

			expect(result.sort).to.contain.keys('name');
			expect(result.sort.name).to.eq('DESC');
		});

		it('handles multiple sort query params', () => {
			const executionContext = executionContextWithQueryParams({
				sort: '-name,description'
			})

			const factory = getSortAndFilterFactory();
			const result = factory(executionContext);

			expect(result.sort).to.contain.keys(['name', 'description']);
			expect(result.sort.name).to.eq('DESC');
			expect(result.sort.description).to.eq('ASC');
		});

		it('rejects attributes that are not present in sortable config', () => {
			const executionContext = executionContextWithQueryParams({
				sort: 'allowed,rejected'
			})

			const factory = getSortAndFilterFactory({
				sortable: ['allowed']
			});
			const result = factory(executionContext);

			expect(result.sort).to.contain.keys('allowed');
			expect(result.sort).not.to.contain.keys('rejected');
		});
	});

	describe('filtering', () => {
		it('interprets filter query params', () => {
			const executionContext = executionContextWithQueryParams({
				filter: 'name:bob'
			})

			const factory = getSortAndFilterFactory();
			const result = factory(executionContext);

			expect(result.filter).to.contain.keys('name');
			expect(result.filter.name.op).to.eq('eq');
			expect(result.filter.name.value).to.eq('bob');
		});

		it('interprets double underscore operators and changes the op accordingly', () => {
			const executionContext = executionContextWithQueryParams({
				filter: 'name__icontains:bob'
			})

			const factory = getSortAndFilterFactory();
			const result = factory(executionContext);

			expect(result.filter).to.contain.keys('name');
			expect(result.filter.name.op).to.eq('icontains');
			expect(result.filter.name.value).to.eq('bob');
		})

		it('allows multiple filters', () => {
			const executionContext = executionContextWithQueryParams({
				filter: 'name__icontains:bob,age__gt:25'
			})

			const factory = getSortAndFilterFactory();
			const result = factory(executionContext);

			expect(result.filter).to.contain.keys('name');
			expect(result.filter.name.op).to.eq('icontains');
			expect(result.filter.name.value).to.eq('bob');

			expect(result.filter).to.contain.keys('age');
			expect(result.filter.age.op).to.eq('gt');
			expect(result.filter.age.value).to.eq('25');
		})

		it('rejects attributes that are not present in filterable config', () => {
			const executionContext = executionContextWithQueryParams({
				filterable: 'rejected:value'
			})

			const factory = getSortAndFilterFactory({
				filterable: ['allowed']
			});
			const result = factory(executionContext);

			expect(result.filter).not.to.contain.keys('rejected');
		})
	});
});

function executionContextWithQueryParams(query: any) {
	return {
	  switchToHttp: () => ({
	    getRequest: () => ({
	      query
	    }),
	  }),
	};	
}

function getSortAndFilterFactory(config?: SortAndFilterConfig) {
	class SomeController {
		public test(@SortAndFilter(config) _: SortAndFilterParams) {}
	}
	const args = Reflect.getMetadata(ROUTE_ARGS_METADATA, SomeController, 'test');
	const { factory, data } = args[Object.keys(args)[0]];
	return function(executionContext: any): SortAndFilterParams {
		return factory(data || {}, executionContext);
	};
}