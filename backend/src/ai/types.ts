export type WorkspaceOption = { id: string; name: string };
export type FolderOption = { id: string; workspaceId: string; name: string };
export type CategoryOption = { id: string; name: string };

export type StructureRequestBody = {
  rawInput?: string;
  availableWorkspaces?: WorkspaceOption[];
  availableFolders?: FolderOption[];
  availableCategories?: CategoryOption[];
};

export type StructurePriority = 'niedrig' | 'mittel' | 'hoch' | 'kritisch';
export type StructureLane = 'inbox' | 'today' | 'week' | 'later' | 'done';

export type StructureTaskSuggestion = {
  title: string;
  notes: string;
  workspaceIdSuggestion: string;
  folderIdSuggestion: string | null;
  categoryIdSuggestion: string | null;
  priority: StructurePriority;
  lane: StructureLane;
  dueDate: string | null;
  tags: string[];
  confidence: number;
  newFolderSuggestion: string | null;
  newCategorySuggestion: string | null;
};

export type StructureArgs = {
  rawInput: string;
  workspaces: WorkspaceOption[];
  folders: FolderOption[];
  categories: CategoryOption[];
};

export type StructureMeta = {
  source: 'heuristic' | 'llm';
  fallbackUsed: boolean;
  provider: 'disabled' | 'openai_compatible' | 'openclaw';
};

export type StructureResponse = {
  rawInput: string;
  tasks: StructureTaskSuggestion[];
  meta: StructureMeta;
};
