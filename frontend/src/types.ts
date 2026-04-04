export type Priority = 'niedrig' | 'mittel' | 'hoch' | 'kritisch';
export type Lane = 'inbox' | 'today' | 'week' | 'later' | 'done';
export type Status = 'open' | 'done';

export interface Workspace {
  id: string;
  name: string;
  color: string;
  icon?: string;
}

export interface Folder {
  id: string;
  workspaceId: string;
  parentFolderId: string | null;
  name: string;
  color: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  icon?: string;
}

export interface Task {
  id: string;
  rawInput: string;
  title: string;
  notes: string;
  workspaceId: string;
  folderId: string | null;
  categoryId: string | null;
  priority: Priority;
  lane: Lane;
  status: Status;
  dueDate: string | null;
  tags: string[];
  aiConfidence: number | null;
  aiSuggested: boolean;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface AiStructureTaskSuggestion {
  title: string;
  notes: string;
  workspaceIdSuggestion: string;
  folderIdSuggestion: string | null;
  categoryIdSuggestion: string | null;
  priority: Priority;
  lane: Lane;
  dueDate: string | null;
  tags: string[];
  confidence: number;
  newFolderSuggestion: string | null;
  newCategorySuggestion: string | null;
}

export interface AiStructureMeta {
  source: 'heuristic' | 'llm';
  fallbackUsed: boolean;
  provider: 'disabled' | 'openai_compatible';
}

export interface AiStructureResponse {
  rawInput: string;
  tasks: AiStructureTaskSuggestion[];
  meta: AiStructureMeta;
}
