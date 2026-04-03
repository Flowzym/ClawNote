import type { Category, Folder, Lane, Task, Workspace } from './types';

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

async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...init,
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

export async function createTask(payload: {
  rawInput: string;
  workspaceId: string;
  folderId?: string | null;
}): Promise<Task> {
  const data = await fetchJson<RawTask>('/api/tasks', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return mapTask(data);
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
