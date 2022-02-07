import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { FindManyOptions, ObjectLiteral, Repository, SelectQueryBuilder } from "typeorm";
import { URL } from "url";

export interface PaginateParams {
  page?: number,
  pageSize?: number,
  baseUrl: string,
  query: any,
  paginator: new(params: PaginateParams) => Paginator,
};

export interface PaginateConfig {
  maxPageSize?: number,
  defaultPageSize?: number,
  paginator?: new(params: PaginateParams) => Paginator,
};

export const Paginate = createParamDecorator<PaginateConfig>((config: PaginateConfig, ctx: ExecutionContext): PaginateParams => {
  const req = ctx.switchToHttp().getRequest();
  const baseUrl = `${req.protocol}://${req.get('host')}${req.baseUrl}${req.path}`;
  const paginator = config.paginator || PagedPaginator;

  let pageSize = parseInt(req.query.pageSize) || config.defaultPageSize || 10;
  if (config.maxPageSize) {
    pageSize = Math.min(pageSize, config.maxPageSize)
  }

  return {
    page: parseInt(req.query.page) || 1,
    pageSize,
    baseUrl,
    query: req.query,
    paginator,
  };
});

export interface Paginated<T> {
  results: T[],
  meta: {
    pageCount: number,
    count: number,
    page: number,
    pageSize: number,
  },
  links: {
    first: string,
    next: string,
    prev: string,
    last: string,
  },
};

export abstract class Paginator {
  protected params: PaginateParams;

  constructor(params: PaginateParams) {
    this.params = params;
  }

  abstract paginate<Entity extends ObjectLiteral>(qb: SelectQueryBuilder<Entity>): Promise<Paginated<Entity>>;
  abstract paginateRepo<Entity extends ObjectLiteral>(repo: Repository<Entity>, options?: FindManyOptions<Entity>): Promise<Paginated<Entity>>;
}

export class PagedPaginator extends Paginator {
  private page: number;
  private pageSize: number;
  private pageCount: number;
  private count: number;

  constructor(params: PaginateParams) {
    super(params);
    this.pageSize = this.params.pageSize;
    this.page = this.params.page;
  }

  async paginate<Entity extends ObjectLiteral>(qb: SelectQueryBuilder<Entity>) {
    const skip = (this.page - 1) * this.pageSize;

    const [results, count] = await qb
      .skip(skip)
      .take(this.pageSize)
      .getManyAndCount();

    this.count = count;
    this.pageCount = Math.floor((count - 1) / this.pageSize) + 1;
    if (count == 0) {
      this.pageCount = 0;
    }

    const links = this.links();
    const meta = this.meta();

    return {
      results,
      meta,
      links,
    };
  }

  async paginateRepo<Entity extends ObjectLiteral>(repo: Repository<Entity>, options?: FindManyOptions<Entity>) {
    const skip = (this.page - 1) * this.pageSize;

    const [results, count] = await repo.findAndCount({
      skip,
      take: this.pageSize,
      ...options
    });

    this.count = count;
    this.pageCount = Math.floor((count - 1) / this.pageSize) + 1;
    if (count == 0) {
      this.pageCount = 0;
    }

    const links = this.links();
    const meta = this.meta();

    return {
      results,
      meta,
      links,
    };
  }

  private links() {
    function _addOriginalQueryParams(url: URL, query: any) {
      for (const [k, v] of Object.entries(query)) {
        url.searchParams.set(k, v.toString());
      }
    }

    const first = new URL(this.params.baseUrl);
    _addOriginalQueryParams(first, this.params.query);
    first.searchParams.set('page', '1');
    first.searchParams.set('pageSize', this.pageSize.toString());

    const last = new URL(this.params.baseUrl);
    _addOriginalQueryParams(last, this.params.query);
    last.searchParams.set('page', Math.max(this.pageCount, 1).toString());
    last.searchParams.set('pageSize', this.pageSize.toString());

    let prev = null;
    if (this.page > 1) {
      prev = new URL(this.params.baseUrl);
      _addOriginalQueryParams(prev, this.params.query);
      prev.searchParams.set('page', (this.page - 1).toString());
      prev.searchParams.set('pageSize', this.pageSize.toString());
      prev = prev.toString()
    }

    let next = null;
    if (this.page < this.pageCount) {
      next = new URL(this.params.baseUrl);
      _addOriginalQueryParams(next, this.params.query);
      next.searchParams.set('page', (this.page + 1).toString());
      next.searchParams.set('pageSize', this.pageSize.toString());
      next = next.toString()    
    }

    return {
      first: first.toString(),
      next: next,
      prev: prev,
      last: last.toString()
    };
  }

  private meta() {
    return {
      pageCount: this.pageCount,
      pageSize: this.pageSize,
      page: this.page,
      count: this.count,
    }
  }
}

declare module 'typeorm/query-builder/SelectQueryBuilder' {
  interface SelectQueryBuilder<Entity> {
    paginate(params: PaginateParams): Promise<Paginated<Entity>>;
  }
}

SelectQueryBuilder.prototype.paginate = async function<Entity>(this: SelectQueryBuilder<Entity>, params: PaginateParams) {
  const paginator = new params.paginator(params);
  return paginator.paginate(this);
}

// don't ask
type NoInfer<T> = T extends infer S ? S : never;

export const paginate = async <T extends ObjectLiteral>(repo: Repository<T>, params: PaginateParams, options?: FindManyOptions<NoInfer<T>>): Promise<Paginated<T>> => {
  const paginator = new params.paginator(params);
  return await paginator.paginateRepo(repo, options as FindManyOptions<T>);
}
