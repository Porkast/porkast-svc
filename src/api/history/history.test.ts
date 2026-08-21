import { describe, it, expect, beforeEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import * as schema from '../../db/schema';
import { recordEpisodeListenHistory, getUserListenHistory, removeEpisodeFromListenHistory } from './history';
import { RecordListenHistoryRequest } from './types';

describe('history service unit tests', () => {
    let sqlite: Database;
    let db: any;

    beforeEach(() => {
        sqlite = new Database(':memory:');
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
        `);
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
        `);
        db = drizzle(sqlite, { schema });
    });

    const mockRequest: RecordListenHistoryRequest = {
        userId: 'user123',
        itemId: 'item456',
        channelId: 'channel789',
        duration: '00:30:00',
        position: 120,
        source: 'itunes',
    };

    it('records listen history successfully', async () => {
        sqlite.run(`
            INSERT INTO feed_item (id, channel_id, guid, title, link, pub_date, author, input_date, image_url, enclosure_url, duration, description, channel_title, feed_id, feed_link, source)
            VALUES ('item456', 'channel789', 'item456', 'Episode 1', '', '2024-01-01', 'Author', '2024-01-01', '', '', '30:00', 'desc', 'Show', 'feed789', '', 'itunes');
        `);

        const result = await recordEpisodeListenHistory(db, mockRequest);
        expect(result).toBe('Done');

        const history = await getUserListenHistory(db, 'user123', 10, 0);
        expect(history).toHaveLength(1);
        expect(history[0].id).toBe('item456');
    });

    it('gets user listen history list with counts and formatted dates when items exist', async () => {
        sqlite.run(`
            INSERT INTO feed_item (id, channel_id, guid, title, link, pub_date, author, input_date, image_url, enclosure_url, duration, description, channel_title, feed_id, feed_link, source)
            VALUES ('item456', 'channel789', 'item456', 'Episode 1', '', '2024-01-01', 'Author', '2024-01-01', '', '', '30:00', 'desc', 'Show', 'feed789', '', 'itunes');
        `);

        await recordEpisodeListenHistory(db, mockRequest);

        const list = await getUserListenHistory(db, 'user123', 10, 0);

        expect(list).toHaveLength(1);
        expect(list[0].id).toBe('item456');
        expect(list[0].title).toBe('Episode 1');
        expect(list[0].count).toBe(1);
        expect(list[0].is_listened).toBe(true);
        expect(list[0].position).toBe(120);
    });

    it('removes episode from listen history', async () => {
        await recordEpisodeListenHistory(db, mockRequest);

        await removeEpisodeFromListenHistory(db, 'user123', 'item456');

        const rows = sqlite.query("SELECT status FROM user_listen_history WHERE user_id = 'user123' AND item_id = 'item456'").all() as any[];
        expect(rows).toHaveLength(1);
        expect(rows[0].status).toBe(0);
    });
});
