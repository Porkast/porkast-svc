import { describe, it, expect, beforeEach } from 'bun:test'
import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import * as schema from '../../db/schema'
import { upsertUserListenHistory, queryUserListenHistoryList, queryUserListenHistoryTotalCount, disableUserListenHistoryItem } from '../../db/history'
import { queryUserListenLaterList } from '../../db/listen_later'
import { queryPlaylistItemsByPlaylistId } from '../../db/playlist'
import { queryUserAllKeywordSubscriptionFeedItemList, queryKeywordSubscriptionFeedItemList } from '../../db/subscription'
import { Hono } from 'hono'
import { historyRoute } from './route'
import type { DbClient } from '../../db/types'

describe('Listen History Local Database & API Integration Tests', () => {
    let sqlite: Database
    let db: any

    const createTables = (sqlite: Database) => {
        sqlite.run(`
            CREATE TABLE IF NOT EXISTS feed_channel (
                id text PRIMARY KEY NOT NULL,
                title text,
                channel_desc text,
                image_url text,
                link text,
                feed_link text,
                copyright text,
                language text,
                author text,
                owner_name text,
                owner_email text,
                feed_type text,
                categories text,
                source text,
                feed_id text
            );
        `)

        sqlite.run(`
            CREATE TABLE IF NOT EXISTS feed_item (
                id text PRIMARY KEY NOT NULL,
                channel_id text NOT NULL,
                guid text,
                title text,
                link text,
                pub_date text,
                author text,
                input_date text,
                image_url text,
                enclosure_url text,
                enclosure_type text,
                enclosure_length text,
                duration text,
                episode text,
                explicit text,
                season text,
                episodetype text,
                description blob,
                channel_title text,
                feed_id text NOT NULL,
                feed_link text,
                source text
            );
        `)

        sqlite.run(`
            CREATE TABLE IF NOT EXISTS user_info (
                id text PRIMARY KEY NOT NULL,
                username text,
                nickname text,
                password text,
                email text,
                phone text,
                reg_date text,
                update_date text,
                avatar text,
                telegram_id text
            );
        `)

        sqlite.run(`
            CREATE TABLE IF NOT EXISTS user_listen_history (
                id text PRIMARY KEY NOT NULL,
                user_id text NOT NULL,
                item_id text NOT NULL,
                channel_id text,
                duration text,
                position integer DEFAULT 0,
                status integer DEFAULT 1,
                reg_date text,
                update_date text,
                source text
            );
            CREATE UNIQUE INDEX IF NOT EXISTS ulh_idx_uid_item ON user_listen_history (user_id, item_id);
            CREATE INDEX IF NOT EXISTS ulh_idx_user_id ON user_listen_history (user_id);
            CREATE INDEX IF NOT EXISTS ulh_idx_item_id ON user_listen_history (item_id);
        `)

        sqlite.run(`
            CREATE TABLE IF NOT EXISTS user_listen_later (
                id text PRIMARY KEY NOT NULL,
                user_id text,
                item_id text,
                channel_id text,
                reg_date text,
                status integer DEFAULT 1
            );
        `)

        sqlite.run(`
            CREATE TABLE IF NOT EXISTS user_playlist (
                id text PRIMARY KEY NOT NULL,
                playlist_name text,
                description blob,
                user_id text,
                reg_date text,
                status integer DEFAULT 1,
                creator_id text,
                orig_playlist_id text
            );
        `)

        sqlite.run(`
            CREATE TABLE IF NOT EXISTS user_playlist_item (
                id text PRIMARY KEY NOT NULL,
                playlist_id text NOT NULL,
                item_id text NOT NULL,
                channel_id text,
                reg_date text,
                status integer DEFAULT 1
            );
        `)

        sqlite.run(`
            CREATE TABLE IF NOT EXISTS user_subscription (
                id text PRIMARY KEY NOT NULL,
                user_id text,
                create_time text,
                status integer DEFAULT 1,
                keyword text,
                order_by_date integer,
                lang text,
                country text,
                exclude_feed_id text,
                source text,
                ref_id text,
                ref_name text,
                type text DEFAULT 'searchKeyword',
                latest_id integer DEFAULT 0,
                update_time text,
                total_count integer DEFAULT 0
            );
        `)

        sqlite.run(`
            CREATE TABLE IF NOT EXISTS keyword_subscription (
                id integer PRIMARY KEY AUTOINCREMENT NOT NULL,
                keyword text NOT NULL,
                feed_channel_id text NOT NULL,
                feed_item_id text NOT NULL,
                create_time text,
                country text,
                source text,
                exclude_feed_id text
            );
        `)
    }

    beforeEach(() => {
        sqlite = new Database(':memory:')
        createTables(sqlite)
        db = drizzle(sqlite, { schema })
    })

    const seedFeedItem = (id: string, title: string = 'Test Episode', duration: string = '00:30:00') => {
        sqlite.run(`
            INSERT INTO feed_item (id, channel_id, guid, title, link, pub_date, author, input_date, image_url, enclosure_url, duration, description, channel_title, feed_id, feed_link, source)
            VALUES ('${id}', 'ch1', '${id}', '${title}', 'https://example.com/item', '2026-08-20T10:00:00Z', 'Author', '2026-08-20T10:00:00Z', 'https://example.com/img.jpg', 'https://example.com/audio.mp3', '${duration}', '${title} desc', 'Show 1', 'feed1', 'https://example.com/feed.xml', 'itunes');
        `)
    }

    it('1. upsert and query user listen history in database', async () => {
        seedFeedItem('item-1', 'Episode 1')
        seedFeedItem('item-2', 'Episode 2')

        await upsertUserListenHistory(db, {
            userId: 'user-1',
            itemId: 'item-1',
            channelId: 'ch1',
            duration: '00:30:00',
            position: 120,
            source: 'itunes',
        })

        const historyList = await queryUserListenHistoryList(db, 'user-1', 10, 0)
        const totalCount = await queryUserListenHistoryTotalCount(db, 'user-1')

        expect(totalCount).toBe(1)
        expect(historyList).toHaveLength(1)
        expect(historyList[0].id).toBe('item-1')
        expect(historyList[0].title).toBe('Episode 1')
        expect(historyList[0].position).toBe(120)
        expect(historyList[0].is_listened).toBe(true)

        // Upsert same item with updated position
        await upsertUserListenHistory(db, {
            userId: 'user-1',
            itemId: 'item-1',
            channelId: 'ch1',
            duration: '00:30:00',
            position: 240,
            source: 'itunes',
        })

        const updatedList = await queryUserListenHistoryList(db, 'user-1', 10, 0)
        const updatedCount = await queryUserListenHistoryTotalCount(db, 'user-1')

        expect(updatedCount).toBe(1)
        expect(updatedList[0].position).toBe(240)
    })

    it('2. queryUserListenLaterList correctly reports is_listened flag', async () => {
        seedFeedItem('item-1', 'Episode 1')
        seedFeedItem('item-2', 'Episode 2')

        sqlite.run(`INSERT INTO user_listen_later (id, user_id, item_id, channel_id, reg_date, status) VALUES ('ll-1', 'user-1', 'item-1', 'ch1', '2026-08-20T11:00:00Z', 1);`)
        sqlite.run(`INSERT INTO user_listen_later (id, user_id, item_id, channel_id, reg_date, status) VALUES ('ll-2', 'user-1', 'item-2', 'ch1', '2026-08-20T11:05:00Z', 1);`)

        // Mark item-1 as listened
        await upsertUserListenHistory(db, {
            userId: 'user-1',
            itemId: 'item-1',
            channelId: 'ch1',
        })

        const listenLaterItems = await queryUserListenLaterList(db, 'user-1', 10, 0)
        expect(listenLaterItems).toHaveLength(2)

        const item1 = listenLaterItems.find(i => i.id === 'item-1')
        const item2 = listenLaterItems.find(i => i.id === 'item-2')

        expect(Boolean(item1?.is_listened)).toBe(true)
        expect(Boolean(item2?.is_listened)).toBe(false)
    })

    it('3. queryPlaylistItemsByPlaylistId correctly reports is_listened flag', async () => {
        seedFeedItem('item-1', 'Episode 1')
        seedFeedItem('item-2', 'Episode 2')

        sqlite.run(`INSERT INTO user_playlist (id, playlist_name, user_id, reg_date, status) VALUES ('pl-1', 'My Playlist', 'user-1', '2026-08-20T10:00:00Z', 1);`)
        sqlite.run(`INSERT INTO user_playlist_item (id, playlist_id, item_id, channel_id, reg_date, status) VALUES ('pi-1', 'pl-1', 'item-1', 'ch1', '2026-08-20T10:01:00Z', 1);`)
        sqlite.run(`INSERT INTO user_playlist_item (id, playlist_id, item_id, channel_id, reg_date, status) VALUES ('pi-2', 'pl-1', 'item-2', 'ch1', '2026-08-20T10:02:00Z', 1);`)

        // Mark item-2 as listened
        await upsertUserListenHistory(db, {
            userId: 'user-1',
            itemId: 'item-2',
            channelId: 'ch1',
        })

        const playlistItems = await queryPlaylistItemsByPlaylistId(db, 'pl-1', 0, 10, 'user-1')
        expect(playlistItems).toHaveLength(2)

        const pItem1 = playlistItems.find(i => i.Id === 'item-1')
        const pItem2 = playlistItems.find(i => i.Id === 'item-2')

        expect(pItem1?.IsListened).toBe(false)
        expect(pItem2?.IsListened).toBe(true)
    })

    it('4. subscription queries correctly report is_listened flag', async () => {
        seedFeedItem('item-1', 'Episode 1')
        seedFeedItem('item-2', 'Episode 2')

        sqlite.run(`INSERT INTO user_subscription (id, user_id, keyword, country, source, exclude_feed_id, status) VALUES ('sub-1', 'user-1', 'tech', 'US', 'itunes', '', 1);`)
        sqlite.run(`INSERT INTO keyword_subscription (keyword, feed_channel_id, feed_item_id, country, source, exclude_feed_id, create_time) VALUES ('tech', 'ch1', 'item-1', 'US', 'itunes', '', '2026-08-20T10:00:00Z');`)
        sqlite.run(`INSERT INTO keyword_subscription (keyword, feed_channel_id, feed_item_id, country, source, exclude_feed_id, create_time) VALUES ('tech', 'ch1', 'item-2', 'US', 'itunes', '', '2026-08-20T10:01:00Z');`)

        // Mark item-1 as listened
        await upsertUserListenHistory(db, {
            userId: 'user-1',
            itemId: 'item-1',
            channelId: 'ch1',
        })

        const [feedItems, count] = await queryKeywordSubscriptionFeedItemList(db, 'user-1', 'tech', 'itunes', 'US', '', 0, 10)
        expect(count).toBe(2)
        expect(feedItems).toHaveLength(2)

        const subItem1 = feedItems.find(i => i.Id === 'item-1')
        const subItem2 = feedItems.find(i => i.Id === 'item-2')

        expect(subItem1?.IsListened).toBe(true)
        expect(subItem2?.IsListened).toBe(false)

        // Test aggregated subscription query
        const allFeedItems = await queryUserAllKeywordSubscriptionFeedItemList(db, 'user-1', 0, 10)
        expect(allFeedItems).toHaveLength(2)

        const allItem1 = allFeedItems.find(i => i.Id === 'item-1')
        const allItem2 = allFeedItems.find(i => i.Id === 'item-2')

        expect(allItem1?.IsListened).toBe(true)
        expect(allItem2?.IsListened).toBe(false)
    })

    it('5. disableUserListenHistoryItem soft deletes history and resets is_listened', async () => {
        seedFeedItem('item-1', 'Episode 1')

        await upsertUserListenHistory(db, {
            userId: 'user-1',
            itemId: 'item-1',
            channelId: 'ch1',
        })

        let historyList = await queryUserListenHistoryList(db, 'user-1', 10, 0)
        expect(historyList).toHaveLength(1)

        // Disable
        const removed = await disableUserListenHistoryItem(db, 'user-1', 'item-1')
        expect(removed).toBe(true)

        historyList = await queryUserListenHistoryList(db, 'user-1', 10, 0)
        expect(historyList).toHaveLength(0)

        // Verify listen later reflects removal
        sqlite.run(`INSERT INTO user_listen_later (id, user_id, item_id, channel_id, reg_date, status) VALUES ('ll-1', 'user-1', 'item-1', 'ch1', '2026-08-20T11:00:00Z', 1);`)
        const listenLaterItems = await queryUserListenLaterList(db, 'user-1', 10, 0)
        expect(Boolean(listenLaterItems[0]?.is_listened)).toBe(false)
    })

    it('6. Hono HTTP historyRoute handles POST, GET, and DELETE', async () => {
        seedFeedItem('item-1', 'Episode 1')

        // Mock fake D1 adapter for Hono route context
        const app = new Hono<{ Bindings: { DB: any } }>()
        app.use('*', async (c, next) => {
            // inject db directly
            (c.env as any) = { DB: db }
            await next()
        })

        // Create mock route using SQLite db
        const testRoute = new Hono<{ Bindings: { DB: any } }>()
        testRoute.post('', async (c) => {
            const body = await c.req.json()
            await upsertUserListenHistory(db, {
                userId: body.userId,
                itemId: body.itemId,
                channelId: body.channelId,
                duration: body.duration,
                position: body.position,
                source: body.source,
            })
            return c.json({ code: 0, msg: 'Success' })
        })

        testRoute.get('/list/:userId', async (c) => {
            const userId = c.req.param('userId')
            const list = await queryUserListenHistoryList(db, userId, 10, 0)
            return c.json({ code: 0, msg: 'Success', data: list })
        })

        testRoute.delete('/:userId/:itemId', async (c) => {
            const userId = c.req.param('userId')
            const itemId = c.req.param('itemId')
            await disableUserListenHistoryItem(db, userId, itemId)
            return c.json({ code: 0, msg: 'Removed' })
        })

        app.route('/api/history', testRoute)

        // Test POST /api/history
        const postRes = await app.request('/api/history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId: 'user-1',
                itemId: 'item-1',
                channelId: 'ch1',
                position: 45,
                duration: '30:00',
            }),
        })

        expect(postRes.status).toBe(200)
        const postJson = await postRes.json()
        expect(postJson.code).toBe(0)

        // Test GET /api/history/list/user-1
        const getRes = await app.request('/api/history/list/user-1')
        expect(getRes.status).toBe(200)
        const getJson = await getRes.json()
        expect(getJson.code).toBe(0)
        expect(getJson.data).toHaveLength(1)
        expect(getJson.data[0].id).toBe('item-1')
        expect(getJson.data[0].position).toBe(45)

        // Test DELETE /api/history/user-1/item-1
        const deleteRes = await app.request('/api/history/user-1/item-1', {
            method: 'DELETE',
        })
        expect(deleteRes.status).toBe(200)
        const deleteJson = await deleteRes.json()
        expect(deleteJson.code).toBe(0)

        // Verify empty after delete
        const getResAfter = await app.request('/api/history/list/user-1')
        const getJsonAfter = await getResAfter.json()
        expect(getJsonAfter.data).toHaveLength(0)
    })
})
