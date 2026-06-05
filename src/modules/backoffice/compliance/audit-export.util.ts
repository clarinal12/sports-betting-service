export interface AuditExportRow {
  id: string;
  createdAt: string;
  actorType: string;
  actorId: string | null;
  casinoGroupId: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  reason: string | null;
}

function escapeCsv(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function auditRowsToCsv(rows: AuditExportRow[]): string {
  const header = [
    'id',
    'createdAt',
    'actorType',
    'actorId',
    'casinoGroupId',
    'action',
    'entityType',
    'entityId',
    'reason',
  ];
  const lines = rows.map((row) =>
    [
      row.id,
      row.createdAt,
      row.actorType,
      row.actorId ?? '',
      row.casinoGroupId ?? '',
      row.action,
      row.entityType,
      row.entityId ?? '',
      row.reason ?? '',
    ]
      .map((cell) => escapeCsv(String(cell)))
      .join(','),
  );
  return [header.join(','), ...lines].join('\n');
}
