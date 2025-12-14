-- Site settings table for admin configuration

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

-- Update profiles table to add payment tracking fields
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS has_paid_entry_fee BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS entry_fee_paid_at TIMESTAMP;

-- Indexes for site settings
CREATE INDEX IF NOT EXISTS idx_site_settings_updated_at ON site_settings(updated_at);

