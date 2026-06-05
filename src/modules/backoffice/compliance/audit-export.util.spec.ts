import { auditRowsToCsv } from './audit-export.util';

describe('auditRowsToCsv', () => {
  it('escapes commas and quotes', () => {
    const csv = auditRowsToCsv([
      {
        id: 'a1',
        createdAt: '2026-06-05T10:00:00.000Z',
        actorType: 'staff',
        actorId: 'staff-1',
        casinoGroupId: 'cg1',
        action: 'bets.voided',
        entityType: 'Bet',
        entityId: 'bet-1',
        reason: 'Customer said "cancel"',
      },
    ]);
    expect(csv).toContain('Customer said ""cancel""');
    expect(csv.split('\n')).toHaveLength(2);
  });
});
