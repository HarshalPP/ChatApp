import type { Request, Response } from 'express';
import { parse } from '../middleware/validate';
import type { UserRepository } from '../repositories/user.repository';
import type { ChatService } from '../services/chat.service';
import { notFound } from '../utils/http-error';
import { createUserBody, userParams } from '../validators/chat.schemas';

export function createUserController(chatService: ChatService, users: UserRepository) {
  async function createUser(req: Request, res: Response) {
    const { name } = parse(createUserBody, req, 'body');
    res.status(201).json(await users.create(name));
  }

  async function getUser(req: Request, res: Response) {
    const { userId } = parse(userParams, req, 'params');

    const user = await users.findById(userId);
    if (!user) throw notFound('User not found');

    res.json(user);
  }

  async function getUserChats(req: Request, res: Response) {
    const { userId } = parse(userParams, req, 'params');

    const chats = await chatService.listUserChats(userId);
    res.json({ userId, count: chats.length, chats });
  }

  return { createUser, getUser, getUserChats };
}

export type UserController = ReturnType<typeof createUserController>;
