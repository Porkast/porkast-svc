import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { updateUserSubscription } from './subscribe';
import type { PrismaClient } from '@prisma/client';
import type { KeywordSubscribeRequestData } from './types';

const mockPrisma = {
  user_subscription: {
    findFirst: mock<(args: any) => Promise<any>>(() => Promise.resolve(null)),
    create: mock<(args: any) => Promise<any>>(() => Promise.resolve({ id: 'mock-id' })),
    findMany: mock(() => Promise.resolve([])),
    update: mock(() => Promise.resolve({})),
    delete: mock(() => Promise.resolve({})),
    mockReset: mock(() => {}),
    mockResolvedValue: mock(() => {}),
    mockRejectedValue: mock(() => {}),
    mockImplementation: mock(() => {}),
    mockImplementationOnce: mock(() => {}),
  },
} as unknown as PrismaClient & {
  user_subscription: {
    findFirst: ReturnType<typeof mock>;
    create: ReturnType<typeof mock>;
    findMany: ReturnType<typeof mock>;
    update: ReturnType<typeof mock>;
    delete: ReturnType<typeof mock>;
    mockReset: ReturnType<typeof mock>;
    mockResolvedValue: ReturnType<typeof mock>;
    mockRejectedValue: ReturnType<typeof mock>;
    mockImplementation: ReturnType<typeof mock>;
    mockImplementationOnce: ReturnType<typeof mock>;
  }
};

const mockDoSearchSubscription = mock(async (keyword: string, country: string, source: string, excludeFeedId: string) => {});

mock.module('../../db/prisma.client', () => ({
  default: mockPrisma
}));
mock.module('../../db/subscription', () => ({
  doSearchSubscription: mockDoSearchSubscription
}));

describe('updateUserSubscription', () => {
  const validRequest: KeywordSubscribeRequestData = {
    userId: 'user123',
    keyword: 'test',
    country: 'US',
    source: 'itunes',
    sortByDate: 1,
  };

  beforeEach(() => {
    mockPrisma.user_subscription.findFirst.mockReset();
    mockPrisma.user_subscription.create.mockReset();
    mockDoSearchSubscription.mockReset();
  });

  it('should return "Already subscribed" if subscription exists', async () => {
    mockPrisma.user_subscription.findFirst.mockResolvedValue({ id: 'sub123' });
    
    const result = await updateUserSubscription(validRequest);
    expect(result).toBe('Already subscribed');
    expect(mockPrisma.user_subscription.findFirst).toHaveBeenCalled();
  });

  it('should create new subscription and return "done" on success', async () => {
    mockPrisma.user_subscription.findFirst.mockResolvedValue(null);
    mockPrisma.user_subscription.create.mockResolvedValue({ id: 'new-sub' });
    mockDoSearchSubscription.mockResolvedValue(undefined);
    
    const result = await updateUserSubscription(validRequest);
    expect(result).toBe('done');
    expect(mockPrisma.user_subscription.create).toHaveBeenCalled();
    expect(mockDoSearchSubscription).toHaveBeenCalled();
  });
});
