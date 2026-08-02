import { describe, it, expect, vi } from 'vitest';
import { createDrizzleMockForNestJS, mockSingle, mockEmpty } from './drizzle-mock';
import { buildUser } from './factories';

describe('Debug Final', () => {
  it('should test mockSingle with NestJS wrapper', async () => {
    const db = createDrizzleMockForNestJS();
    console.log('db type:', typeof db);
    console.log('db.select:', typeof db.select);
    console.log('db.then:', typeof (db as any).then);
    
    const user = buildUser({ id: 'test-id' });
    mockSingle(db as any, user);
    console.log('_result:', JSON.stringify((db as any)._result));
    
    const result = await db.select().from('users').where({ id: 'test-id' }).limit(1);
    console.log('result:', JSON.stringify(result));
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('test-id');
  });
  
  it('should test returning', async () => {
    const db = createDrizzleMockForNestJS();
    const user = buildUser({ email: 'test@test.com' });
    mockSingle(db as any, user);
    
    const result = await db.insert().values({}).returning();
    console.log('returning result:', JSON.stringify(result));
    expect(result).toHaveLength(1);
    expect(result[0].email).toBe('test@test.com');
  });
  
  it('should test update chain', async () => {
    const db = createDrizzleMockForNestJS();
    mockEmpty(db as any);
    
    // This is equivalent to: await db.update(users).set({...}).where(eq(...))
    const result = await (db as any).update().set({}).where({});
    console.log('update result:', JSON.stringify(result));
  });
});
