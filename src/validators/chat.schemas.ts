import { z } from 'zod';

const id = z.string().uuid();
// Firestore auto-ids are 20 chars; keep this loose so other id formats still work
const messageId = z.string().trim().min(1).max(128);
const text = z.string().trim().min(1, 'text cannot be empty').max(4000);

export const chatParams = z.object({ chatId: id });
export const messageParams = z.object({ chatId: id, messageId });
export const userParams = z.object({ userId: id });
export const memberParams = z.object({ chatId: id, memberId: id });

export const createChatBody = z.object({ userAId: id, userBId: id });
export const sendMessageBody = z.object({ senderId: id, text });
export const userIdBody = z.object({ userId: id });
export const lastSeenBody = z.object({ userId: id, messageId });
export const editMessageBody = z.object({ userId: id, text });

export const getMessagesQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  before: messageId.optional(),
});

export const createUserBody = z.object({ name: z.string().trim().min(1).max(100) });

export const createGroupBody = z.object({
  name: z.string().trim().min(1).max(100),
  createdBy: id,
  memberIds: z.array(id).min(1).max(255),
});
export const addMembersBody = z.object({ userId: id, memberIds: z.array(id).min(1).max(255) });
export const renameGroupBody = z.object({ userId: id, name: z.string().trim().min(1).max(100) });
