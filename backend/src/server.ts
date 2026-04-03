import Fastify from 'fastify';
import { initializeDatabase } from './db/sqlite.js';
import { registerAiRoutes } from './routes/ai.js';
import { registerCategoryRoutes } from './routes/categories.js';
import { registerFolderRoutes } from './routes/folders.js';
import { registerTaskRoutes } from './routes/tasks.js';
import { registerWorkspaceRoutes } from './routes/workspaces.js';

const app = Fastify({ logger: true });

app.register(registerWorkspaceRoutes, { prefix: '/api/workspaces' });
app.register(registerFolderRoutes, { prefix: '/api/folders' });
app.register(registerCategoryRoutes, { prefix: '/api/categories' });
app.register(registerTaskRoutes, { prefix: '/api/tasks' });
app.register(registerAiRoutes, { prefix: '/api/ai' });

app.get('/api/health', async () => {
  return {
    ok: true,
    app: 'ClawNote backend',
  };
});

const start = async () => {
  try {
    await initializeDatabase();
    await app.listen({ port: 3001, host: '127.0.0.1' });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

void start();
