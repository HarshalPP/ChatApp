CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chats (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type             TEXT NOT NULL CHECK (type IN ('direct', 'group')),
    name             TEXT,
    -- "<smallerUserId>:<largerUserId>" for direct chats, so the same pair can only have one chat
    direct_key       TEXT UNIQUE,
    created_by       UUID NOT NULL REFERENCES users(id),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_message_at  TIMESTAMPTZ,
    CONSTRAINT direct_chat_has_key CHECK (
        (type = 'direct' AND direct_key IS NOT NULL) OR
        (type = 'group'  AND direct_key IS NULL)
    )
);

CREATE TABLE IF NOT EXISTS chat_members (
    chat_id    UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role       TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (chat_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_chat_members_user ON chat_members (user_id);
