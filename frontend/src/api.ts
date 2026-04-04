import type { AiStructureMeta, AiStructureResponse, AiStructureTaskSuggestion, Category, Folder, Lane, Task, Workspace } from './types';

type RawWorkspace = {
  id: string;
  name: string;
  color: string;
  icon?: string;
};

type RawFolder = {
  id: string;
  workspace_id: string;
  parent_folder_id: string | null;
  name: string;
  color: string;
};

type RawCategory = {
  id: string;
  name: string;
  color: string;
  icon?: string;
};

type RawTask = {
  id: string;
  raw_input: string;
  title: string;
  notes: string;
  workspace_id: string;
  folder_id: string | null;
  category_id: string | null;
  priority: Task['priority'];
  lane: Task['lane'];
  status: Task['status'];
  due_date: string | null;
  ai_confidence: number | null;
  ai_suggested: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
};

type RawAiStructureTaskSuggestion = {
  title: string;
  notes: string;
  workspaceIdSuggestion: string;
  folderIdSuggestion: string | null;
  categoryIdSuggestion: string | null;
  priority: AiStructureTaskSuggestion['priority'];
  lane: AiStructureTaskSuggestion['lane'];
  dueDate: string | null;
  tags: string[];
  confidence: number;
  newFolderSuggestion: string | null;
  newCategorySuggestion: string | null;
};

type RawAiStructureMeta = {
  source: AiStructureMeta['source'];
  fallbackUsed: boolean;
  provider: AiStructureMeta['provider'];
};

type RawAiStructureResponse = {
  rawInput: string;
  tasks: RawAiStructureTaskSuggestion[];
  meta: RawAiStructureMeta;
};

export type UpdateTaskPayload = {
  title: string;
  notes: string;
  workspaceId: string;
  folderId: string | null;
  categoryId: string | null;
  priority: Task['priority'];
  lane: Lane;
  dueDate: string | null;
};

export type CreateTaskPayload = {
  rawInput: string;
  title?: string;
  notes?: string;
  workspaceId: string;
  folderId?: string | null;
  categoryId?: string | null;
  priority?: Task['priority'];
  lane?: Exclude<Task['lane'], 'done'>;
  dueDate?: string | null;
  source?: 'manual' | 'ai' | 'imported';
};

async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);

  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(input, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function mapWorkspace(raw: RawWorkspace): Workspace {
  return {
    id: raw.id,
    name: raw.name,
    color: raw.color,
    icon: raw.icon,
  };
}

function mapFolder(raw: RawFolder): Folder {
  return {
    id: raw.id,
    workspaceId: raw.workspace_id,
    parentFolderId: raw.parent_folder_id,
    name: raw.name,
    color: raw.color,
  };
}

function mapCategory(raw: RawCategory): Category {
  return {
    id: raw.id,
    name: raw.name,
    color: raw.color,
    icon: raw.icon,
  };
}

function mapTask(raw: RawTask): Task {
  return {
    id: raw.id,
    rawInput: raw.raw_input,
    title: raw.title,
    notes: raw.notes,
    workspaceId: raw.workspace_id,
    folderId: raw.folder_id,
    categoryId: raw.category_id,
    priority: raw.priority,
    lane: raw.lane,
    status: raw.status,
    dueDate: raw.due_date,
    tags: [],
    aiConfidence: raw.ai_confidence,
    aiSuggested: Boolean(raw.ai_suggested),
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    completedAt: raw.completed_at,
  };
}

function mapAiStructureTaskSuggestion(raw: RawAiStructureTaskSuggestion): AiStructureTaskSuggestion {
  return {
    title: raw.title,
    notes: raw.notes,
    workspaceIdSuggestion: raw.workspaceIdSuggestion,
    folderIdSuggestion: raw.folderIdSuggestion,
    categoryIdSuggestion: raw.categoryIdSuggestion,
    priority: raw.priority,
    lane: raw.lane,
    dueDate: raw.dueDate,
    tags: raw.tags,
    confidence: raw.confidence,
    newFolderSuggestion: raw.newFolderSuggestion,
    newCategorySuggestion: raw.newCategorySuggestion,
  };
}

function mapAiStructureMeta(raw: RawAiStructureMeta): AiStructureMeta {
  return {
    source: raw.source,
    fallbackUsed: raw.fallbackUsed,
    provider: raw.provider,
  };
}

export async function getWorkspaces(): Promise<Workspace[]> {
  const data = await fetchJson<RawWorkspace[]>('/api/workspaces');
  return data.map(mapWorkspace);
}

export async function getFolders(): Promise<Folder[]> {
  const data = await fetchJson<RawFolder[]>('/api/folders');
  return data.map(mapFolder);
}

export async function getCategories(): Promise<Category[]> {
  const data = await fetchJson<RawCategory[]>('/api/categories');
  return data.map(mapCategory);
}

export async function getTasks(): Promise<Task[]> {
  const data = await fetchJson<RawTask[]>('/api/tasks');
  return data.map(mapTask);
}

export async function createTask(payload: CreateTaskPayload): Promise<Task> {
  const data = await fetchJson<RawTask>('/api/tasks', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return mapTask(data);
}

export async function structureTasks(payload: {
  rawInput: string;
  availableWorkspaces: Array<{ id: string; name: string }>;
  availableFolders: Array<{ id: string; workspaceId: string; name: string }>;
  availableCategories: Array<{ id: string; name: string }>;
}): Promise<AiStructureResponse> {
  const data = await fetchJson<RawAiStructureResponse>('/api/ai/structure', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  return {
    rawInput: data.rawInput,
    tasks: data.tasks.map(mapAiStructureTaskSuggestion),
    meta: mapAiStructureMeta(data.meta),
  };
}

export async function updateTask(taskId: string, payload: UpdateTaskPayload): Promise<Task> {
  const data = await fetchJson<RawTask>(`/api/tasks/${taskId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return mapTask(data);
}

export async function toggleTask(taskId: string): Promise<Task> {
  const data = await fetchJson<RawTask>(`/api/tasks/${taskId}/toggle`, {
    method: 'PATCH',
  });
  return mapTask(data);
}

export async function deleteTask(taskId: string): Promise<void> {
  await fetchJson<{ ok: true; deletedId: string }>(`/api/tasks/${taskId}`, {
    method: 'DELETE',
  });
}
