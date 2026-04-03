import { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { db } from '../db/sqlite.js';

export async function registerTaskRoutes(app: FastifyInstance) {
  app.get('/', async (request) => {
    const q = request.query as {
      workspaceId?: string;
      folderId?: string;
      categoryId?: string;
      lane?: string;
      status?: string;
      search?: string;
    };

    let sql = `
      SELECT
        t.*,
        w.name AS workspace_name,
        f.name AS folder_name,
        c.name AS category_name
      FROM tasks t
      JOIN workspaces w ON w.id = t.workspace_id
      LEFT JOIN folders f ON f.id = t.folder_id
      LEFT JOIN categories c ON c.id = t.category_id
      WHERE 1 = 1
    `;

    const params: unknown[] = [];

    if (q.workspaceId) {
      sql += ' AND t.workspace_id = ?';
      params.push(q.workspaceId);
    }
    if (q.folderId) {
      sql += ' AND t.folder_id = ?';
      params.push(q.folderId);
    }
    if (q.categoryId) {
      sql += ' AND t.category_id = ?';
      params.push(q.categoryId);
    }
    if (q.lane) {
      sql += ' AND t.lane = ?';
      params.push(q.lane);
    }
    if (q.status) {
      sql += ' AND t.status = ?';
      params.push(q.status);
    }
    if (q.search) {
      const search = `%${q.search}%`;
      sql += ' AND (t.title LIKE ? OR t.notes LIKE ? OR t.raw_input LIKE ?)';
      params.push(search, search, search);
    }

    sql += `
      ORDER BY
        CASE t.priority
          WHEN 'kritisch' THEN 1
          WHEN 'hoch' THEN 2
          WHEN 'mittel' THEN 3
          ELSE 4
        END,
        t.due_date IS NULL,
        t.due_date,
        t.created_at DESC
    `;

    return db.prepare(sql).all(...params);
  });

  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);

    if (!task) {
      return reply.code(404).send({ error: 'Task nicht gefunden' });
    }

    return task;
  });

  app.post('/', async (request, reply) => {
    const body = request.body as {
      rawInput?: string;
      title?: string;
      notes?: string;
      workspaceId?: string;
      folderId?: string | null;
      categoryId?: string | null;
      priority?: 'niedrig' | 'mittel' | 'hoch' | 'kritisch';
      lane?: 'inbox' | 'today' | 'week' | 'later' | 'done';
      dueDate?: string | null;
      source?: 'manual' | 'ai' | 'imported';
    };

    if (!body?.workspaceId) {
      return reply.code(400).send({ error: 'workspaceId ist erforderlich' });
    }

    const rawInput = body.rawInput?.trim() ?? body.title?.trim() ?? '';
    if (!rawInput) {
      return reply.code(400).send({ error: 'rawInput oder title ist erforderlich' });
    }

    const title = body.title?.trim() || rawInput;
    const id = randomUUID();

    db.prepare(`
      INSERT INTO tasks (
        id, raw_input, title, notes, workspace_id, folder_id, category_id,
        priority, lane, status, due_date, ai_confidence, ai_suggested, source,
        created_at, updated_at, completed_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, NULL, 0, ?, datetime('now'), datetime('now'), NULL)
    `).run(
      id,
      rawInput,
      title,
      body.notes ?? '',
      body.workspaceId,
      body.folderId ?? null,
      body.categoryId ?? null,
      body.priority ?? 'mittel',
      body.lane ?? 'inbox',
      body.dueDate ?? null,
      body.source ?? 'manual',
    );

    return db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  });

  app.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Record<string, unknown> | undefined;

    if (!existing) {
      return reply.code(404).send({ error: 'Task nicht gefunden' });
    }

    const body = request.body as {
      title?: string;
      notes?: string;
      workspaceId?: string;
      folderId?: string | null;
      categoryId?: string | null;
      priority?: 'niedrig' | 'mittel' | 'hoch' | 'kritisch';
      lane?: 'inbox' | 'today' | 'week' | 'later' | 'done';
      dueDate?: string | null;
    };

    db.prepare(`
      UPDATE tasks
      SET title = ?,
          notes = ?,
          workspace_id = ?,
          folder_id = ?,
          category_id = ?,
          priority = ?,
          lane = ?,
          due_date = ?,
          updated_at = ?
      WHERE id = ?
    `).run(
      body.title ?? existing.title,
      body.notes ?? existing.notes,
      body.workspaceId ?? existing.workspace_id,
      body.folderId === undefined ? existing.folder_id : body.folderId,
      body.categoryId === undefined ? existing.category_id : body.categoryId,
      body.priority ?? existing.priority,
      body.lane ?? existing.lane,
      body.dueDate === undefined ? existing.due_date : body.dueDate,
      new Date().toISOString(),
      id,
    );

    return db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  });

  app.patch('/:id/toggle', async (request, reply) => {
    const { id } = request.params as { id: string };
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Record<string, unknown> | undefined;

    if (!task) {
      return reply.code(404).send({ error: 'Task nicht gefunden' });
    }

    const nextStatus = task.status === 'done' ? 'open' : 'done';
    const nextLane = nextStatus === 'done' ? 'done' : 'inbox';
    const completedAt = nextStatus === 'done' ? new Date().toISOString() : null;

    db.prepare(`
      UPDATE tasks
      SET status = ?, lane = ?, completed_at = ?, updated_at = ?
      WHERE id = ?
    `).run(nextStatus, nextLane, completedAt, new Date().toISOString(), id);

    return db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  });

  app.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = db.prepare('SELECT id FROM tasks WHERE id = ?').get(id) as { id: string } | undefined;

    if (!existing) {
      return reply.code(404).send({ error: 'Task nicht gefunden' });
    }

    db.prepare('DELETE FROM tasks WHERE id = ?').run(id);

    return {
      ok: true,
      deletedId: id,
    };
  });
}
