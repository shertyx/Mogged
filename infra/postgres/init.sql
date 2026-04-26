-- Schéma auth
CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    google_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auth.refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Schéma users
CREATE SCHEMA IF NOT EXISTS users;

CREATE TABLE IF NOT EXISTS users.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username VARCHAR(100) NOT NULL DEFAULT '',
    avatar_url TEXT,
    consent_ai BOOLEAN DEFAULT FALSE,
    username_set BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users.photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    s3_key TEXT NOT NULL,
    chad_score FLOAT,
    features JSONB,
    hash VARCHAR(64) UNIQUE NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    uploaded_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users.upload_rate (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    uploaded_at TIMESTAMP DEFAULT NOW()
);

-- Schéma elo
CREATE SCHEMA IF NOT EXISTS elo;

CREATE TABLE IF NOT EXISTS elo.scores (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    elo INT DEFAULT 1000,
    tier VARCHAR(50) DEFAULT 'Bronze',
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS elo.matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_a UUID REFERENCES auth.users(id),
    player_b UUID REFERENCES auth.users(id),
    winner_id UUID REFERENCES auth.users(id),
    elo_change_a INT,
    elo_change_b INT,
    photo_a_id UUID REFERENCES users.photos(id),
    photo_b_id UUID REFERENCES users.photos(id),
    mode VARCHAR(10) NOT NULL DEFAULT 'realtime',
    status VARCHAR(10) NOT NULL DEFAULT 'pending',
    expires_at TIMESTAMP,
    played_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS elo.rounds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id UUID REFERENCES elo.matches(id) ON DELETE CASCADE,
    photo_a UUID REFERENCES users.photos(id),
    photo_b UUID REFERENCES users.photos(id),
    winner_photo UUID REFERENCES users.photos(id),
    round_number INT NOT NULL
);

-- Schéma face
CREATE SCHEMA IF NOT EXISTS face;

CREATE TABLE IF NOT EXISTS face.scores (
    photo_hash VARCHAR(64) PRIMARY KEY,
    photo_id UUID REFERENCES users.photos(id) ON DELETE CASCADE,
    chad_score FLOAT NOT NULL,
    symmetry FLOAT,
    golden_ratio FLOAT,
    jawline FLOAT,
    eyes FLOAT,
    nose FLOAT,
    forehead FLOAT,
    analyzed_at TIMESTAMP DEFAULT NOW()
);
