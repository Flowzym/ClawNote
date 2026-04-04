import { FastifyInstance } from 'fastify';
import { structureWithAiOrFallback } from '../ai/structureService.js';
import type { StructureRequestBody } from '../ai/types.js';

export async function registerAiRoutes(app: FastifyInstance) {
  app.post('/structure', async (request, reply) => {
    const body = request.body as StructureRequestBody;
    const rawInput = body.rawInput?.trim() ?? '';

    if (!rawInput) {
      return reply.code(400).send({ error: 'rawInput ist erforderlich' });
    }

    const result = await structureWithAiOrFallback({
      rawInput,
      workspaces: body.availableWorkspaces ?? [],
      folders: body.availableFolders ?? [],
      categories: body.availableCategories ?? [],
    });

    return result;
  });
}
