-- Payment tables for $1 USD entry fee system

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

