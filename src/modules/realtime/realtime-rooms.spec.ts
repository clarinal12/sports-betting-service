import { eventRoom, marketRoom } from './realtime-rooms';

describe('realtime rooms', () => {
  it('builds tenant-scoped event rooms', () => {
    expect(eventRoom('grp1', 'evt1')).toBe('group:grp1:event:evt1');
  });

  it('builds tenant-scoped market rooms', () => {
    expect(marketRoom('grp1', 'mkt1')).toBe('group:grp1:market:mkt1');
  });
});
