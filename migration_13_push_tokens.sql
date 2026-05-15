-- Create user_push_tokens table to store Expo push tokens for notifications
CREATE TABLE IF NOT EXISTS user_push_tokens (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    expo_push_token VARCHAR(255) NOT NULL,
    device_name VARCHAR(255),
    platform VARCHAR(50), -- 'ios', 'android', 'web'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, expo_push_token)
);

-- RLS Policies
ALTER TABLE user_push_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own push tokens"
    ON user_push_tokens
    FOR ALL
    USING (auth.uid() = user_id);

CREATE POLICY "Service role can read all push tokens"
    ON user_push_tokens
    FOR SELECT
    USING (auth.role() = 'service_role');
