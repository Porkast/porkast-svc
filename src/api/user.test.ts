import { syncUserData } from './user';
import prisma from '../db/prisma.client';
import type { Prisma } from '@prisma/client';
import { UserSyncRequestData } from './types';

jest.mock('../db/prisma.client', () => ({
    prisma: {
        user_info: {
            findUnique: jest.fn<Promise<{ id: string } | null>, [Prisma.user_infoFindUniqueArgs]>(),
            update: jest.fn<Promise<void>, [Prisma.user_infoUpdateArgs]>(),
            create: jest.fn<Promise<void>, [Prisma.user_infoCreateArgs]>()
        }
    }
}));

describe('syncUserData', () => {
    const mockUserId = 'user123';
    const baseUserData: UserSyncRequestData = {
        userId: mockUserId,
        email: 'test@example.com'
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should update existing user with all fields', async () => {
        const mockUserData: UserSyncRequestData = {
            ...baseUserData,
            nickname: 'Test User',
            avatar: 'avatar.jpg',
            phone: '1234567890',
            password: 'secure123'
        };

        (prisma.user_info.findUnique as jest.Mock).mockResolvedValue({
            id: mockUserId
        });

        await syncUserData(mockUserData);

        expect(prisma.user_info.findUnique).toHaveBeenCalledWith({
            where: { id: mockUserId }
        });

        expect(prisma.user_info.update).toHaveBeenCalledWith({
            where: { id: mockUserId },
            data: {
                nickname: 'Test User',
                avatar: 'avatar.jpg',
                phone: '1234567890',
                password: 'secure123',
                email: 'test@example.com',
                update_date: expect.any(Date)
            }
        });
    });

    it('should update existing user with partial fields', async () => {
        const mockUserData: UserSyncRequestData = {
            ...baseUserData,
            nickname: 'Partial Update'
        };

        (prisma.user_info.findUnique as jest.Mock).mockResolvedValue({
            id: mockUserId
        });

        await syncUserData(mockUserData);

        expect(prisma.user_info.update).toHaveBeenCalledWith({
            where: { id: mockUserId },
            data: {
                nickname: 'Partial Update',
                email: 'test@example.com',
                update_date: expect.any(Date)
            }
        });
    });

    it('should create new user when not found', async () => {
        (prisma.user_info.findUnique as jest.Mock).mockResolvedValue(null);

        const mockUserData: UserSyncRequestData = {
            ...baseUserData,
            nickname: 'New User',
            avatar: 'new.jpg',
            phone: '9876543210',
            password: 'newpass123'
        };

        await syncUserData(mockUserData);

        expect(prisma.user_info.create).toHaveBeenCalledWith({
            data: {
                id: mockUserId,
                nickname: 'New User',
                avatar: 'new.jpg',
                phone: '9876543210',
                password: 'newpass123',
                email: 'test@example.com',
                reg_date: expect.any(Date),
                update_date: expect.any(Date)
            }
        });
    });

    it('should throw error when email is missing', async () => {
        const invalidUserData = {
            userId: mockUserId
        } as UserSyncRequestData;

        await expect(syncUserData(invalidUserData)).rejects.toThrow();
    });
});
