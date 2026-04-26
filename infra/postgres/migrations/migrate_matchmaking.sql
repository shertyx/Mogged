-- Migration: matchmaking redesign
-- Run this on existing databases (init.sql already reflects the new schema for fresh installs)

ALTER TABLE elo.matches RENAME COLUMN winner TO winner_id;
ALTER TABLE elo.matches ADD COLUMN IF NOT EXISTS photo_a_id UUID REFERENCES users.photos(id);
ALTER TABLE elo.matches ADD COLUMN IF NOT EXISTS photo_b_id UUID REFERENCES users.photos(id);
