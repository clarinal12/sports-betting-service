import { PaginationQueryDto, paginate } from './pagination';

describe('pagination', () => {
  it('computes skip from page and pageSize', () => {
    const query = new PaginationQueryDto();
    query.page = 3;
    query.pageSize = 20;
    expect(query.skip).toBe(40);
  });

  it('wraps data with paging metadata', () => {
    const query = new PaginationQueryDto();
    query.page = 2;
    query.pageSize = 10;
    const result = paginate(['a', 'b'], 42, query);
    expect(result).toEqual({
      data: ['a', 'b'],
      total: 42,
      page: 2,
      pageSize: 10,
    });
  });
});
