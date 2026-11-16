CREATE SCHEMA IF NOT EXISTS renova_auth;
CREATE TABLE IF NOT EXISTS renova_auth."user" (
 id text PRIMARY KEY,name text NOT NULL,email text NOT NULL UNIQUE,email_verified boolean NOT NULL DEFAULT false,image text,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS renova_auth.session (
 id text PRIMARY KEY,token text NOT NULL UNIQUE,expires_at timestamptz NOT NULL,user_id text NOT NULL REFERENCES renova_auth."user"(id) ON DELETE CASCADE,
 ip_address text,user_agent text,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS owner_session_user_idx ON renova_auth.session(user_id);
CREATE TABLE IF NOT EXISTS renova_auth.account (
 id text PRIMARY KEY,account_id text NOT NULL,provider_id text NOT NULL,user_id text NOT NULL REFERENCES renova_auth."user"(id) ON DELETE CASCADE,
 password text,access_token text,refresh_token text,id_token text,scope text,access_token_expires_at timestamptz,refresh_token_expires_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS owner_account_user_idx ON renova_auth.account(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS owner_account_provider_idx ON renova_auth.account(provider_id,account_id);
CREATE TABLE IF NOT EXISTS renova_auth.verification (
 id text PRIMARY KEY,identifier text NOT NULL,value text NOT NULL,expires_at timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS owner_verification_identifier_idx ON renova_auth.verification(identifier);
CREATE TABLE IF NOT EXISTS renova_auth.rate_limit (id text PRIMARY KEY,key text NOT NULL UNIQUE,count integer NOT NULL,last_request bigint NOT NULL);
