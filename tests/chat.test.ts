import type { Express } from 'express';
import type { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createUser, setupTestApp } from './helpers';

let app: Express;
let db: Pool;
let alice: string;
let bob: string;
let carol: string;
let chatId: string;

beforeAll(async () => {
  ({ app, db } = await setupTestApp());
  alice = await createUser(app, 'Alice');
  bob = await createUser(app, 'Bob');
  carol = await createUser(app, 'Carol');
});

afterAll(async () => {
  await db.end();
});

describe('POST /chat/create', () => {
  it('creates a 1:1 chat', async () => {
    const res = await request(app).post('/chat/create').send({ userAId: alice, userBId: bob }).expect(201);
    expect(res.body.created).toBe(true);
    chatId = res.body.chatId;
  });

  it('returns the same chat for the same pair, in any order', async () => {
    const res = await request(app).post('/chat/create').send({ userAId: bob, userBId: alice }).expect(200);
    expect(res.body).toEqual({ chatId, created: false });
  });

  it('only creates one chat when both users call at the same time', async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, () => request(app).post('/chat/create').send({ userAId: alice, userBId: carol })),
    );
    const ids = new Set(results.map((r) => r.body.chatId));
    expect(ids.size).toBe(1);
    expect(results.filter((r) => r.body.created)).toHaveLength(1);
  });

  it('rejects chatting with yourself', async () => {
    await request(app).post('/chat/create').send({ userAId: alice, userBId: alice }).expect(400);
  });

  it('returns 404 for unknown users', async () => {
    const res = await request(app)
      .post('/chat/create')
      .send({ userAId: alice, userBId: '00000000-0000-4000-8000-000000000000' })
      .expect(404);
    expect(res.body.error).toMatch(/User not found/);
  });

  it('validates input', async () => {
    const res = await request(app).post('/chat/create').send({ userAId: 'abc' }).expect(400);
    expect(res.body.error).toMatch(/userAId/);
  });
});

describe('messages', () => {
  const sent: string[] = [];

  it('sends messages', async () => {
    for (const [senderId, text] of [
      [alice, 'Hi Bob'],
      [bob, 'Hey Alice'],
      [alice, 'How are you?'],
    ] as const) {
      const res = await request(app).post(`/chat/${chatId}/message/send`).send({ senderId, text }).expect(201);
      expect(res.body).toMatchObject({ chatId, senderId, text, deleted: false });
      expect(res.body.readBy[senderId]).toBeDefined();
      sent.push(res.body.id);
    }
  });

  it('does not let non-members send', async () => {
    await request(app).post(`/chat/${chatId}/message/send`).send({ senderId: carol, text: 'hello?' }).expect(403);
  });

  it('rejects empty text', async () => {
    await request(app).post(`/chat/${chatId}/message/send`).send({ senderId: alice, text: '   ' }).expect(400);
  });

  it('lists messages oldest to newest', async () => {
    const res = await request(app).get(`/chat/${chatId}/messages`).expect(200);
    expect(res.body.messages.map((m: { id: string }) => m.id)).toEqual(sent);
  });

  it('limit returns the latest messages', async () => {
    const res = await request(app).get(`/chat/${chatId}/messages?limit=2`).expect(200);
    expect(res.body.messages.map((m: { id: string }) => m.id)).toEqual(sent.slice(1));
  });

  it('supports paging with before', async () => {
    const res = await request(app).get(`/chat/${chatId}/messages?limit=50&before=${sent[2]}`).expect(200);
    expect(res.body.messages.map((m: { id: string }) => m.id)).toEqual(sent.slice(0, 2));
  });

  it('rejects an invalid limit', async () => {
    await request(app).get(`/chat/${chatId}/messages?limit=0`).expect(400);
    await request(app).get(`/chat/${chatId}/messages?limit=abc`).expect(400);
  });

  it('marks a message as read, and keeps the first read time', async () => {
    const first = await request(app).post(`/chat/${chatId}/message/${sent[0]}/read`).send({ userId: bob }).expect(200);
    expect(first.body).toMatchObject({ messageId: sent[0], userId: bob });

    const second = await request(app).post(`/chat/${chatId}/message/${sent[0]}/read`).send({ userId: bob }).expect(200);
    expect(second.body.readAt).toBe(first.body.readAt);

    const list = await request(app).get(`/chat/${chatId}/messages`).expect(200);
    expect(list.body.messages[0].readBy[bob]).toBe(first.body.readAt);
  });

  it('returns 404 when marking an unknown message', async () => {
    await request(app).post(`/chat/${chatId}/message/does-not-exist/read`).send({ userId: bob }).expect(404);
  });

  it('updates last seen, and never moves it backwards', async () => {
    const latest = await request(app)
      .post(`/chat/${chatId}/lastseen`)
      .send({ userId: bob, messageId: sent[2] })
      .expect(200);
    expect(latest.body.lastSeenMessageId).toBe(sent[2]);

    const older = await request(app).post(`/chat/${chatId}/lastseen`).send({ userId: bob, messageId: sent[0] }).expect(200);
    expect(older.body.lastSeenMessageId).toBe(sent[2]);
  });

  it('only lets the sender edit or delete a message', async () => {
    await request(app).patch(`/chat/${chatId}/message/${sent[0]}`).send({ userId: bob, text: 'hacked' }).expect(403);

    const edited = await request(app)
      .patch(`/chat/${chatId}/message/${sent[0]}`)
      .send({ userId: alice, text: 'Hi Bob!' })
      .expect(200);
    expect(edited.body.text).toBe('Hi Bob!');
    expect(edited.body.editedAt).not.toBeNull();

    const deleted = await request(app).delete(`/chat/${chatId}/message/${sent[2]}`).send({ userId: alice }).expect(200);
    expect(deleted.body).toMatchObject({ deleted: true, text: null });

    await request(app).patch(`/chat/${chatId}/message/${sent[2]}`).send({ userId: alice, text: 'again' }).expect(409);
  });

  it('returns 404 for an unknown chat', async () => {
    await request(app).get('/chat/00000000-0000-4000-8000-000000000000/messages').expect(404);
  });
});

describe('GET /user/:userId/chats', () => {
  it('lists chats with member ids, most recent activity first', async () => {
    const res = await request(app).get(`/user/${alice}/chats`).expect(200);
    expect(res.body.count).toBe(2);

    const [first] = res.body.chats;
    expect(first.chatId).toBe(chatId); // has messages, so it is the most recent
    expect(first.type).toBe('direct');
    expect([...first.memberIds].sort()).toEqual([alice, bob].sort());
  });

  it('returns 404 for an unknown user', async () => {
    await request(app).get('/user/00000000-0000-4000-8000-000000000000/chats').expect(404);
  });
});

describe('group chats', () => {
  let groupId: string;
  let dave: string;

  it('creates a group with the creator as admin', async () => {
    dave = await createUser(app, 'Dave');
    const res = await request(app)
      .post('/chat/group/create')
      .send({ name: 'Project team', createdBy: alice, memberIds: [bob, carol] })
      .expect(201);
    groupId = res.body.chatId;
    expect(res.body).toMatchObject({ type: 'group', name: 'Project team' });
    expect(res.body.memberIds).toHaveLength(3);
  });

  it('lets members send messages', async () => {
    await request(app).post(`/chat/${groupId}/message/send`).send({ senderId: carol, text: 'Hello team' }).expect(201);
  });

  it('only admins can add members or rename', async () => {
    await request(app).post(`/chat/${groupId}/members/add`).send({ userId: bob, memberIds: [dave] }).expect(403);

    const added = await request(app).post(`/chat/${groupId}/members/add`).send({ userId: alice, memberIds: [dave] }).expect(200);
    expect(added.body.memberIds).toContain(dave);

    const renamed = await request(app).patch(`/chat/${groupId}`).send({ userId: alice, name: 'Core team' }).expect(200);
    expect(renamed.body.name).toBe('Core team');
  });

  it('members can leave, only admins can remove others', async () => {
    await request(app).delete(`/chat/${groupId}/members/${carol}`).send({ userId: bob }).expect(403);
    await request(app).delete(`/chat/${groupId}/members/${bob}`).send({ userId: bob }).expect(204);
    await request(app).delete(`/chat/${groupId}/members/${carol}`).send({ userId: alice }).expect(204);

    const res = await request(app).get(`/user/${dave}/chats`).expect(200);
    expect([...res.body.chats[0].memberIds].sort()).toEqual([alice, dave].sort());
  });

  it('promotes someone else when the last admin leaves', async () => {
    await request(app).delete(`/chat/${groupId}/members/${alice}`).send({ userId: alice }).expect(204);
    // Dave is now the only member and should be admin
    await request(app).patch(`/chat/${groupId}`).send({ userId: dave, name: 'Dave only' }).expect(200);
  });

  it('group actions are rejected on direct chats', async () => {
    await request(app).post(`/chat/${chatId}/members/add`).send({ userId: alice, memberIds: [carol] }).expect(400);
  });
});

describe('misc', () => {
  it('health check', async () => {
    await request(app).get('/health').expect(200, { status: 'ok' });
  });

  it('unknown route', async () => {
    await request(app).get('/nope').expect(404);
  });

  it('bad JSON body', async () => {
    await request(app).post('/chat/create').set('Content-Type', 'application/json').send('{bad').expect(400);
  });
});
