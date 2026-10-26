import { randomUUID } from 'node:crypto';
import type { LastSeen, Message, ReadReceipt } from '../types/chat';
import { notFound } from '../utils/http-error';
import type { ListMessagesOptions, MessageStore } from './message.store';

export function createMemoryMessageStore(): MessageStore {
  const messagesByChat = new Map<string, Message[]>();
  const lastSeenByUser = new Map<string, LastSeen & { messageAt: number }>();
  let lastTimestamp = 0;

  function now(): Date {
    lastTimestamp = Math.max(Date.now(), lastTimestamp + 1);
    return new Date(lastTimestamp);
  }

  function chatMessages(chatId: string): Message[] {
    let list = messagesByChat.get(chatId);
    if (!list) {
      list = [];
      messagesByChat.set(chatId, list);
    }
    return list;
  }

  function find(chatId: string, messageId: string): Message | undefined {
    return chatMessages(chatId).find((m) => m.id === messageId);
  }

  function requireMessage(chatId: string, messageId: string): Message {
    const message = find(chatId, messageId);
    if (!message) throw notFound('Message not found');
    return message;
  }

  async function add(chatId: string, senderId: string, text: string): Promise<Message> {
    const createdAt = now();
    const message: Message = {
      id: randomUUID(),
      chatId,
      senderId,
      text,
      createdAt,
      editedAt: null,
      deleted: false,
      readBy: { [senderId]: createdAt },
    };
    chatMessages(chatId).push(message);
    return clone(message);
  }

  async function get(chatId: string, messageId: string): Promise<Message | null> {
    const message = find(chatId, messageId);
    return message ? clone(message) : null;
  }

  async function list(chatId: string, { limit, before }: ListMessagesOptions): Promise<Message[]> {
    let messages = chatMessages(chatId);
    if (before) {
      const index = messages.findIndex((m) => m.id === before);
      if (index === -1) throw notFound('Message used as "before" cursor not found');
      messages = messages.slice(0, index);
    }
    return messages.slice(-limit).map(clone);
  }

  async function markRead(chatId: string, messageId: string, userId: string): Promise<ReadReceipt> {
    const message = requireMessage(chatId, messageId);
    message.readBy[userId] ??= now();
    return { messageId, userId, readAt: message.readBy[userId] };
  }

  async function updateLastSeen(chatId: string, userId: string, messageId: string): Promise<LastSeen> {
    const message = requireMessage(chatId, messageId);
    const key = `${chatId}:${userId}`;
    const current = lastSeenByUser.get(key);

    if (current && current.messageAt > message.createdAt.getTime()) {
      return { userId, lastSeenMessageId: current.lastSeenMessageId, lastSeenAt: current.lastSeenAt };
    }

    const entry = { userId, lastSeenMessageId: messageId, lastSeenAt: now(), messageAt: message.createdAt.getTime() };
    lastSeenByUser.set(key, entry);
    return { userId, lastSeenMessageId: entry.lastSeenMessageId, lastSeenAt: entry.lastSeenAt };
  }

  async function edit(chatId: string, messageId: string, text: string): Promise<Message> {
    const message = requireMessage(chatId, messageId);
    message.text = text;
    message.editedAt = now();
    return clone(message);
  }

  async function softDelete(chatId: string, messageId: string): Promise<Message> {
    const message = requireMessage(chatId, messageId);
    message.text = null;
    message.deleted = true;
    return clone(message);
  }

  return { add, get, list, markRead, updateLastSeen, edit, softDelete };
}

function clone(message: Message): Message {
  return { ...message, readBy: { ...message.readBy } };
}
