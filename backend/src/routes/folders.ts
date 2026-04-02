import { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { db } from '../db/sqlite.js';

export async function registerFolderRoutes(app: FastifyInstance) {
  app.get('/', async (request) => {
    const { workspaceId } = request.query as { workspaceId?: string };

    if (workspaceId) {
      return db
        .prepare('SELECT * FROM folders WHERE workspace_id = ? ORDER BY sort_order, name')
        .all(workspaceId);
    }

    return db.prepare('SELECT * FROM folders ORDER BY sort_order, name').all();
  });

  app.post('/', async (request, reply) => {
    const body = request.body as {
      workspaceId?: string;
      parentFolderId?: string | null;
      name?: string;
      color?: string;
    };

    if (!body?.workspaceId) {
      return reply.code(400).send({ error: 'workspaceId ist erforderlich' });
    }

    if (!body?.name?.trim()) {
      return reply.code(400).send({ error: 'name ist erforderlich' });
    }

    const id = randomUUID();

    db.prepare(`
      INSERT INTO folders (id, workspace_id, parent_folder_id, name, color, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 999, datetime('now'), datetime('now'))
    `).run(
      id,
      body.workspaceId,
      body.parentFolderId ?? null,
      body.name.trim(),
      body.color ?? '',
    );

    return db.prepare('SELECT * FROM folders WHERE id = ?').get(id);
  });
}
