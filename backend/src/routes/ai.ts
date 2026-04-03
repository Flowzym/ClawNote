import { FastifyInstance } from 'fastify';

export async function registerAiRoutes(app: FastifyInstance) {
  app.post('/structure', async (request) => {
    const body = request.body as {
      rawInput?: string;
      availableWorkspaces?: Array<{ id: string; name: string }>;
      availableFolders?: Array<{ id: string; workspaceId: string; name: string }>;
      availableCategories?: Array<{ id: string; name: string }>;
    };

    return {
      rawInput: body.rawInput ?? '',
      tasks: [
        {
          title: body.rawInput ?? '',
          notes: '',
          workspaceIdSuggestion: 'ws_unsorted',
          folderIdSuggestion: null,
          categoryIdSuggestion: null,
          priority: 'mittel',
          lane: 'inbox',
          dueDate: null,
          tags: [],
          confidence: 0.5,
          newFolderSuggestion: null,
          newCategorySuggestion: null,
        },
      ],
    };
  });
}
