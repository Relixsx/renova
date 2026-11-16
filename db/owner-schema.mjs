import { pgSchema, text, timestamp, boolean, integer, bigint, index, uniqueIndex } from 'drizzle-orm/pg-core';
const owner = pgSchema('renova_auth');
const time = name => timestamp(name,{withTimezone:true,mode:'date'});
export const user = owner.table('user',{
  id:text('id').primaryKey(),name:text('name').notNull(),email:text('email').notNull().unique(),
  emailVerified:boolean('email_verified').notNull().default(false),image:text('image'),
  createdAt:time('created_at').notNull().defaultNow(),updatedAt:time('updated_at').notNull().defaultNow(),
});
export const session = owner.table('session',{
  id:text('id').primaryKey(),token:text('token').notNull().unique(),expiresAt:time('expires_at').notNull(),
  userId:text('user_id').notNull().references(()=>user.id,{onDelete:'cascade'}),
  ipAddress:text('ip_address'),userAgent:text('user_agent'),
  createdAt:time('created_at').notNull().defaultNow(),updatedAt:time('updated_at').notNull().defaultNow(),
},table=>[index('owner_session_user_idx').on(table.userId)]);
export const account = owner.table('account',{
  id:text('id').primaryKey(),accountId:text('account_id').notNull(),providerId:text('provider_id').notNull(),
  userId:text('user_id').notNull().references(()=>user.id,{onDelete:'cascade'}),password:text('password'),
  accessToken:text('access_token'),refreshToken:text('refresh_token'),idToken:text('id_token'),scope:text('scope'),
  accessTokenExpiresAt:time('access_token_expires_at'),refreshTokenExpiresAt:time('refresh_token_expires_at'),
  createdAt:time('created_at').notNull().defaultNow(),updatedAt:time('updated_at').notNull().defaultNow(),
},table=>[index('owner_account_user_idx').on(table.userId),uniqueIndex('owner_account_provider_idx').on(table.providerId,table.accountId)]);
export const verification = owner.table('verification',{
  id:text('id').primaryKey(),identifier:text('identifier').notNull(),value:text('value').notNull(),
  expiresAt:time('expires_at').notNull(),createdAt:time('created_at').notNull().defaultNow(),updatedAt:time('updated_at').notNull().defaultNow(),
},table=>[index('owner_verification_identifier_idx').on(table.identifier)]);
export const rateLimit = owner.table('rate_limit',{
  id:text('id').primaryKey(),key:text('key').notNull().unique(),count:integer('count').notNull(),lastRequest:bigint('last_request',{mode:'number'}).notNull(),
});
