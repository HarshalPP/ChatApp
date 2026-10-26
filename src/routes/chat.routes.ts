import { Router } from 'express';
import type { ChatController } from '../controllers/chat.controller';

export function chatRoutes(chat: ChatController): Router {
  const router = Router();

  router.post('/create', chat.createChat);
  router.post('/:chatId/message/send', chat.sendMessage);
  router.get('/:chatId/messages', chat.getMessages);
  router.post('/:chatId/message/:messageId/read', chat.markRead);
  router.post('/:chatId/lastseen', chat.updateLastSeen);

  
  // edit / delete
  router.patch('/:chatId/message/:messageId', chat.editMessage);
  router.delete('/:chatId/message/:messageId', chat.deleteMessage);

  // groups
  router.post('/group/create', chat.createGroup);
  router.post('/:chatId/members/add', chat.addMembers);
  router.delete('/:chatId/members/:memberId', chat.removeMember);
  router.patch('/:chatId', chat.renameGroup);

  return router;
}
