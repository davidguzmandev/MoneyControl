CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  cycle_start_day INTEGER NOT NULL DEFAULT 1,
  monthly_budget NUMERIC(12, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'COP', 'MXN', 'CAD')),
  savings_goal NUMERIC(12, 2) NOT NULL DEFAULT 0,
  wise_api_token_encrypted TEXT,
  wise_profile_id TEXT,
  wise_balance_id TEXT,
  wise_currency TEXT,
  wise_last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'COP', 'MXN'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS savings_goal NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_currency_check;
ALTER TABLE users ADD CONSTRAINT users_currency_check CHECK (currency IN ('USD', 'COP', 'MXN', 'CAD'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS wise_api_token_encrypted TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS wise_profile_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS wise_balance_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS wise_currency TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS wise_last_synced_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'EXPENSE' CHECK (type IN ('INCOME', 'EXPENSE')),
  monthly_budget NUMERIC(12, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

ALTER TABLE categories ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'EXPENSE' CHECK (type IN ('INCOME', 'EXPENSE'));
ALTER TABLE categories ADD COLUMN IF NOT EXISTS monthly_budget NUMERIC(12, 2);

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories (id),
  type TEXT NOT NULL CHECK (type IN ('INCOME', 'EXPENSE')),
  amount NUMERIC(12, 2) NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  external_source TEXT,
  external_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions (user_id, date);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS external_source TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS external_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_external
  ON transactions (user_id, external_source, external_id)
  WHERE external_source IS NOT NULL;
