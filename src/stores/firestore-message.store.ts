import {
  FieldPath,
  FieldValue,
  Timestamp,
  type DocumentData,
  type DocumentSnapshot,
  type Firestore,
} from 'firebase-admin/firestore';
import type { LastSeen, Message, ReadReceipt } from '../types/chat';
import { notFound } from '../utils/http-error';
import type { ListMessagesOptions, MessageStore } from './message.store';

export function createFirestoreMessageStore(firestore: Firestore): MessageStore {
  function messagesOf(chatId: string) {
    return firestore.collection('chats').doc(chatId).collection('messages');
  }

  async function add(chatId: string, senderId: string, text: string): Promise<Message> {
    const ref = messagesOf(chatId).doc();
    await ref.set({
      senderId,
      text,
      createdAt: FieldValue.serverTimestamp(),
      editedAt: null,
      deletedAt: null,
      readBy: { [senderId]: FieldValue.serverTimestamp() },
    });

    return toMessage(chatId, await ref.get());
  }

  async function get(chatId: string, messageId: string): Promise<Message | null> {
    const snap = await messagesOf(chatId).doc(messageId).get();
    return snap.exists ? toMessage(chatId, snap) : null;
  }

  async function list(chatId: string, { limit, before }: ListMessagesOptions): Promise<Message[]> {
    let query = messagesOf(chatId).orderBy('createdAt', 'desc').limit(limit);

    if (before) {
      const cursor = await messagesOf(chatId).doc(before).get();
      if (!cursor.exists) throw notFound('Message used as "before" cursor not found');
      query = query.startAfter(cursor);
    }

    const snap = await query.get();
    return snap.docs.map((doc) => toMessage(chatId, doc)).reverse();
  }

  async function markRead(chatId: string, messageId: string, userId: string): Promise<ReadReceipt> {
    const ref = messagesOf(chatId).doc(messageId);

    return firestore.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw notFound('Message not found');

      const existing = (snap.get('readBy') as Record<string, Timestamp> | undefined)?.[userId];
      if (existing) {
        return { messageId, userId, readAt: existing.toDate() };
      }

      const readAt = Timestamp.now();
      tx.update(ref, new FieldPath('readBy', userId), readAt);
      return { messageId, userId, readAt: readAt.toDate() };
    });
  }

  async function updateLastSeen(chatId: string, userId: string, messageId: string): Promise<LastSeen> {
    const messageRef = messagesOf(chatId).doc(messageId);
    const memberRef = firestore.collection('chats').doc(chatId).collection('members').doc(userId);

    return firestore.runTransaction(async (tx) => {
      const [messageSnap, memberSnap] = await Promise.all([tx.get(messageRef), tx.get(memberRef)]);
      if (!messageSnap.exists) throw notFound('Message not found');

      const messageAt = messageSnap.get('createdAt') as Timestamp;
      const current = memberSnap.exists ? memberSnap.data() : undefined;
      const currentAt = current?.lastSeenMessageAt as Timestamp | undefined;

      if (current && currentAt && currentAt.toMillis() > messageAt.toMillis()) {
        return {
          userId,
          lastSeenMessageId: current.lastSeenMessageId as string,
          lastSeenAt: (current.lastSeenAt as Timestamp).toDate(),
        };
      }

      const now = Timestamp.now();
      tx.set(
        memberRef,
        { lastSeenMessageId: messageId, lastSeenMessageAt: messageAt, lastSeenAt: now },
        { merge: true },
      );
      return { userId, lastSeenMessageId: messageId, lastSeenAt: now.toDate() };
    });
  }

  async function edit(chatId: string, messageId: string, text: string): Promise<Message> {
    const ref = messagesOf(chatId).doc(messageId);
    await ref.update({ text, editedAt: FieldValue.serverTimestamp() });
    return toMessage(chatId, await ref.get());
  }

  async function softDelete(chatId: string, messageId: string): Promise<Message> {
    const ref = messagesOf(chatId).doc(messageId);
    await ref.update({ text: null, deletedAt: FieldValue.serverTimestamp() });
    return toMessage(chatId, await ref.get());
  }

  return { add, get, list, markRead, updateLastSeen, edit, softDelete };
}

function toMessage(chatId: string, snap: DocumentSnapshot<DocumentData>): Message {
  const data = snap.data();
  if (!data) throw notFound('Message not found');

  const readBy: Record<string, Date> = {};
  for (const [userId, value] of Object.entries((data.readBy ?? {}) as Record<string, Timestamp>)) {
    readBy[userId] = value.toDate();
  }

  return {
    id: snap.id,
    chatId,
    senderId: data.senderId as string,
    text: (data.text as string | null) ?? null,
    createdAt: (data.createdAt as Timestamp).toDate(),
    editedAt: data.editedAt ? (data.editedAt as Timestamp).toDate() : null,
    deleted: Boolean(data.deletedAt),
    readBy,
  };
}
