import { describe, it, expect } from 'vitest';
import { createDrizzleMock, mockSingle, mockEmpty } from './drizzle-mock';
import { buildUser } from './factories';

describe('DrizzleMock', () => {
  it('should have select as a function', () => {
    const db = createDrizzleMock();
    expect(typeof db.select).toBe('function');
  });

  it('should support select().from().where().limit() chain', async () => {
    const db = createDrizzleMock();
    const user = buildUser({ id: 'test-id' });
    mockSingle(db, user);

    const result = await db.select().from('users').where({ id: 'test-id' }).limit(1);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('test-id');
  });

  it('should support empty result', async () => {
    const db = createDrizzleMock();
    mockEmpty(db);

    const result = await db.select().from('users').where({ id: 'nonexistent' }).limit(1);

    expect(result).toHaveLength(0);
  });
});