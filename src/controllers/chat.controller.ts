import type { Request, Response } from 'express';
import { parse } from '../middleware/validate';
import type { ChatService } from '../services/chat.service';
import {
  addMembersBody,
  chatParams,
  createChatBody,
  createGroupBody,
  editMessageBody,
  getMessagesQuery,
  lastSeenBody,
  memberParams,
  messageParams,
  renameGroupBody,
  sendMessageBody,
  userIdBody,
} from '../validators/chat.schemas';

export function createChatController(chatService: ChatService) {
  async function createChat(req: Request, res: Response) {
    const { userAId, userBId } = parse(createChatBody, req, 'body');
    const { chatId, created } = await chatService.createOrGetDirectChat(userAId, userBId);

    res.status(created ? 201 : 200).json({ chatId, created });
  }

  async function sendMessage(req: Request, res: Response) {
    const { chatId } = parse(chatParams, req, 'params');
    const { senderId, text } = parse(sendMessageBody, req, 'body');

    const message = await chatService.sendMessage(chatId, senderId, text);
    res.status(201).json(message);
  }

  async function getMessages(req: Request, res: Response) {
    const { chatId } = parse(chatParams, req, 'params');
    const { limit, before } = parse(getMessagesQuery, req, 'query');

    const messages = await chatService.getMessages(chatId, limit, before);
    res.json({ chatId, count: messages.length, messages });
  }

  async function markRead(req: Request, res: Response) {
    const { chatId, messageId } = parse(messageParams, req, 'params');
    const { userId } = parse(userIdBody, req, 'body');

    res.json(await chatService.markRead(chatId, messageId, userId));
  }

  async function updateLastSeen(req: Request, res: Response) {
    const { chatId } = parse(chatParams, req, 'params');
    const { userId, messageId } = parse(lastSeenBody, req, 'body');

    res.json(await chatService.updateLastSeen(chatId, userId, messageId));
  }

  async function editMessage(req: Request, res: Response) {
    const { chatId, messageId } = parse(messageParams, req, 'params');
    const { userId, text } = parse(editMessageBody, req, 'body');

    res.json(await chatService.editMessage(chatId, messageId, userId, text));
  }

  async function deleteMessage(req: Request, res: Response) {
    const { chatId, messageId } = parse(messageParams, req, 'params');
    const { userId } = parse(userIdBody, req, 'body');

    res.json(await chatService.deleteMessage(chatId, messageId, userId));
  }

  async function createGroup(req: Request, res: Response) {
    const { name, createdBy, memberIds } = parse(createGroupBody, req, 'body');

    const group = await chatService.createGroup(name, createdBy, memberIds);
    res.status(201).json(group);
  }

  async function addMembers(req: Request, res: Response) {
    const { chatId } = parse(chatParams, req, 'params');
    const { userId, memberIds } = parse(addMembersBody, req, 'body');

    res.json(await chatService.addGroupMembers(chatId, userId, memberIds));
  }

  async function removeMember(req: Request, res: Response) {
    const { chatId, memberId } = parse(memberParams, req, 'params');
    const { userId } = parse(userIdBody, req, 'body');

    await chatService.removeGroupMember(chatId, userId, memberId);
    res.status(204).end();
  }

  async function renameGroup(req: Request, res: Response) {
    const { chatId } = parse(chatParams, req, 'params');
    const { userId, name } = parse(renameGroupBody, req, 'body');

    res.json(await chatService.renameGroup(chatId, userId, name));
  }

  return {
    createChat,
    sendMessage,
    getMessages,
    markRead,
    updateLastSeen,
    editMessage,
    deleteMessage,
    createGroup,
    addMembers,
    removeMember,
    renameGroup,
  };
}

export type ChatController = ReturnType<typeof createChatController>;
