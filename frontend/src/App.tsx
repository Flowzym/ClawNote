import { FormEvent, useEffect, useMemo, useState } from 'react';
import { createTask, deleteTask, getCategories, getFolders, getTasks, getWorkspaces, toggleTask, updateTask } from './api';
import { TaskCard } from './components/TaskCard';
import { createTaskEditDraft, type TaskEditDraft } from './components/TaskEditor';
import type { Category, Folder, Lane, Task, Workspace } from './types';

const laneOptions: Array<{ id: Lane | 'all'; label: string }> = [
  { id: 'all', label: 'Alle' },
  { id: 'inbox', label: 'Inbox' },
  { id: 'today', label: 'Heute' },
  { id: 'week', label: 'Diese Woche' },
  { id: 'later', label: 'Später' },
  { id: 'done', label: 'Erledigt' },
];

export function App() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<TaskEditDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedLane, setSelectedLane] = useState<Lane | 'all'>('all');

  useEffect(() => {
    void loadInitialData();
  }, []);

  async function loadInitialData() {
    try {
      setLoading(true);
      setError(null);

      const [workspaceData, folderData, categoryData, taskData] = await Promise.all([
        getWorkspaces(),
        getFolders(),
        getCategories(),
        getTasks(),
      ]);

      setWorkspaces(workspaceData);
      setFolders(folderData);
      setCategories(categoryData);
      setTasks(taskData);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Daten konnten nicht geladen werden');
    } finally {
      setLoading(false);
    }
  }

  const visibleFolders = useMemo(() => {
    if (!selectedWorkspaceId) {
      return folders;
    }

    return folders.filter((folder) => folder.workspaceId === selectedWorkspaceId);
  }, [folders, selectedWorkspaceId]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (selectedWorkspaceId && task.workspaceId !== selectedWorkspaceId) {
        return false;
      }
      if (selectedFolderId && task.folderId !== selectedFolderId) {
        return false;
      }
      if (selectedLane !== 'all' && task.lane !== selectedLane) {
        return false;
      }
      return true;
    });
  }, [tasks, selectedWorkspaceId, selectedFolderId, selectedLane]);

  const currentWorkspaceName = useMemo(() => {
    if (!selectedWorkspaceId) {
      return selectedLane === 'all' ? 'Alle Aufgaben' : laneOptions.find((lane) => lane.id === selectedLane)?.label ?? 'Aufgaben';
    }

    return workspaces.find((workspace) => workspace.id === selectedWorkspaceId)?.name ?? 'Aufgaben';
  }, [selectedLane, selectedWorkspaceId, workspaces]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const rawInput = input.trim();
    if (!rawInput) {
      return;
    }

    const defaultWorkspaceId =
      selectedWorkspaceId ??
      workspaces.find((workspace) => workspace.id === 'ws_unsorted')?.id ??
      workspaces[0]?.id;

    if (!defaultWorkspaceId) {
      setError('Kein Workspace verfügbar');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const createdTask = await createTask({
        rawInput,
        workspaceId: defaultWorkspaceId,
        folderId: selectedFolderId,
      });

      setTasks((current) => [createdTask, ...current]);
      setInput('');
      setSelectedLane('all');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Aufgabe konnte nicht erstellt werden');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggle(taskId: string) {
    try {
      setError(null);

      const updatedTask = await toggleTask(taskId);

      setTasks((current) => current.map((task) => (task.id === taskId ? updatedTask : task)));

      if (editingTaskId === taskId) {
        setEditDraft(createTaskEditDraft(updatedTask));
      }
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : 'Task konnte nicht geändert werden');
    }
  }

  function handleStartEdit(task: Task) {
    setEditingTaskId(task.id);
    setEditDraft(createTaskEditDraft(task));
    setError(null);
  }

  function handleCancelEdit() {
    setEditingTaskId(null);
    setEditDraft(null);
  }

  async function handleSaveTask(task: Task) {
    if (!editDraft) {
      return;
    }

    const title = editDraft.title.trim();

    if (!title) {
      setError('Titel ist erforderlich');
      return;
    }

    try {
      setSavingTaskId(task.id);
      setError(null);

      const updatedTask = await updateTask(task.id, {
        title,
        notes: editDraft.notes.trim(),
        workspaceId: editDraft.workspaceId,
        folderId: editDraft.folderId,
        categoryId: editDraft.categoryId,
        priority: editDraft.priority,
        lane: task.status === 'done' ? 'done' : editDraft.lane === 'done' ? 'inbox' : editDraft.lane,
        dueDate: editDraft.dueDate ? editDraft.dueDate : null,
      });

      setTasks((current) => current.map((item) => (item.id === task.id ? updatedTask : item)));
      setEditingTaskId(null);
      setEditDraft(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Task konnte nicht gespeichert werden');
    } finally {
      setSavingTaskId(null);
    }
  }

  async function handleDeleteTask(task: Task) {
    const confirmed = window.confirm(`Aufgabe wirklich löschen?\n\n${task.title}`);
    if (!confirmed) {
      return;
    }

    try {
      setError(null);
      await deleteTask(task.id);

      setTasks((current) => current.filter((item) => item.id !== task.id));

      if (editingTaskId === task.id) {
        setEditingTaskId(null);
        setEditDraft(null);
      }
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Task konnte nicht gelöscht werden');
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <h1>ClawNote</h1>

        <nav className="nav-section">
          {laneOptions.map((lane) => (
            <button
              key={lane.id}
              className={`nav-button ${selectedLane === lane.id ? 'nav-button--active' : ''}`}
              onClick={() => setSelectedLane(lane.id)}
              type="button"
            >
              {lane.label}
            </button>
          ))}
        </nav>

        <section className="sidebar-block">
          <h2>Workspaces</h2>
          <button
            className={`nav-button ${selectedWorkspaceId === null ? 'nav-button--active' : ''}`}
            onClick={() => {
              setSelectedWorkspaceId(null);
              setSelectedFolderId(null);
            }}
            type="button"
          >
            Alle Workspaces
          </button>

          {workspaces.map((workspace) => (
            <button
              key={workspace.id}
              className={`nav-button ${selectedWorkspaceId === workspace.id ? 'nav-button--active' : ''}`}
              onClick={() => {
                setSelectedWorkspaceId(workspace.id);
                setSelectedFolderId(null);
              }}
              type="button"
            >
              <span className="workspace-dot" style={{ background: workspace.color }} />
              {workspace.name}
            </button>
          ))}
        </section>

        <section className="sidebar-block">
          <h2>Ordner</h2>
          <button
            className={`nav-button ${selectedFolderId === null ? 'nav-button--active' : ''}`}
            onClick={() => setSelectedFolderId(null)}
            type="button"
          >
            Alle Ordner
          </button>

          {visibleFolders.map((folder) => (
            <button
              key={folder.id}
              className={`nav-button ${selectedFolderId === folder.id ? 'nav-button--active' : ''}`}
              onClick={() => setSelectedFolderId(folder.id)}
              type="button"
            >
              {folder.name}
            </button>
          ))}
        </section>
      </aside>

      <section className="content">
        <header className="content-header">
          <div>
            <h2>{currentWorkspaceName}</h2>
            <p>Notizen und Aufgaben aus der lokalen API. Checkboxen und Status bleiben deterministisch.</p>
          </div>

          <button className="ghost-button" onClick={() => void loadInitialData()} type="button">
            Neu laden
          </button>
        </header>

        <form className="quick-entry" onSubmit={(event) => void handleSubmit(event)}>
          <input
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Aufgabe oder Notiz eingeben …"
            aria-label="Aufgabe oder Notiz"
          />
          <button disabled={submitting} type="submit">
            {submitting ? 'Speichern …' : 'Hinzufügen'}
          </button>
        </form>

        {error && <div className="notice notice--error">{error}</div>}
        {loading && <div className="notice">Lade Daten …</div>}

        {!loading && (
          <section className="task-list">
            {filteredTasks.map((task) => {
              const workspace = workspaces.find((item) => item.id === task.workspaceId);
              const folder = folders.find((item) => item.id === task.folderId);
              const category = categories.find((item) => item.id === task.categoryId);
              const isEditing = editingTaskId === task.id;

              return (
                <TaskCard
                  key={task.id}
                  task={task}
                  workspace={workspace}
                  folder={folder}
                  category={category}
                  workspaces={workspaces}
                  folders={folders}
                  categories={categories}
                  isEditing={isEditing}
                  isSaving={savingTaskId === task.id}
                  editDraft={isEditing ? editDraft : null}
                  onToggle={(taskId) => void handleToggle(taskId)}
                  onStartEdit={handleStartEdit}
                  onCancelEdit={handleCancelEdit}
                  onDraftChange={setEditDraft}
                  onSave={(taskToSave) => void handleSaveTask(taskToSave)}
                  onDelete={(taskToDelete) => void handleDeleteTask(taskToDelete)}
                />
              );
            })}

            {filteredTasks.length === 0 && <div className="notice">Keine Aufgaben in dieser Ansicht.</div>}
          </section>
        )}
      </section>
    </main>
  );
}
