-- Analytics tables for mining session and share tracking

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

