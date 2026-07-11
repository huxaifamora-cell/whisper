-- Whisper database schema (Postgres)

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  pairing_code  TEXT UNIQUE NOT NULL,      -- legacy, unused by current linking flow
  telegram_chat_id TEXT,                   -- filled in once user links via the one-time Telegram link
  link_token    TEXT UNIQUE,               -- one-time token for the "Open Telegram" button, null once used/expired
  link_token_expires_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS devices (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fcm_token   TEXT NOT NULL,
  platform    TEXT NOT NULL DEFAULT 'android',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, fcm_token)
);

CREATE TABLE IF NOT EXISTS rules (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  symbol        TEXT NOT NULL,             -- e.g. R_75, R_100, 1HZ100V
  timeframe     TEXT NOT NULL,             -- informational label chosen by user, e.g. M5, M15, H1
  target_price  NUMERIC NOT NULL,
  direction     TEXT NOT NULL CHECK (direction IN ('buy','sell')), -- buy = alert when price crosses UP through target, sell = crosses DOWN
  sound         TEXT NOT NULL DEFAULT 'default',
  description   TEXT,                      -- optional note the user writes when creating the alert
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','triggered','disabled')),
  last_price    NUMERIC,                    -- last seen tick price, used to detect a crossing
  triggered_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lets one user (subscriber) receive copies of another user's (owner's)
-- alert notifications, but ONLY once the owner approves - entering someone's
-- email must never silently expose your alerts to them.
CREATE TABLE IF NOT EXISTS subscriptions (
  id               SERIAL PRIMARY KEY,
  owner_user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscriber_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status           TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','revoked')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(owner_user_id, subscriber_user_id)
);

CREATE TABLE IF NOT EXISTS alert_history (
  id          SERIAL PRIMARY KEY,
  rule_id     INTEGER NOT NULL REFERENCES rules(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  symbol      TEXT NOT NULL,
  price       NUMERIC NOT NULL,
  direction   TEXT NOT NULL,
  dispatched_telegram BOOLEAN NOT NULL DEFAULT false,
  dispatched_fcm      BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rules_symbol_status ON rules(symbol, status);

-- Safe to re-run: adds the new linking-token columns to a database that
-- already existed before this feature, without affecting existing data.
ALTER TABLE users ADD COLUMN IF NOT EXISTS link_token TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS link_token_expires_at TIMESTAMPTZ;
ALTER TABLE rules ADD COLUMN IF NOT EXISTS description TEXT;

CREATE INDEX IF NOT EXISTS idx_subscriptions_owner ON subscriptions(owner_user_id, status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_subscriber ON subscriptions(subscriber_user_id, status);
