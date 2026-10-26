export type ChatType = 'direct' | 'group';
export type MemberRole = 'admin' | 'member';

export interface ChatSummary {
  chatId: string;
  type: ChatType;
  name: string | null;
  memberIds: string[];
  createdAt: Date;
  lastMessageAt: Date | null;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  text: string | null; 
  createdAt: Date;
  editedAt: Date | null;
  deleted: boolean;
  readBy: Record<string, Date>;
}

export interface ReadReceipt {
  messageId: string;
  userId: string;
  readAt: Date;
}

export interface LastSeen {
  userId: string;
  lastSeenMessageId: string;
  lastSeenAt: Date;
}
