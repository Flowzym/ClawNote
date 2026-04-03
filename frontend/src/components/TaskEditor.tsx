import { useMemo } from 'react';
import type { Category, Folder, Lane, Priority, Task, Workspace } from '../types';

export type TaskEditDraft = {
  title: string;
  notes: string;
  workspaceId: string;
  folderId: string | null;
  categoryId: string | null;
  priority: Priority;
  lane: Lane;
  dueDate: string;
};

const priorityOptions: Array<{ id: Priority; label: string }> = [
  { id: 'niedrig', label: 'Niedrig' },
  { id: 'mittel', label: 'Mittel' },
  { id: 'hoch', label: 'Hoch' },
  { id: 'kritisch', label: 'Kritisch' },
];

const editableLaneOptions: Array<{ id: Exclude<Lane, 'done'>; label: string }> = [
  { id: 'inbox', label: 'Inbox' },
  { id: 'today', label: 'Heute' },
  { id: 'week', label: 'Diese Woche' },
  { id: 'later', label: 'Später' },
];

export function formatTaskDateForInput(value: string | null): string {
  if (!value) {
    return '';
  }

  return value.slice(0, 10);
}

export function createTaskEditDraft(task: Task): TaskEditDraft {
  const normalizedLane: Lane =
    task.status === 'done'
      ? 'done'
      : task.lane === 'done'
        ? 'inbox'
        : task.lane;

  return {
    title: task.title,
    notes: task.notes,
    workspaceId: task.workspaceId,
    folderId: task.folderId,
    categoryId: task.categoryId,
    priority: task.priority,
    lane: normalizedLane,
    dueDate: formatTaskDateForInput(task.dueDate),
  };
}

type Props = {
  task: Task;
  draft: TaskEditDraft;
  workspaces: Workspace[];
  folders: Folder[];
  categories: Category[];
  isSaving: boolean;
  onChange: (nextDraft: TaskEditDraft) => void;
  onCancel: () => void;
  onSave: () => void;
};

export function TaskEditor({
  task,
  draft,
  workspaces,
  folders,
  categories,
  isSaving,
  onChange,
  onCancel,
  onSave,
}: Props) {
  const availableFolders = useMemo(() => {
    return folders.filter((folder) => folder.workspaceId === draft.workspaceId);
  }, [folders, draft.workspaceId]);

  function updateField<K extends keyof TaskEditDraft>(key: K, value: TaskEditDraft[K]) {
    onChange({
      ...draft,
      [key]: value,
    });
  }

  function handleWorkspaceChange(nextWorkspaceId: string) {
    const folderStillValid = folders.some(
      (folder) => folder.id === draft.folderId && folder.workspaceId === nextWorkspaceId,
    );

    onChange({
      ...draft,
      workspaceId: nextWorkspaceId,
      folderId: folderStillValid ? draft.folderId : null,
    });
  }

  return (
    <div className="task-editor">
      <div className="editor-grid">
        <label className="field">
          <span>Titel</span>
          <input
            type="text"
            value={draft.title}
            onChange={(event) => updateField('title', event.target.value)}
          />
        </label>

        <label className="field field--full">
          <span>Notes</span>
          <textarea
            rows={4}
            value={draft.notes}
            onChange={(event) => updateField('notes', event.target.value)}
          />
        </label>

        <label className="field">
          <span>Workspace</span>
          <select
            value={draft.workspaceId}
            onChange={(event) => handleWorkspaceChange(event.target.value)}
          >
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Ordner</span>
          <select
            value={draft.folderId ?? ''}
            onChange={(event) => updateField('folderId', event.target.value || null)}
          >
            <option value="">Kein Ordner</option>
            {availableFolders.map((folder) => (
              <option key={folder.id} value={folder.id}>
                {folder.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Kategorie</span>
          <select
            value={draft.categoryId ?? ''}
            onChange={(event) => updateField('categoryId', event.target.value || null)}
          >
            <option value="">Keine Kategorie</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Priorität</span>
          <select
            value={draft.priority}
            onChange={(event) => updateField('priority', event.target.value as Priority)}
          >
            {priorityOptions.map((priority) => (
              <option key={priority.id} value={priority.id}>
                {priority.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Lane</span>
          <select
            value={task.status === 'done' ? 'done' : draft.lane}
            disabled={task.status === 'done'}
            onChange={(event) => updateField('lane', event.target.value as Lane)}
          >
            {task.status === 'done' ? (
              <option value="done">Erledigt</option>
            ) : (
              editableLaneOptions.map((lane) => (
                <option key={lane.id} value={lane.id}>
                  {lane.label}
                </option>
              ))
            )}
          </select>
        </label>

        <label className="field">
          <span>Fälligkeitsdatum</span>
          <input
            type="date"
            value={draft.dueDate}
            onChange={(event) => updateField('dueDate', event.target.value)}
          />
        </label>
      </div>

      <div className="editor-help">
        Erledigt bleibt an die Checkbox gekoppelt. Dadurch bleiben Status und Persistenz deterministisch.
      </div>

      <div className="editor-actions">
        <button
          type="button"
          className="ghost-button"
          onClick={onCancel}
          disabled={isSaving}
        >
          Abbrechen
        </button>
        <button
          type="button"
          className="primary-button"
          onClick={onSave}
          disabled={isSaving}
        >
          {isSaving ? 'Speichere …' : 'Speichern'}
        </button>
      </div>
    </div>
  );
}
