import type { Pool, PoolClient } from 'pg';
import type { ChatSummary, ChatType, MemberRole } from '../types/chat';

interface ChatRow {
  chatId: string;
  type: ChatType;
  name: string | null;
  memberIds: string[];
  createdAt: Date;
  lastMessageAt: Date | null;
}

export interface ChatMember {
  userId: string;
  role: MemberRole;
}

const SELECT_CHAT_SUMMARY = `
  SELECT
    c.id               AS "chatId",
    c.type,
    c.name,
    array_agg(m.user_id::text ORDER BY m.joined_at, m.user_id) AS "memberIds",
    c.created_at       AS "createdAt",
    c.last_message_at  AS "lastMessageAt"
  FROM chats c
  JOIN chat_members m ON m.chat_id = c.id
`;

export function createChatRepository(db: Pool) {
  async function inTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async function findOrCreateDirect(userAId: string, userBId: string): Promise<{ chatId: string; created: boolean }> {
    const directKey = [userAId, userBId].sort().join(':');

    return inTransaction(async (client) => {
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO chats (type, direct_key, created_by)
         VALUES ('direct', $1, $2)
         ON CONFLICT (direct_key) DO NOTHING
         RETURNING id`,
        [directKey, userAId],
      );

      const newChat = inserted.rows[0];
      if (newChat) {
        await client.query(
          `INSERT INTO chat_members (chat_id, user_id) VALUES ($1, $2), ($1, $3)`,
          [newChat.id, userAId, userBId],
        );
        return { chatId: newChat.id, created: true };
      }

      const existing = await client.query<{ id: string }>(`SELECT id FROM chats WHERE direct_key = $1`, [directKey]);
      return { chatId: existing.rows[0]!.id, created: false };
    });
  }

  async function createGroup(name: string, createdBy: string, memberIds: string[]): Promise<string> {
    return inTransaction(async (client) => {
      const { rows } = await client.query<{ id: string }>(
        `INSERT INTO chats (type, name, created_by) VALUES ('group', $1, $2) RETURNING id`,
        [name, createdBy],
      );
      const chatId = rows[0]!.id;

      await client.query(`INSERT INTO chat_members (chat_id, user_id, role) VALUES ($1, $2, 'admin')`, [chatId, createdBy]);

      const others = memberIds.filter((id) => id !== createdBy);
      if (others.length) {
        await client.query(
          `INSERT INTO chat_members (chat_id, user_id)
           SELECT $1, unnest($2::uuid[])
           ON CONFLICT DO NOTHING`,
          [chatId, others],
        );
      }
      return chatId;
    });
  }

  async function findById(chatId: string): Promise<ChatSummary | null> {
    const { rows } = await db.query<ChatRow>(
      `${SELECT_CHAT_SUMMARY}
       WHERE c.id = $1
       GROUP BY c.id`,
      [chatId],
    );
    return rows[0] ?? null;
  }

  async function listForUser(userId: string): Promise<ChatSummary[]> {
    const { rows } = await db.query<ChatRow>(
      `${SELECT_CHAT_SUMMARY}
       WHERE c.id IN (SELECT chat_id FROM chat_members WHERE user_id = $1)
       GROUP BY c.id
       ORDER BY COALESCE(c.last_message_at, c.created_at) DESC`,
      [userId],
    );
    return rows;
  }

  async function getMember(chatId: string, userId: string): Promise<ChatMember | null> {
    const { rows } = await db.query<ChatMember>(
      `SELECT user_id AS "userId", role FROM chat_members WHERE chat_id = $1 AND user_id = $2`,
      [chatId, userId],
    );
    return rows[0] ?? null;
  }

  async function addMembers(chatId: string, userIds: string[]): Promise<void> {
    await db.query(
      `INSERT INTO chat_members (chat_id, user_id)
       SELECT $1, unnest($2::uuid[])
       ON CONFLICT DO NOTHING`,
      [chatId, userIds],
    );
  }

  async function removeMember(chatId: string, userId: string): Promise<void> {
    await db.query(`DELETE FROM chat_members WHERE chat_id = $1 AND user_id = $2`, [chatId, userId]);
  }

  async function countAdmins(chatId: string): Promise<number> {
    const { rows } = await db.query<{ count: number }>(
      `SELECT COUNT(*)::int AS count FROM chat_members WHERE chat_id = $1 AND role = 'admin'`,
      [chatId],
    );
    return rows[0]!.count;
  }

  async function promoteOldestMember(chatId: string): Promise<void> {
    await db.query(
      `UPDATE chat_members SET role = 'admin'
       WHERE (chat_id, user_id) = (
         SELECT chat_id, user_id FROM chat_members
         WHERE chat_id = $1
         ORDER BY joined_at, user_id
         LIMIT 1
       )`,
      [chatId],
    );
  }

  async function rename(chatId: string, name: string): Promise<void> {
    await db.query(`UPDATE chats SET name = $2 WHERE id = $1`, [chatId, name]);
  }

  async function touchLastMessage(chatId: string, at: Date): Promise<void> {
    await db.query(
      `UPDATE chats SET last_message_at = GREATEST(COALESCE(last_message_at, $2), $2) WHERE id = $1`,
      [chatId, at],
    );
  }

  return {
    findOrCreateDirect,
    createGroup,
    findById,
    listForUser,
    getMember,
    addMembers,
    removeMember,
    countAdmins,
    promoteOldestMember,
    rename,
    touchLastMessage,
  };
}

export type ChatRepository = ReturnType<typeof createChatRepository>;
