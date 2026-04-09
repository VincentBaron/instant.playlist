import { Kysely, sql } from 'kysely'

/**
 * Migration: Replace Clerk auth with Better Auth
 *
 * Creates Better Auth core tables (user, session, account, verification)
 * and organization plugin tables (organization, member, invitation)
 * with snake_case columns. Drops clerk_id from the users table.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  // 1. Create Better Auth core tables

  await db.schema
    .createTable('user')
    .ifNotExists()
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('email', 'text', (col) => col.notNull().unique())
    .addColumn('email_verified', 'boolean', (col) => col.notNull())
    .addColumn('image', 'text')
    .addColumn('role', 'text', (col) => col.notNull().defaultTo('user'))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute()

  await db.schema
    .createTable('session')
    .ifNotExists()
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('expires_at', 'timestamptz', (col) => col.notNull())
    .addColumn('token', 'text', (col) => col.notNull().unique())
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull())
    .addColumn('ip_address', 'text')
    .addColumn('user_agent', 'text')
    .addColumn('user_id', 'text', (col) => col.notNull().references('user.id').onDelete('cascade'))
    .addColumn('active_organization_id', 'text')
    .execute()

  await db.schema
    .createIndex('session_user_id_idx')
    .ifNotExists()
    .on('session')
    .column('user_id')
    .execute()

  await db.schema
    .createTable('account')
    .ifNotExists()
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('account_id', 'text', (col) => col.notNull())
    .addColumn('provider_id', 'text', (col) => col.notNull())
    .addColumn('user_id', 'text', (col) => col.notNull().references('user.id').onDelete('cascade'))
    .addColumn('access_token', 'text')
    .addColumn('refresh_token', 'text')
    .addColumn('id_token', 'text')
    .addColumn('access_token_expires_at', 'timestamptz')
    .addColumn('refresh_token_expires_at', 'timestamptz')
    .addColumn('scope', 'text')
    .addColumn('password', 'text')
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull())
    .execute()

  await db.schema
    .createIndex('account_user_id_idx')
    .ifNotExists()
    .on('account')
    .column('user_id')
    .execute()

  await db.schema
    .createTable('verification')
    .ifNotExists()
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('identifier', 'text', (col) => col.notNull())
    .addColumn('value', 'text', (col) => col.notNull())
    .addColumn('expires_at', 'timestamptz', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute()

  await db.schema
    .createIndex('verification_identifier_idx')
    .ifNotExists()
    .on('verification')
    .column('identifier')
    .execute()

  // 2. Create Better Auth organization plugin tables

  await db.schema
    .createTable('organization')
    .ifNotExists()
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('slug', 'text', (col) => col.notNull().unique())
    .addColumn('logo', 'text')
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('metadata', 'text')
    .execute()

  await db.schema
    .createTable('member')
    .ifNotExists()
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('organization_id', 'text', (col) =>
      col.notNull().references('organization.id').onDelete('cascade')
    )
    .addColumn('user_id', 'text', (col) =>
      col.notNull().references('user.id').onDelete('cascade')
    )
    .addColumn('role', 'text', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute()

  await db.schema
    .createIndex('member_organization_id_idx')
    .ifNotExists()
    .on('member')
    .column('organization_id')
    .execute()

  await db.schema
    .createIndex('member_user_id_idx')
    .ifNotExists()
    .on('member')
    .column('user_id')
    .execute()

  await db.schema
    .createTable('invitation')
    .ifNotExists()
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('organization_id', 'text', (col) =>
      col.notNull().references('organization.id').onDelete('cascade')
    )
    .addColumn('email', 'text', (col) => col.notNull())
    .addColumn('role', 'text')
    .addColumn('status', 'text', (col) => col.notNull())
    .addColumn('expires_at', 'timestamptz', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('inviter_id', 'text', (col) =>
      col.notNull().references('user.id').onDelete('cascade')
    )
    .execute()

  await db.schema
    .createIndex('invitation_email_idx')
    .ifNotExists()
    .on('invitation')
    .column('email')
    .execute()

  await db.schema
    .createIndex('invitation_organization_id_idx')
    .ifNotExists()
    .on('invitation')
    .column('organization_id')
    .execute()

  // 3. Drop Clerk-specific columns from users table
  await sql`ALTER TABLE users DROP COLUMN IF EXISTS clerk_id`.execute(db)
}

export async function down(db: Kysely<unknown>): Promise<void> {
  // Drop org tables
  await db.schema.dropTable('invitation').ifExists().execute()
  await db.schema.dropTable('member').ifExists().execute()
  await db.schema.dropTable('organization').ifExists().execute()

  // Drop core auth tables
  await db.schema.dropTable('verification').ifExists().execute()
  await db.schema.dropTable('account').ifExists().execute()
  await db.schema.dropTable('session').ifExists().execute()
  await db.schema.dropTable('user').ifExists().execute()

  // Restore clerk_id column
  await db.schema
    .alterTable('users')
    .addColumn('clerk_id', 'varchar(255)', (col) => col.unique())
    .execute()
}
