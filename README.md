# Nest PSF (Page, Sort, Filter)

[![CircleCI](https://circleci.com/gh/Shift3/nestjs-psf/tree/master.svg?style=svg)](https://circleci.com/gh/Shift3/nestjs-psf/tree/master)

Nest PSF is a library that provides helpers for easy pagination, sorting, and filtering for your API.

## Getting Started

Install the package.

```bash
npm install --save nestjs-psf
```

Use in your controller

```typescript
@Get('')
async index(
  @Paginate() paginateParams: PaginateParams,
  @SortAndFilter() sortAndFilterParams: SortAndFilterParams
): Promise<Paginated<Agent>> {
  return await this.agentRepository
    .createQueryBuilder('agent')
    .sortAndFilter(sortAndFilterParams)
    .paginate(paginateParams);
}
```

That's it! Your API now supports:

- pagination, with the `page` and `pageSize` query params
- sorting, with the `sort` query param
- and filtering, with the `filter` query param.

When using the parameter decorators in your controllers it is good practice to set a maximum page size, and to whitelist which attributes are sortable and filtering, like so:

```typescript
@Paginate({
  maxPageSize: 100
}) paginateParams: PaginateParams,
@SortAndFilter({
  sortable: ['name', 'email'],
  filterable: ['name', 'createdAt'],
}) sortAndFilterParams: SortAndFilterParams
```

For details on each of these, see below.

## Pagination

For pagination, the parameter decorator to use in your controller is the `@Paginate` decorator. This will give you a `PaginateParams` to pass to the paginate method of choice. We provide the ability to paginate using a [repository](https://typeorm.io/#/working-with-repository), or using the [query builder](https://typeorm.io/#/select-query-builder/what-is-querybuilder).

```typescript
// for query builder we use .paginate instead of .getMany
await this.someRepository
  .createQueryBuilder()
  .paginate(paginateParams);

// for repository we use the provided paginate helper
await paginate(this.someRepository, paginateParams);

// you can pass regular repository FindOptions as the 3rd param,
// this is the same as if you were calling repo.find()
await paginate(this.someRepository, paginateParams, {
  where: { age: MoreThan(5) }
});
```

After enabling pagination on your api, the endpoint will accept `page` and
`pageSize` query parameters. An example call would be like
`http://localhost/api/some_api?page=2&pageSize=2`

You will receive a response back like:

```js
{
  results: [
    {
      id: 1,
      name: 'Name 1',
    },
    {
      id: 2,
      name: 'Name 2',
    }
  ],
  meta: { pageCount: 5, pageSize: 2, page: 2, count: 9 },
  links: {
    first: 'http://127.0.0.1:36285/api/some_api?pageSize=2&page=1',
    next: 'http://127.0.0.1:36285/api/some_api?pageSize=2&page=3',
    prev: 'http://127.0.0.1:36285/api/some_api?pageSize=2&page=1',
    last: 'http://127.0.0.1:36285/api/some_api?pageSize=2&page=5'
  }
}
```

We provide links that allow you to easily go to the next/prev/first/last page. Note that `next` will be null if there is no next page, and `prev` will be null if there is no previous page.

Additionally we provide metainformation, for you to display page counts, record counts, etc.

## Sort And Filter

Sorting and filtering both use the `@SortAndFilter` decorator, which will give you a `SortAndFilterParams` to pass to your choice of helper.

```typescript
// for query builder we use .sortAndFilter
await this.someRepository
  .createQueryBuilder()
  .sortAndFilter(sortAndFilterParams)
  .getMany();

// you can use the sortAndFilter helper to make a FindOptions
// for use in the repository .find method
await this.someRepository.find(sortAndFilter(sortAndFilterParams))
```

This can also be combined with pagination.

```typescript
// query builder
await this.someRepository
  .createQueryBuilder()
  .sortAndFilter(sortAndFilterParams)
  .paginate(paginateParams);

// repository
await paginate(this.someRepository, paginateParams, sortAndFilter(sortAndFilterParams));
```

## Sorting

When you enable sorting on your api endpoint, the endpoint will now accept a `sort` query parameter.

The sort query parameter accepts a comma seperated list of fields to order by. To reverse a sort column, prefix it with a `-`

Usage example:

`http://localhost/api/some_api?sort=name,-email`

## Filtering

By enabling filtering on your API endpoint you enable a range of available searches, the general format for such a search is:

`http://localhost/api/some_api?filter=attr__operator:search`

You can filter against multiple attribute by separating them with columns, for example:

`http://localhost/api/some_api?filter=name__icontains:bob,age__gt:25`

A list of all operators are as follows:

| Query Param Operator | Effect                       |
|----------------------|------------------------------|
| `eq`                 | exactly equals to            |
| `neq`                | not exactle equals to        |
| `contains`           | contains somewhere within it |
| `icontains`          | case insentive contains      |
| `gt`                 | greater than                 |
| `lt`                 | less than                    |
| `gte`                | greater than or equal to     |
| `lte`                | less than or equal to        |
| `startswith`         | starts with                  |
| `endswith`           | ends with                    |

