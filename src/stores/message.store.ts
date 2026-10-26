import type { LastSeen, Message, ReadReceipt } from '../types/chat';

export interface ListMessagesOptions {
  limit: number;
  before?: string;
}

export interface MessageStore {
  add(chatId: string, senderId: string, text: string): Promise<Message>;
  get(chatId: string, messageId: string): Promise<Message | null>;

  list(chatId: string, options: ListMessagesOptions): Promise<Message[]>;

  markRead(chatId: string, messageId: string, userId: string): Promise<ReadReceipt>;

  updateLastSeen(chatId: string, userId: string, messageId: string): Promise<LastSeen>;
  edit(chatId: string, messageId: string, text: string): Promise<Message>;
  softDelete(chatId: string, messageId: string): Promise<Message>;
}
