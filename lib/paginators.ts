import { createParamDecorator, ExecutionContext, NotImplementedException } from "@nestjs/common";
import { Brackets, FindManyOptions, ObjectLiteral, Repository, SelectQueryBuilder } from "typeorm";
import { URL } from "url";

export interface PaginateParams {
  pageSize: number,
  baseUrl: string,
  query: any,
  paginator: new(params: PaginateParams) => Paginator,
};

export interface PaginateConfig {
  maxPageSize?: number
  paginator?: new(params: PaginateParams) => Paginator,
};

export const Paginate = createParamDecorator<PaginateConfig>((config: PaginateConfig, ctx: ExecutionContext): PaginateParams => {
  const req = ctx.switchToHttp().getRequest();
  const baseUrl = `${req.protocol}://${req.get('host')}${req.baseUrl}${req.path}`;
  const paginator = config.paginator || PagedPaginator;

  let pageSize = parseInt(req.query.pageSize) || 10;
  if (config.maxPageSize) {
    pageSize = Math.min(pageSize, config.maxPageSize)
  }

  return {
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
  /*
   * Works by accepting `page` and `pageSize` query parameters, for example:
   *
   * https://some-api.com/users?page=2&pageSize=25
   */
  private page: number;
  private pageSize: number;
  private pageCount: number;
  private count: number;

  constructor(params: PaginateParams) {
    super(params);
    this.pageSize = params.pageSize;
    this.page = parseInt(params.query.page) || 1;
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

export class CursorPaginator extends Paginator {
  /*
   * Cursor pagination is used when performance is paramount. The
   * traditional paged pagination approach will work up to a few
   * million records, but will start to show performance issues
   * (especially when offset is high) as datasets get extremely large.
   *
   * Cursor pagination has it's own downsides however, when using it,
   * you can only know if there is a next and previous page, you do
   * not know **where** within the dataset you are. This is the
   * tradeoff you pay for speed, don't use this method of pagination
   * if your datasets are not large. It also often best used in an
   * infinite scrolling or search based interface as opposed to a
   * traditional table.
   *
   * It works by accepting `cursor`, `cursorDir`, and `pageSize` query
   * parameters.
   * - `cursor` is the id of the record you your cursor to be on. If
   *   not included will return the first or last page depending on
   *   cursor direction.
   * - `cursorDir` is the direction of pagination
   *     > "next" will give you, including the cursor, the next
   *       `pageSize` records
   *     > "prev" will give you, excluding the cursor, the previous
   *       `pageSize` records
   */

  async paginate<Entity extends ObjectLiteral>(qb: SelectQueryBuilder<Entity>): Promise<Paginated<Entity>> {
    let results = [];
    let links: any;

    qb.addOrderBy(`${qb.alias}.id`, 'ASC');
    const firstRecord = await (qb.clone()).limit(1).getOne();

    let cursor = this.params.query.cursor || firstRecord.id;
    if (!this.params.query.cursor && this.cursorDir == 'prev') {
      const lastRecord = await this.reverseAllOrderBy(qb.clone()).limit(1).getOne();
      cursor = lastRecord.id;
    }

    if (cursor) {
      if (this.cursorDir == 'prev') {
        this.reverseAllOrderBy(qb);
      }

      // NOTE(justin): if we are going forward we need to pull 1 extra
      // record to check if there is a next page. If we are going
      // backwards, we need to pull 2 extra records, since the cursor
      // record is not included.
      if (this.cursorDir == 'next')
        qb.limit(this.params.pageSize + 1);
      else
        qb.limit(this.params.pageSize + 2);

      const numOrder = Object.entries(qb.expressionMap.orderBys).length
      if (numOrder == 1) {
        // NOTE(justin): 1 ordering means that we are ordering by id only.
        const [key, order] = Object.entries(qb.expressionMap.orderBys)[0];
        let comp = this.comparitor(order as string, true);
        qb.andWhere(`${key} ${comp} :cursorPaginatorWhereId`, {
          cursorPaginatorWhereId: cursor
        });
      } else {
        // NOTE(justin): more than 1 ordering means the qb had
        // previous orderings, we want to respect those, so we
        // formulate a query like so:
        //
        // []   -> WHERE id >= ?
        // [A]  -> WHERE ((A = ? AND id >= ?) OR A > ?)
        // [-A] -> WHERE ((A = ? AND id >= ?) OR A < ?)
        // [A, -B] -> WHERE ((A = ? AND B = ? AND id >= ?) OR
        //                   (A = ? AND B < ?) OR
        //                   (A > ?)

        const thisRecord = await qb.clone()
          .where(`${qb.alias}.id = :thisRecordId`, { thisRecordId: cursor })
          .getOne();
        qb.andWhere(new Brackets(b => {

          const orderBys = Object.entries(qb.expressionMap.orderBys);
          let counter = 0;

          while (orderBys.length > 0) {
            const tiebreaker = orderBys.pop();

            b.orWhere(new Brackets(b => {
              for (let i = 0; i < orderBys.length; ++i) {
                let [key, _] = orderBys[i];
                key = key.split(qb.alias + '.')[1] || key;
                b.andWhere(`${key} = :cursorPaginateWhere_${key}_${counter}`, {
                  [`cursorPaginateWhere_${key}_${counter}`]: thisRecord[key]
                });
              }

              let [tbKey, tbOrder] = tiebreaker;
              tbKey = tbKey.split(qb.alias + '.')[1] || tbKey;
              const comp = this.comparitor(tbOrder as string, tbKey == 'id');
              b.andWhere(`${tbKey} ${comp} :cursorPaginateWhere_${tbKey}_${counter}`, {
                [`cursorPaginateWhere_${tbKey}_${counter}`]: thisRecord[tbKey]
              });
            }));

            ++counter;
          }
        }));

      }

      results = await qb.getMany();

      if (this.cursorDir == 'next') {
        const hasMore = !!results[10];
        const nextCursor: Entity = results[10];

        links = {
          first: this.linkFor(null, 'next'),
          last: this.linkFor(null, 'prev'),
          next: hasMore ? this.linkFor(nextCursor.id, 'next') : null,
          prev: cursor == firstRecord.id ? null : this.linkFor(cursor, 'prev'),
        };

        results = results.slice(0, 10);
      } else {
        let last = 11;
        if (!this.params.query.cursor)
          last = 10;
        const hasMore = !!results[last];
        const currPageLast: Entity = results[last - 1];

        links = {
          first: this.linkFor(null, 'next'),
          last: this.linkFor(null, 'prev'),
          next: this.linkFor(cursor, 'next'),
          prev: hasMore ? this.linkFor(currPageLast.id, 'prev') : null,
        };

        // NOTE(justin): If we don't have a cursor we don't need to pop the
        // cursor target record off
        if (this.params.query.cursor)
          results.shift();

        if (hasMore)
          results.pop();

        results = results.slice(0, 10);
        results.reverse();
      }
    }

    return {
      results,
      meta: {
        pageCount: 0,
        page: 0,
        pageSize: this.params.pageSize,
        count: 0,
      },
      links,
    };
  }

  paginateRepo<Entity extends ObjectLiteral>(): Promise<Paginated<Entity>> {
    throw NotImplementedException;
  }

  private comparitor(dir: string, equals: boolean) {
    let res = '>';
    if (dir == 'DESC')
      res = '<';

    if (equals)
      res = `${res}=`;
    return res;
  }

  private linkFor(cursor: string, dir: 'next' | 'prev') {
    function _addOriginalQueryParams(url: URL, query: any) {
      for (const [k, v] of Object.entries(query)) {
        if (k != 'cursor' && k != 'cursorDir')
          url.searchParams.set(k, v.toString());
      }
    }

    const res = new URL(this.params.baseUrl);
    _addOriginalQueryParams(res, this.params.query);
    if (cursor)
      res.searchParams.set('cursor', cursor);
    res.searchParams.set('cursorDir', dir);
    res.searchParams.set('pageSize', this.params.pageSize.toString());
    return res;
  }

  private reverseAllOrderBy<Entity extends ObjectLiteral>(qb: SelectQueryBuilder<Entity>) {
    let beforeOrderBys = Object.assign({}, qb.expressionMap.orderBys);
    qb.orderBy();

    for (let [key, value] of Object.entries(beforeOrderBys)) {
      qb.addOrderBy(key, this.reverse(value as 'ASC' | 'DESC'));
    }

    return qb;
  }

  private reverse(dir: 'ASC' | 'DESC'): 'ASC' | 'DESC' {
    return {
      'ASC': 'DESC',
      'DESC': 'ASC'
    }[dir] as 'ASC' | 'DESC';
  }

  private get cursorDir(): 'next' | 'prev' {
    return this.params.query.cursorDir == 'prev' ? 'prev' : 'next';
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

export const paginate = async <T extends ObjectLiteral>(repo: Repository<T>, params: PaginateParams, options?: FindManyOptions<T>): Promise<Paginated<T>> => {
  const paginator = new params.paginator(params);
  return await paginator.paginateRepo(repo, options);
}
