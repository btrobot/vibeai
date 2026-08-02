import { describe, it, expect, vi } from 'vitest';
import { createDrizzleMockForNestJS, mockSingle } from './drizzle-mock';
import { buildUser } from './factories';

describe('Debug Final 2', () => {
  it('should trace mockResolvedValue', async () => {
    const db = createDrizzleMockForNestJS();
    const user = buildUser({ id: 'test-id' });
    
    console.log('Before mockSingle - limit mock calls:', (db as any).limit?.mock?.calls?.length);
    
    mockSingle(db as any, user);
    
    console.log('After mockSingle - _result:', JSON.stringify((db as any)._result));
    console.log('After mockSingle - limit mock calls:', (db as any).limit?.mock?.calls?.length);
    
    // Check if the limit mock has been modified
    const limitImpl = (db as any).limit?.getMockImplementation?.();
    console.log('limit impl type:', typeof limitImpl);
    
    const result = await (db as any).limit(1);
    console.log('limit result:', JSON.stringify(result));
    
    // Try calling mockResolvedValue directly
    (db as any).limit.mockResolvedValue(['direct']);
    console.log('direct result:', await (db as any).limit());
  });
});
