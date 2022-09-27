import { Controller, Get } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { paginate, Paginate, Paginated, PaginateParams } from "../../paginators";
import { sortAndFilter, SortAndFilter, SortAndFilterParams } from "../../sort-and-filter";
import { Test } from "./test.entity";

@Controller('tests')
export class TestController {
	constructor(@InjectRepository(Test) private readonly testRepository: Repository<Test>) {}

	@Get('')
	async index(
	    @Paginate({
	      maxPageSize: 100
	    }) paginateParams: PaginateParams,
	    @SortAndFilter({
	      sortable: ['name', 'email'],
	      filterable: ['name', 'email', 'createdAt', 'related.name'],
	    }) sortAndFilterParams: SortAndFilterParams,
	): Promise<Paginated<Test>> {
		return this.testRepository
			.createQueryBuilder('test')
			.sortAndFilter(sortAndFilterParams)
			.paginate(paginateParams);
	}

	@Get('repo')
	async repo(
	    @Paginate({
	      maxPageSize: 100
	    }) paginateParams: PaginateParams,
	    @SortAndFilter({
	      sortable: ['name', 'email'],
	      filterable: ['name', 'email', 'createdAt', 'related.name'],
	    }) sortAndFilterParams: SortAndFilterParams,
	): Promise<Paginated<Test>> {
		return paginate(this.testRepository, paginateParams, sortAndFilter(sortAndFilterParams));
	}
}