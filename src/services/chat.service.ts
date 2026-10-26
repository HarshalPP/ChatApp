import type { ChatMember, ChatRepository } from '../repositories/chat.repository';
import type { UserRepository } from '../repositories/user.repository';
import type { MessageStore } from '../stores/message.store';
import type { ChatSummary, LastSeen, Message, ReadReceipt } from '../types/chat';
import { badRequest, conflict, forbidden, notFound } from '../utils/http-error';

export function createChatService(chats: ChatRepository, users: UserRepository, messages: MessageStore) {

  async function ensureUsersExist(ids: string[]): Promise<void> {
    const missing = await users.findMissing(ids);
    if (missing.length) {
      throw notFound(`User not found: ${missing.join(', ')}`);
    }
  }

  async function requireChat(chatId: string): Promise<ChatSummary> {
    const chat = await chats.findById(chatId);
    if (!chat) throw notFound('Chat not found');
    return chat;
  }

  async function requireGroup(chatId: string): Promise<ChatSummary> {
    const chat = await requireChat(chatId);
    if (chat.type !== 'group') throw badRequest('This action is only available for group chats');
    return chat;
  }

  async function requireMember(chatId: string, userId: string): Promise<ChatMember> {
    await requireChat(chatId);
    const member = await chats.getMember(chatId, userId);
    if (!member) throw forbidden('User is not a member of this chat');
    return member;
  }

  async function requireAdmin(chatId: string, userId: string): Promise<void> {
    const member = await requireMember(chatId, userId);
    if (member.role !== 'admin') throw forbidden('Only group admins can do this');
  }

  async function requireOwnMessage(chatId: string, messageId: string, userId: string): Promise<Message> {
    const message = await messages.get(chatId, messageId);
    if (!message) throw notFound('Message not found');
    if (message.senderId !== userId) throw forbidden('You can only change your own messages');
    return message;
  }


  async function createOrGetDirectChat(userAId: string, userBId: string) {
    if (userAId === userBId) {
      throw badRequest('userAId and userBId must be different users');
    }
    await ensureUsersExist([userAId, userBId]);
    return chats.findOrCreateDirect(userAId, userBId);
  }

  async function listUserChats(userId: string): Promise<ChatSummary[]> {
    await ensureUsersExist([userId]);
    return chats.listForUser(userId);
  }

  async function sendMessage(chatId: string, senderId: string, text: string): Promise<Message> {
    await requireMember(chatId, senderId);

    const message = await messages.add(chatId, senderId, text);
    await chats.touchLastMessage(chatId, message.createdAt);
    return message;
  }

  async function getMessages(chatId: string, limit: number, before?: string): Promise<Message[]> {
    await requireChat(chatId);
    return messages.list(chatId, before ? { limit, before } : { limit });
  }

  async function markRead(chatId: string, messageId: string, userId: string): Promise<ReadReceipt> {
    await requireMember(chatId, userId);
    return messages.markRead(chatId, messageId, userId);
  }

  async function updateLastSeen(chatId: string, userId: string, messageId: string): Promise<LastSeen> {
    await requireMember(chatId, userId);
    return messages.updateLastSeen(chatId, userId, messageId);
  }

  async function editMessage(chatId: string, messageId: string, userId: string, text: string): Promise<Message> {
    await requireMember(chatId, userId);
    const message = await requireOwnMessage(chatId, messageId, userId);
    if (message.deleted) throw conflict('Deleted messages cannot be edited');
    return messages.edit(chatId, messageId, text);
  }

  async function deleteMessage(chatId: string, messageId: string, userId: string): Promise<Message> {
    await requireMember(chatId, userId);
    const message = await requireOwnMessage(chatId, messageId, userId);
    if (message.deleted) return message;
    return messages.softDelete(chatId, messageId);
  }


  async function createGroup(name: string, createdBy: string, memberIds: string[]): Promise<ChatSummary> {
    const allMembers = [...new Set([createdBy, ...memberIds])];
    if (allMembers.length < 2) {
      throw badRequest('A group needs at least one member besides the creator');
    }
    await ensureUsersExist(allMembers);

    const chatId = await chats.createGroup(name, createdBy, allMembers);
    return (await chats.findById(chatId))!;
  }

  async function addGroupMembers(chatId: string, requestedBy: string, memberIds: string[]): Promise<ChatSummary> {
    await requireGroup(chatId);
    await requireAdmin(chatId, requestedBy);
    await ensureUsersExist(memberIds);

    await chats.addMembers(chatId, memberIds);
    return (await chats.findById(chatId))!;
  }

  async function removeGroupMember(chatId: string, requestedBy: string, memberId: string): Promise<void> {
    await requireGroup(chatId);
    const requester = await requireMember(chatId, requestedBy);

    const leavingThemselves = requestedBy === memberId;
    if (!leavingThemselves && requester.role !== 'admin') {
      throw forbidden('Only group admins can remove other members');
    }

    const target = await chats.getMember(chatId, memberId);
    if (!target) throw notFound('User is not a member of this chat');

    await chats.removeMember(chatId, memberId);

    if (target.role === 'admin' && (await chats.countAdmins(chatId)) === 0) {
      await chats.promoteOldestMember(chatId);
    }
  }

  async function renameGroup(chatId: string, requestedBy: string, name: string): Promise<ChatSummary> {
    await requireGroup(chatId);
    await requireAdmin(chatId, requestedBy);
    await chats.rename(chatId, name);
    return (await chats.findById(chatId))!;
  }

  return {
    createOrGetDirectChat,
    listUserChats,
    sendMessage,
    getMessages,
    markRead,
    updateLastSeen,
    editMessage,
    deleteMessage,
    createGroup,
    addGroupMembers,
    removeGroupMember,
    renameGroup,
  };
}

export type ChatService = ReturnType<typeof createChatService>;
