-- Minr.online Database Schema

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT,
    btc_payout_address TEXT,
    created_at TIMESTAMP DEFAULT NOW()
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

-- ============================================================================
-- Payment Tables (Entry Fee System)
-- ============================================================================

-- Payment requests table
CREATE TABLE IF NOT EXISTS payment_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    btc_address TEXT NOT NULL UNIQUE,
    amount_btc NUMERIC NOT NULL,
    amount_usd NUMERIC NOT NULL DEFAULT 1.00,
    status TEXT NOT NULL CHECK (status IN ('pending', 'paid', 'expired', 'cancelled')) DEFAULT 'pending',
    tx_hash TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP NOT NULL,
    paid_at TIMESTAMP,
    CONSTRAINT expires_after_created CHECK (expires_at > created_at)
);

-- User payments table (payment history)
CREATE TABLE IF NOT EXISTS user_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    payment_request_id UUID NOT NULL REFERENCES payment_requests(id) ON DELETE CASCADE,
    amount_btc NUMERIC NOT NULL,
    amount_usd NUMERIC NOT NULL,
    tx_hash TEXT NOT NULL,
    block_height INTEGER,
    confirmations INTEGER DEFAULT 0,
    confirmed_at TIMESTAMP,
    status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'failed')) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for payment tables
CREATE INDEX IF NOT EXISTS idx_payment_requests_user_id ON payment_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_status ON payment_requests(status);
CREATE INDEX IF NOT EXISTS idx_payment_requests_btc_address ON payment_requests(btc_address);
CREATE INDEX IF NOT EXISTS idx_payment_requests_expires_at ON payment_requests(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_payments_user_id ON user_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_payments_payment_request_id ON user_payments(payment_request_id);
CREATE INDEX IF NOT EXISTS idx_user_payments_status ON user_payments(status);
CREATE INDEX IF NOT EXISTS idx_user_payments_tx_hash ON user_payments(tx_hash);

-- ============================================================================
-- Analytics Tables (Mining Session & Share Tracking)
-- ============================================================================

-- Mining sessions table
CREATE TABLE IF NOT EXISTS mining_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    worker_name TEXT NOT NULL,
    started_at TIMESTAMP DEFAULT NOW(),
    ended_at TIMESTAMP,
    total_hashes BIGINT DEFAULT 0,
    accepted_shares INTEGER DEFAULT 0,
    rejected_shares INTEGER DEFAULT 0,
    avg_hashrate NUMERIC DEFAULT 0,
    CONSTRAINT ended_after_started CHECK (ended_at IS NULL OR ended_at >= started_at)
);

-- Share submissions table
CREATE TABLE IF NOT EXISTS share_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    session_id UUID REFERENCES mining_sessions(id) ON DELETE SET NULL,
    job_id TEXT NOT NULL,
    nonce TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('accepted', 'rejected', 'pending')) DEFAULT 'pending',
    submitted_at TIMESTAMP DEFAULT NOW(),
    difficulty NUMERIC NOT NULL,
    CONSTRAINT unique_share UNIQUE (user_id, job_id, nonce)
);

-- Pool statistics table (aggregate metrics)
CREATE TABLE IF NOT EXISTS pool_statistics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    total_hashrate NUMERIC DEFAULT 0,
    active_miners INTEGER DEFAULT 0,
    block_height INTEGER,
    network_difficulty NUMERIC,
    pool_difficulty NUMERIC,
    last_updated TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for analytics tables
CREATE INDEX IF NOT EXISTS idx_mining_sessions_user_id ON mining_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_mining_sessions_started_at ON mining_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_mining_sessions_ended_at ON mining_sessions(ended_at);
CREATE INDEX IF NOT EXISTS idx_share_submissions_user_id ON share_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_share_submissions_session_id ON share_submissions(session_id);
CREATE INDEX IF NOT EXISTS idx_share_submissions_status ON share_submissions(status);
CREATE INDEX IF NOT EXISTS idx_share_submissions_submitted_at ON share_submissions(submitted_at);
CREATE INDEX IF NOT EXISTS idx_pool_statistics_last_updated ON pool_statistics(last_updated);

-- ============================================================================
-- Site Settings Table (Admin Configuration)
-- ============================================================================

-- Site settings table
CREATE TABLE IF NOT EXISTS site_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_btc_wallet TEXT,
    favicon_url TEXT,
    logo_url TEXT,
    og_image_url TEXT,
    hero_title TEXT,
    hero_subtitle TEXT,
    hero_image_url TEXT,
    navigation_items JSONB DEFAULT '[]'::jsonb,
    updated_at TIMESTAMP DEFAULT NOW(),
    updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT single_settings_row CHECK (id = '00000000-0000-0000-0000-000000000000'::uuid)
);

-- Insert default settings row (using fixed UUID to enforce single row)
INSERT INTO site_settings (id, admin_btc_wallet, hero_title, hero_subtitle, navigation_items)
VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid,
    'bc1qchm0vkcdkzrstlh05w5zd7j5788yysyfmnlf47',
    'Minr.online',
    'Bitcoin Lottery Pool Mining Platform',
    '[]'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- Indexes for site settings
CREATE INDEX IF NOT EXISTS idx_site_settings_updated_at ON site_settings(updated_at);

-- ============================================================================
-- Update Existing Tables
-- ============================================================================

-- Update profiles table to add payment tracking fields
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS has_paid_entry_fee BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS entry_fee_paid_at TIMESTAMP;

