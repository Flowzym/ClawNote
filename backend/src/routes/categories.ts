import { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { db } from '../db/sqlite.js';

export async function registerCategoryRoutes(app: FastifyInstance) {
  app.get('/', async () => {
    return db.prepare('SELECT * FROM categories ORDER BY sort_order, name').all();
  });

  app.post('/', async (request, reply) => {
    const body = request.body as {
      name?: string;
      color?: string;
      icon?: string;
      isSystem?: boolean;
    };

    if (!body?.name?.trim()) {
      return reply.code(400).send({ error: 'name ist erforderlich' });
    }

    const id = randomUUID();

    db.prepare(`
      INSERT INTO categories (id, name, color, icon, is_system, sort_order, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 999, datetime('now'), datetime('now'))
    `).run(id, body.name.trim(), body.color ?? '', body.icon ?? '', body.isSystem ? 1 : 0);

    return db.prepare('SELECT * FROM categories WHERE id = ?').get(id);
  });
}
