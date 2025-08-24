import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { syncUserData, getUserInfoByTelegramId } from './user';
import prisma from '../../db/prisma.client';
import type { UserSyncRequestData, UserInfo } from './types';

// Mock Prisma client
const prismaMock = {
    user_info: {
        findUnique: mock(),
        update: mock(),
        create: mock(),
        findFirst: mock()
    }
};

// Mock the prisma client module
mock.module('../db/prisma.client', () => ({
    default: prismaMock
}));

describe('User API Tests', () => {
    beforeEach(() => {
        // Reset all mocks before each test
        prismaMock.user_info.findUnique.mockReset();
        prismaMock.user_info.update.mockReset();
        prismaMock.user_info.create.mockReset();
        prismaMock.user_info.findFirst.mockReset();
    });

    describe('syncUserData()', () => {
        it('should create new user when user does not exist', async () => {
            const testData: UserSyncRequestData = {
                userId: '123',
                nickname: 'testuser',
                email: 'test@example.com',
                phone: '1234567890',
                avatar: 'avatar.jpg',
                password: 'password123'
            };

            // Mock findUnique to return null (user doesn't exist)
            prismaMock.user_info.findUnique.mockResolvedValue(null);

            await syncUserData(testData);

            // Verify create was called with correct data
            expect(prismaMock.user_info.create).toHaveBeenCalledWith({
                data: {
                    id: testData.userId,
                    nickname: testData.nickname,
                    password: testData.password,
                    email: testData.email,
                    phone: testData.phone,
                    avatar: testData.avatar,
                    reg_date: expect.any(Date),
                    update_date: expect.any(Date),
                }
            });
        });

        it('should update existing user with partial data', async () => {
            const testData: UserSyncRequestData = {
                userId: '123',
                email: 'new@example.com',
                avatar: 'new-avatar.jpg'
            };

            // Mock findUnique to return existing user
            prismaMock.user_info.findUnique.mockResolvedValue({
                id: '123',
                nickname: 'olduser',
                email: 'old@example.com',
                phone: '9876543210',
                avatar: 'old-avatar.jpg',
                password: 'oldpass'
            });

            await syncUserData(testData);

            // Verify update was called with correct partial data
            expect(prismaMock.user_info.update).toHaveBeenCalledWith({
                where: { id: testData.userId },
                data: {
                    email: testData.email,
                    avatar: testData.avatar,
                    update_date: expect.any(Date)
                }
            });
        });

        it('should handle empty optional fields', async () => {
            const testData: UserSyncRequestData = {
                userId: '123',
                email: 'test@example.com'
            };

            prismaMock.user_info.findUnique.mockResolvedValue(null);

            await syncUserData(testData);

            expect(prismaMock.user_info.create).toHaveBeenCalledWith({
                data: {
                    id: testData.userId,
                    email: testData.email,
                    reg_date: expect.any(Date),
                    update_date: expect.any(Date),
                    nickname: undefined,
                    password: undefined,
                    phone: undefined,
                    avatar: undefined
                }
            });
        });
    });

    describe('getUserInfoByTelegramId()', () => {
        it('should return user info when user exists', async () => {
            const mockUser = {
                id: '123',
                telegram_id: 'telegram123',
                nickname: 'testuser',
                email: 'test@example.com',
                phone: '1234567890',
                avatar: 'avatar.jpg',
                password: 'password123'
            };

            prismaMock.user_info.findFirst.mockResolvedValue(mockUser);

            const result = await getUserInfoByTelegramId('telegram123');

            expect(result).toEqual({
                userId: '123',
                telegramId: 'telegram123',
                nickname: 'testuser',
                password: 'password123',
                email: 'test@example.com',
                phone: '1234567890',
                avatar: 'avatar.jpg'
            });
        });

        it('should return empty fields when user not found', async () => {
            prismaMock.user_info.findFirst.mockResolvedValue(null);

            const result = await getUserInfoByTelegramId('nonexistent');

            expect(result).toEqual({
                userId: '',
                telegramId: '',
                nickname: '',
                password: '',
                email: '',
                phone: '',
                avatar: ''
            });
        });

        it('should handle empty telegramId', async () => {
            prismaMock.user_info.findFirst.mockResolvedValue(null);

            const result = await getUserInfoByTelegramId('');

            expect(result).toEqual({
                userId: '',
                telegramId: '',
                nickname: '',
                password: '',
                email: '',
                phone: '',
                avatar: ''
            });
        });
    });
});
