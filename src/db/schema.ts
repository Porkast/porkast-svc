import { sqliteTable, text, integer, blob, uniqueIndex, index } from 'drizzle-orm/sqlite-core'

export const feedChannel = sqliteTable('feed_channel', {
  id: text('id').primaryKey(),
  title: text('title'),
  channelDesc: text('channel_desc'),
  imageUrl: text('image_url'),
  link: text('link'),
  feedLink: text('feed_link'),
  copyright: text('copyright'),
  language: text('language'),
  author: text('author'),
  ownerName: text('owner_name'),
  ownerEmail: text('owner_email'),
  feedType: text('feed_type'),
  categories: text('categories'),
  source: text('source'),
  feedId: text('feed_id'),
})

export const feedItem = sqliteTable('feed_item', {
  id: text('id').primaryKey(),
  channelId: text('channel_id').notNull(),
  guid: text('guid'),
  title: text('title'),
  link: text('link'),
  pubDate: text('pub_date'),
  author: text('author'),
  inputDate: text('input_date'),
  imageUrl: text('image_url'),
  enclosureUrl: text('enclosure_url'),
  enclosureType: text('enclosure_type'),
  enclosureLength: text('enclosure_length'),
  duration: text('duration'),
  episode: text('episode'),
  explicit: text('explicit'),
  season: text('season'),
  episodetype: text('episodetype'),
  description: blob('description'),
  channelTitle: text('channel_title'),
  feedId: text('feed_id').notNull(),
  feedLink: text('feed_link'),
  source: text('source'),
}, (table) => ({
  channelIdIdx: index('rfi_idx_channel_id').on(table.channelId),
  pubDateIdx: index('rfi_idx_pub_date').on(table.pubDate),
}))

export const keywordSubscription = sqliteTable('keyword_subscription', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  keyword: text('keyword').notNull(),
  feedChannelId: text('feed_channel_id').notNull(),
  feedItemId: text('feed_item_id').notNull(),
  createTime: text('create_time'),
  country: text('country'),
  source: text('source'),
  excludeFeedId: text('exclude_feed_id'),
}, (table) => ({
  uniqueIdx: uniqueIndex('ks_idx_uniq').on(table.keyword, table.feedChannelId, table.feedItemId, table.country, table.source, table.excludeFeedId),
  kcseIdx: index('ks_idx_kcse').on(table.keyword, table.country, table.source, table.excludeFeedId),
  keywordIdx: index('ks_idx_keyword').on(table.keyword),
  feedItemIdIdx: index('ks_idx_feed_item_id').on(table.feedItemId, table.createTime),
  feedItemIdKcseIdx: index('ks_idx_fi_kcse').on(table.feedItemId, table.keyword, table.country, table.source, table.excludeFeedId),
}))

export const userInfo = sqliteTable('user_info', {
  id: text('id').primaryKey(),
  username: text('username'),
  nickname: text('nickname'),
  password: text('password'),
  email: text('email'),
  phone: text('phone'),
  regDate: text('reg_date'),
  updateDate: text('update_date'),
  avatar: text('avatar'),
  telegramId: text('telegram_id'),
})

export const verificationToken = sqliteTable('verification_token', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  token: text('token').notNull(),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').notNull(),
}, (table) => ({
  emailTokenUnique: uniqueIndex('verification_token_email_token_unique').on(table.email, table.token),
}))

export const appSession = sqliteTable('app_session', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  tokenHash: text('token_hash').notNull(),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').notNull(),
  revokedAt: text('revoked_at'),
}, (table) => ({
  tokenHashUnique: uniqueIndex('app_session_token_hash_unique').on(table.tokenHash),
  userIdIdx: index('app_session_user_id_idx').on(table.userId),
  expiresAtIdx: index('app_session_expires_at_idx').on(table.expiresAt),
}))

export const userListenLater = sqliteTable('user_listen_later', {
  id: text('id').primaryKey(),
  userId: text('user_id'),
  itemId: text('item_id'),
  channelId: text('channel_id'),
  regDate: text('reg_date'),
  status: integer('status').default(1),
}, (table) => ({
  itemIdIdx: index('ull_idx_item_id').on(table.itemId),
  userIdIdx: index('ull_idx_user_id').on(table.userId),
}))

export const userPlaylist = sqliteTable('user_playlist', {
  id: text('id').primaryKey(),
  playlistName: text('playlist_name'),
  description: blob('description'),
  userId: text('user_id'),
  regDate: text('reg_date'),
  status: integer('status').default(1),
  creatorId: text('creator_id'),
  origPlaylistId: text('orig_playlist_id'),
}, (table) => ({
  userIdPlaylistNameUnique: uniqueIndex('up_idx_uid_name').on(table.userId, table.playlistName),
  userIdIdx: index('up_idx_user_id').on(table.userId),
}))

export const userPlaylistItem = sqliteTable('user_playlist_item', {
  id: text('id').primaryKey(),
  playlistId: text('playlist_id').notNull(),
  itemId: text('item_id').notNull(),
  channelId: text('channel_id'),
  regDate: text('reg_date'),
  status: integer('status').default(1),
}, (table) => ({
  playlistIdUnique: uniqueIndex('upi_idx_playlist_id').on(table.playlistId),
}))

export const userSubscription = sqliteTable('user_subscription', {
  id: text('id').primaryKey(),
  userId: text('user_id'),
  createTime: text('create_time'),
  status: integer('status').default(1),
  keyword: text('keyword'),
  orderByDate: integer('order_by_date'),
  lang: text('lang'),
  country: text('country'),
  excludeFeedId: text('exclude_feed_id'),
  source: text('source'),
  refId: text('ref_id'),
  refName: text('ref_name'),
  type: text('type').default('searchKeyword'),
  latestId: integer('latest_id').default(0),
  updateTime: text('update_time'),
  totalCount: integer('total_count').default(0),
}, (table) => ({
  keywordIdx: index('usk_idx_keyword').on(table.keyword),
  userIdIdx: index('usk_idx_user_id').on(table.userId),
  userIdKeywordSourceIdx: index('usk_user_id_keyword').on(table.userId, table.keyword, table.source),
}))

export const userMembership = sqliteTable('user_membership', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  productId: text('product_id').notNull(),
  tier: text('tier').notNull(),
  originalTransactionId: text('original_transaction_id').notNull(),
  latestTransactionId: text('latest_transaction_id'),
  expiresDate: text('expires_date'),
  isActive: integer('is_active', { mode: 'boolean' }).default(false),
  willRenew: integer('will_renew', { mode: 'boolean' }).default(true),
  isInBillingRetry: integer('is_in_billing_retry', { mode: 'boolean' }).default(false),
  environment: text('environment').default('Production'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => ({
  originalTransactionIdUnique: uniqueIndex('user_membership_original_transaction_id_unique').on(table.originalTransactionId),
  userIdIdx: index('user_membership_user_id_idx').on(table.userId),
}))
