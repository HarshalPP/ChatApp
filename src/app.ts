import express, { type Express } from 'express';
import type { Pool } from 'pg';
import { createChatController } from './controllers/chat.controller';
import { createUserController } from './controllers/user.controller';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { createChatRepository } from './repositories/chat.repository';
import { createUserRepository } from './repositories/user.repository';
import { chatRoutes } from './routes/chat.routes';
import { userRoutes } from './routes/user.routes';
import { createChatService } from './services/chat.service';
import type { MessageStore } from './stores/message.store';

export interface AppDeps {
  db: Pool;
  messageStore: MessageStore;
}

export function createApp({ db, messageStore }: AppDeps): Express {
  const users = createUserRepository(db);
  const chatService = createChatService(createChatRepository(db), users, messageStore);

  const app = express();
  app.use(express.json({ limit: '100kb' }));

  app.get("/" , async (_req ,res)=>{
    res.json('API IS RUNNING')
  })

  app.get('/health', async (_req, res) => {
    await db.query('SELECT 1');
    res.json({ status: 'ok' });
  });

  app.use('/chat', chatRoutes(createChatController(chatService)));
  app.use('/user', userRoutes(createUserController(chatService, users)));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
