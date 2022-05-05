import {
    createParamDecorator, ExecutionContext
} from '@nestjs/common';
import { Brackets, Equal, FindManyOptions, FindOperator, ILike, In, LessThan, LessThanOrEqual, Like, MoreThan, MoreThanOrEqual, Not, ObjectLiteral, SelectQueryBuilder } from 'typeorm';

export enum SearchOps {
  EQUALS     = 'eq',
  NOTEQUALS  = 'neq',
  CONTAINS   = 'contains',
  ICONTAINS  = 'icontains',
  GT         = 'gt',
  LT         = 'lt',
  GTE        = 'gte',
  LTE        = 'lte',
  STARTSWITH = 'startswith',
  ENDSWITH   = 'endswith',
  HAS        = 'has',
}

export interface SortAndFilterParams {
  sort?: { [key: string]: 'ASC' | 'DESC' },
  filter?: { [key: string]: { value: string, op: SearchOps } }
};

export interface SortAndFilterConfig {
  sortable?: string[],
  filterable?: string[],
}

declare module 'typeorm/query-builder/SelectQueryBuilder' {
  interface SelectQueryBuilder<Entity> {
    sortAndFilter(params: SortAndFilterParams): this;
  }
}

export const SortAndFilter = createParamDecorator<SortAndFilterConfig>((config: SortAndFilterConfig, ctx: ExecutionContext): SortAndFilterParams => {
  const req = ctx.switchToHttp().getRequest();

  let sort = {};
  if (req.query.sort) {
    req.query.sort
      .split(',')
      .filter((c: string) => {
        if (config.sortable) {
          return config.sortable.includes(c) || (c[0] == '-' && config.sortable.includes(c.slice(1)));
        }

        return c;
      })
      .forEach((sortColumn: string) => {
        let dir: 'ASC' | 'DESC' = 'ASC';
        if (sortColumn[0] == '-') {
          dir = 'DESC';
          sortColumn = sortColumn.slice(1);
        }

        sort[sortColumn] = dir;
      });
  }

  let filter = {};
  if (req.query.filter) {
    req.query.filter.split(',').forEach((filterColumn: string) => {
      const splits = filterColumn.split(':');
      let key = splits[0];
      const value = splits.slice(1).join(':');


      if (key && value) {
        let op = SearchOps.EQUALS;
        if (key.indexOf('__') != -1) {
          let [realKey, stringOp] = key.split('__');
          key = realKey;
          if (Object.values(SearchOps).includes(stringOp as SearchOps)) {
            op = stringOp as SearchOps;
          }
        }

        if (config.filterable) {
          if (config.filterable.includes(key)) {
            filter[key] = {
              op, value
            };
          }
        } else {
          filter[key] = {
            op, value
          };
        }
      }
    });
  }

  return {
    sort,
    filter
  };
});

const searchOpToOperator = {
  [SearchOps.EQUALS]:     '=',
  [SearchOps.NOTEQUALS]:  '!=',
  [SearchOps.CONTAINS]:   'LIKE',
  [SearchOps.STARTSWITH]: 'LIKE',
  [SearchOps.ENDSWITH]:   'LIKE',
  [SearchOps.ICONTAINS]:  'ILIKE',
  [SearchOps.GT]:         '>',
  [SearchOps.LT]:         '<',
  [SearchOps.GTE]:        '>=',
  [SearchOps.LTE]:        '<=',
  [SearchOps.HAS]:         '@>',
};

function NotEqual<T>(value: T | FindOperator<T>): FindOperator<T> {
  return Not(Equal(value));
}

const searchOpToTypeormOperator = {
  [SearchOps.EQUALS]:     Equal,
  [SearchOps.NOTEQUALS]:  NotEqual,
  [SearchOps.CONTAINS]:   Like,
  [SearchOps.STARTSWITH]: Like,
  [SearchOps.ENDSWITH]:   Like,
  [SearchOps.CONTAINS]:   Like,
  [SearchOps.ICONTAINS]:  ILike,
  [SearchOps.GT]:         MoreThan,
  [SearchOps.LT]:         LessThan,
  [SearchOps.GTE]:        MoreThanOrEqual,
  [SearchOps.LTE]:        LessThanOrEqual,
  [SearchOps.HAS]:        In,
};

function paramTransform(param: string, op: SearchOps): string {
  switch(op) {
    case SearchOps.CONTAINS:
    case SearchOps.ICONTAINS:
      return `%${param}%`
    case SearchOps.STARTSWITH:
      return `${param}%`
    case SearchOps.ENDSWITH:
      return `%${param}`;
  }

  return param;
}

function buildSortAndFilterJoins<Entity>(qb: SelectQueryBuilder<Entity>, dottedPath: string, alias: string) {
  // NOTE(justin): currently only support 1 level of traversing.
  const [related, attr] = dottedPath.split('.');
  const joinAlias = `leftJoinAnd${alias}_${related}_${attr}`;
  qb.leftJoinAndSelect(`${qb.alias}.${related}`, joinAlias);

  return `${joinAlias}.${attr}`
}

SelectQueryBuilder.prototype.sortAndFilter = function<Entity>(this: SelectQueryBuilder<Entity>, params: SortAndFilterParams) {
  if (params.sort) {
    for (let [key, dir] of Object.entries(params.sort)) {
      if (key.includes('.')) {
        key = buildSortAndFilterJoins(this, key, 'Sort');
        this.addOrderBy(`${key}`, dir);
      } else {
        this.addOrderBy(`${this.alias}.${key}`, dir);
      }
    }
  }

  if (params.filter) {
    let counter = 0;
    for (let [key, value] of Object.entries(params.filter)) {
      let op = searchOpToOperator[value.op] || '=';
      
      if (key.includes('.')) {
        key = buildSortAndFilterJoins(this, key, 'Filter');
      }

      this.andWhere(new Brackets(qb => {
        value.value.split('|').forEach(p => {
          let filterValue: string | string[];
          if (value.op === SearchOps.HAS)
            filterValue = [ p ];
          else
            filterValue = paramTransform(p, value.op);

          qb.orWhere(`${this.alias}.${key} ${op} :filterValue${counter}`, {
            [`filterValue${counter}`]: filterValue
          });
          ++counter;
        });
      }));
    }
  }

  return this;
};

export const sortAndFilter = <T extends ObjectLiteral>(params: SortAndFilterParams): FindManyOptions<T> => {
  const options: FindManyOptions<T> = {};

  if (params.sort) {
    for (let [key, dir] of Object.entries(params.sort)) {
      options.order ||= {};
      options.order[key] = dir;
    }
  }

  if (params.filter) {
    options.where = {};
    for (let [key, value] of Object.entries(params.filter)) {
      
      const op = searchOpToTypeormOperator[value.op] || Equal;

      if (value.value.includes('|')) {
        // NOTE(justin): OR group
        throw new Error('Repository does not support grouped OR\'s you must use the QueryBuilder.');
      } else {
        if (value.op === SearchOps.HAS) {
          options.where[key] = [value.value];
        } else {
          options.where[key] = op(paramTransform(value.value, value.op));
        }
      }
    }
  }

  return options;
}
