import {
  sqliteTable,
  text,
  integer,
  index,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
export const reports = sqliteTable(
  'reports',
  {
    id: text('id').primaryKey(),
    owner: text('owner').notNull(),
    name: text('name').notNull(),
    hash: text('hash').notNull(),
    createdAt: text('created_at').notNull(),
    bytes: integer('bytes').notNull(),
    type: text('type').notNull(),
    kind: text('kind').notNull(),
    rows: integer('rows').notNull(),
    status: text('status').notNull(),
  },
  (t) => [
    index('reports_owner_created').on(t.owner, t.createdAt),
    uniqueIndex('reports_owner_hash').on(t.owner, t.hash),
  ],
);
