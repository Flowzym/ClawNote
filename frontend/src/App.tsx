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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
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

  const workspacesById = useMemo(() => {
    return new Map(workspaces.map((workspace) => [workspace.id, workspace]));
  }, [workspaces]);

  const foldersById = useMemo(() => {
    return new Map(folders.map((folder) => [folder.id, folder]));
  }, [folders]);

  const categoriesById = useMemo(() => {
    return new Map(categories.map((category) => [category.id, category]));
  }, [categories]);

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();

  const visibleFolders = useMemo(() => {
    if (!selectedWorkspaceId) {
      return folders;
    }

    return folders.filter((folder) => folder.workspaceId === selectedWorkspaceId);
  }, [folders, selectedWorkspaceId]);

  const visibleCategories = useMemo(() => {
    const categoryIds = new Set(
      tasks
        .filter((task) => !selectedWorkspaceId || task.workspaceId === selectedWorkspaceId)
        .filter((task) => !selectedFolderId || task.folderId === selectedFolderId)
        .map((task) => task.categoryId)
        .filter((value): value is string => Boolean(value)),
    );

    if (categoryIds.size === 0) {
      return categories;
    }

    return categories.filter((category) => categoryIds.has(category.id));
  }, [categories, tasks, selectedWorkspaceId, selectedFolderId]);

  function getTaskSearchText(task: Task): string {
    return [
      task.title,
      task.notes,
      task.rawInput,
      task.priority,
      task.lane,
      workspacesById.get(task.workspaceId)?.name ?? '',
      task.folderId ? foldersById.get(task.folderId)?.name ?? '' : '',
      task.categoryId ? categoriesById.get(task.categoryId)?.name ?? '' : '',
    ]
      .join(' ')
      .toLowerCase();
  }

  function matchesTask(
    task: Task,
    options?: {
      ignoreWorkspace?: boolean;
      ignoreFolder?: boolean;
      ignoreLane?: boolean;
      ignoreCategory?: boolean;
      ignoreSearch?: boolean;
    },
  ): boolean {
    if (!options?.ignoreWorkspace && selectedWorkspaceId && task.workspaceId !== selectedWorkspaceId) {
      return false;
    }

    if (!options?.ignoreFolder && selectedFolderId && task.folderId !== selectedFolderId) {
      return false;
    }

    if (!options?.ignoreLane && selectedLane !== 'all' && task.lane !== selectedLane) {
      return false;
    }

    if (!options?.ignoreCategory && selectedCategoryId && task.categoryId !== selectedCategoryId) {
      return false;
    }

    if (!options?.ignoreSearch && normalizedSearchQuery && !getTaskSearchText(task).includes(normalizedSearchQuery)) {
      return false;
    }

    return true;
  }

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => matchesTask(task));
  }, [
    tasks,
    selectedWorkspaceId,
    selectedFolderId,
    selectedLane,
    selectedCategoryId,
    normalizedSearchQuery,
    workspacesById,
    foldersById,
    categoriesById,
  ]);

  const laneCounts = useMemo(() => {
    const counts = new Map<Lane | 'all', number>();

    counts.set(
      'all',
      tasks.filter((task) => matchesTask(task, { ignoreLane: true })).length,
    );

    for (const lane of laneOptions) {
      if (lane.id === 'all') {
        continue;
      }

      counts.set(
        lane.id,
        tasks.filter(
          (task) => task.lane === lane.id && matchesTask(task, { ignoreLane: true }),
        ).length,
      );
    }

    return counts;
  }, [
    tasks,
    selectedWorkspaceId,
    selectedFolderId,
    selectedCategoryId,
    normalizedSearchQuery,
    workspacesById,
    foldersById,
    categoriesById,
  ]);

  const workspaceCounts = useMemo(() => {
    const counts = new Map<string | 'all', number>();

    counts.set(
      'all',
      tasks.filter((task) => matchesTask(task, { ignoreWorkspace: true, ignoreFolder: true })).length,
    );

    for (const workspace of workspaces) {
      counts.set(
        workspace.id,
        tasks.filter(
          (task) =>
            task.workspaceId === workspace.id &&
            matchesTask(task, { ignoreWorkspace: true, ignoreFolder: true }),
        ).length,
      );
    }

    return counts;
  }, [
    tasks,
    workspaces,
    selectedLane,
    selectedCategoryId,
    normalizedSearchQuery,
    workspacesById,
    foldersById,
    categoriesById,
  ]);

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
              <span className="nav-button__content">
                <span>{lane.label}</span>
                <span className="nav-count">{laneCounts.get(lane.id) ?? 0}</span>
              </span>
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
            <span className="nav-button__content">
              <span>Alle Workspaces</span>
              <span className="nav-count">{workspaceCounts.get('all') ?? 0}</span>
            </span>
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
              <span className="nav-button__content">
                <span className="workspace-label">
                  <span className="workspace-dot" style={{ background: workspace.color }} />
                  {workspace.name}
                </span>
                <span className="nav-count">{workspaceCounts.get(workspace.id) ?? 0}</span>
              </span>
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

        <div className="filter-toolbar">
          <div className="filter-field filter-field--search">
            <label htmlFor="task-search">Suche</label>
            <input
              id="task-search"
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Titel, Notes, Workspace, Ordner, Kategorie …"
            />
          </div>

          <div className="filter-field">
            <label htmlFor="category-filter">Kategorie</label>
            <select
              id="category-filter"
              value={selectedCategoryId ?? ''}
              onChange={(event) => setSelectedCategoryId(event.target.value || null)}
            >
              <option value="">Alle Kategorien</option>
              {visibleCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <button
            className="ghost-button"
            type="button"
            onClick={() => {
              setSearchQuery('');
              setSelectedCategoryId(null);
            }}
          >
            Filter zurücksetzen
          </button>
        </div>

        <div className="result-meta">
          <span className="badge">{filteredTasks.length} Aufgaben</span>
          {selectedCategoryId && (
            <span className="badge">
              Kategorie: {categoriesById.get(selectedCategoryId)?.name ?? '–'}
            </span>
          )}
          {searchQuery.trim() && <span className="badge">Suche: {searchQuery.trim()}</span>}
        </div>

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
