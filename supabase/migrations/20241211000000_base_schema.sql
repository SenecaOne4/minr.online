-- Minr.online Base Database Schema
-- This must run first before other migrations

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT,
    btc_payout_address TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    has_paid_entry_fee BOOLEAN DEFAULT FALSE,
    entry_fee_paid_at TIMESTAMP
);

-- Memberships table
CREATE TABLE IF NOT EXISTS memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('active', 'expired', 'trial')),
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Workers table
CREATE TABLE IF NOT EXISTS workers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    worker_name TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Payout policies table
CREATE TABLE IF NOT EXISTS payout_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    finder_share_pct NUMERIC NOT NULL,
    treasury_share_pct NUMERIC NOT NULL,
    community_share_pct NUMERIC NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT valid_percentages CHECK (
        finder_share_pct + treasury_share_pct + community_share_pct = 100
    )
);

-- Block events table
CREATE TABLE IF NOT EXISTS block_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    block_hash TEXT NOT NULL UNIQUE,
    height INTEGER NOT NULL,
    found_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    reward_btc NUMERIC NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Payout events table
CREATE TABLE IF NOT EXISTS payout_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    block_event_id UUID NOT NULL REFERENCES block_events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    amount_btc NUMERIC NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed')),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_memberships_user_id ON memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_workers_user_id ON workers(user_id);
CREATE INDEX IF NOT EXISTS idx_block_events_found_by ON block_events(found_by_user_id);
CREATE INDEX IF NOT EXISTS idx_payout_events_block_event ON payout_events(block_event_id);
CREATE INDEX IF NOT EXISTS idx_payout_events_user ON payout_events(user_id);
