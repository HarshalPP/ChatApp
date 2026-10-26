import { Router } from 'express';
import type { UserController } from '../controllers/user.controller';

export function userRoutes(user: UserController): Router {
  const router = Router();

  router.post('/', user.createUser);
  router.get('/:userId', user.getUser);
  router.get('/:userId/chats', user.getUserChats);

  return router;
}
