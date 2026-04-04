import { FormEvent, useEffect, useMemo, useState } from 'react';
import { createTask, deleteTask, getCategories, getFolders, getTasks, getWorkspaces, structureTasks, toggleTask, updateTask } from './api';
import { AiSuggestionCard, type AiSuggestionValidation } from './components/AiSuggestionCard';
import { TaskCard } from './components/TaskCard';
import { createTaskEditDraft, type TaskEditDraft } from './components/TaskEditor';
import type { AiStructureMeta, AiStructureTaskSuggestion, Category, Folder, Lane, Task, Workspace } from './types';

const laneOptions: Array<{ id: Lane | 'all'; label: string }> = [
  { id: 'all', label: 'Alle' },
  { id: 'inbox', label: 'Inbox' },
  { id: 'today', label: 'Heute' },
  { id: 'week', label: 'Diese Woche' },
  { id: 'later', label: 'Später' },
  { id: 'done', label: 'Erledigt' },
];

const statusOptions = [
  { id: 'all', label: 'Alle Status' },
  { id: 'open', label: 'Offen' },
  { id: 'done', label: 'Erledigt' },
] as const;

const priorityOptions = [
  { id: 'all', label: 'Alle Prioritäten' },
  { id: 'niedrig', label: 'Niedrig' },
  { id: 'mittel', label: 'Mittel' },
  { id: 'hoch', label: 'Hoch' },
  { id: 'kritisch', label: 'Kritisch' },
  { id: 'highPlus', label: 'Hoch / Kritisch' },
] as const;

const sortOptions = [
  { id: 'createdDesc', label: 'Neueste zuerst' },
  { id: 'updatedDesc', label: 'Zuletzt geändert' },
  { id: 'dueDateAsc', label: 'Fälligkeit zuerst' },
] as const;

type SortOptionId = (typeof sortOptions)[number]['id'];
type StatusFilterId = (typeof statusOptions)[number]['id'];
type PriorityFilterId = (typeof priorityOptions)[number]['id'];

type LocalAiSuggestion = AiStructureTaskSuggestion & {
  suggestionId: string;
};

type SuggestionPatch = Partial<Omit<LocalAiSuggestion, 'suggestionId'>>;

type UndoState = {
  taskIds: string[];
};

function validateSuggestion(suggestion: LocalAiSuggestion, folders: Folder[]): AiSuggestionValidation {
  const title = suggestion.title.trim();
  const validFolder = suggestion.folderIdSuggestion
    ? folders.some(
        (folder) =>
          folder.id === suggestion.folderIdSuggestion &&
          folder.workspaceId === suggestion.workspaceIdSuggestion,
      )
    : true;

  return {
    isValid: title.length > 0,
    titleError: title.length > 0 ? null : 'Titel darf nicht leer sein.',
    folderHint: !validFolder ? 'Ordner passt nicht mehr zum Workspace und wird beim Übernehmen entfernt.' : null,
  };
}

function formatAiMeta(meta: AiStructureMeta | null): { source: string; detail: string | null } | null {
  if (!meta) {
    return null;
  }

  const source = meta.source === 'llm' ? 'LLM' : 'Heuristik';

  if (meta.fallbackUsed) {
    const detailParts = ['Fallback aktiv'];

    if (meta.provider === 'openclaw') {
      detailParts.push('nach OpenClaw');
    } else if (meta.provider === 'openai_compatible') {
      detailParts.push('nach OpenAI-kompatibel');
    }

    return {
      source,
      detail: detailParts.join(' · '),
    };
  }

  if (meta.source === 'llm') {
    return {
      source,
      detail:
        meta.provider === 'openclaw'
          ? 'OpenClaw'
          : meta.provider === 'openai_compatible'
            ? 'OpenAI-kompatibel'
            : null,
    };
  }

  return {
    source,
    detail: null,
  };
}

export function App() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [structuring, setStructuring] = useState(false);
  const [applyingSuggestions, setApplyingSuggestions] = useState(false);
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<TaskEditDraft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [undoState, setUndoState] = useState<UndoState | null>(null);
  const [input, setInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [aiSourceInput, setAiSourceInput] = useState('');
  const [aiStructureMeta, setAiStructureMeta] = useState<AiStructureMeta | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<LocalAiSuggestion[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedLane, setSelectedLane] = useState<Lane | 'all'>('all');
  const [selectedStatus, setSelectedStatus] = useState<StatusFilterId>('all');
  const [selectedPriority, setSelectedPriority] = useState<PriorityFilterId>('all');
  const [selectedSort, setSelectedSort] = useState<SortOptionId>('createdDesc');

  useEffect(() => {
    void loadInitialData();
  }, []);

  useEffect(() => {
    if (!successMessage || undoState) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setSuccessMessage(null);
    }, 3000);

    return () => window.clearTimeout(timeoutId);
  }, [successMessage, undoState]);

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

  const workspacesById = useMemo(() => new Map(workspaces.map((workspace) => [workspace.id, workspace])), [workspaces]);
  const foldersById = useMemo(() => new Map(folders.map((folder) => [folder.id, folder])), [folders]);
  const categoriesById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const aiMetaDisplay = useMemo(() => formatAiMeta(aiStructureMeta), [aiStructureMeta]);

  const suggestionValidations = useMemo(
    () =>
      new Map(
        aiSuggestions.map((suggestion) => [suggestion.suggestionId, validateSuggestion(suggestion, folders)]),
      ),
    [aiSuggestions, folders],
  );

  const invalidSuggestionCount = useMemo(
    () => Array.from(suggestionValidations.values()).filter((validation) => !validation.isValid).length,
    [suggestionValidations],
  );

  const visibleFolders = useMemo(() => {
    if (!selectedWorkspaceId) {
      return folders;
    }

    return folders.filter((folder) => folder.workspaceId === selectedWorkspaceId);
  }, [folders, selectedWorkspaceId]);

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
      ignoreStatus?: boolean;
      ignorePriority?: boolean;
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

    if (!options?.ignoreStatus && selectedStatus !== 'all' && task.status !== selectedStatus) {
      return false;
    }

    if (!options?.ignorePriority && selectedPriority !== 'all') {
      if (selectedPriority === 'highPlus') {
        if (task.priority !== 'hoch' && task.priority !== 'kritisch') {
          return false;
        }
      } else if (task.priority !== selectedPriority) {
        return false;
      }
    }

    if (!options?.ignoreSearch && normalizedSearchQuery && !getTaskSearchText(task).includes(normalizedSearchQuery)) {
      return false;
    }

    return true;
  }

  const visibleCategories = useMemo(() => {
    const categoryIds = new Set(
      tasks
        .filter((task) => matchesTask(task, { ignoreCategory: true }))
        .map((task) => task.categoryId)
        .filter((value): value is string => Boolean(value)),
    );

    if (categoryIds.size === 0) {
      return categories;
    }

    return categories.filter((category) => categoryIds.has(category.id));
  }, [
    categories,
    tasks,
    selectedWorkspaceId,
    selectedFolderId,
    selectedLane,
    selectedStatus,
    selectedPriority,
    normalizedSearchQuery,
    workspacesById,
    foldersById,
    categoriesById,
  ]);

  const filteredTasks = useMemo(() => tasks.filter((task) => matchesTask(task)), [
    tasks,
    selectedWorkspaceId,
    selectedFolderId,
    selectedLane,
    selectedCategoryId,
    selectedStatus,
    selectedPriority,
    normalizedSearchQuery,
    workspacesById,
    foldersById,
    categoriesById,
  ]);

  const sortedTasks = useMemo(() => {
    const nextTasks = [...filteredTasks];

    function getTime(value: string | null) {
      if (!value) {
        return 0;
      }

      const timestamp = Date.parse(value);
      return Number.isNaN(timestamp) ? 0 : timestamp;
    }

    nextTasks.sort((left, right) => {
      if (selectedSort === 'updatedDesc') {
        return getTime(right.updatedAt) - getTime(left.updatedAt);
      }

      if (selectedSort === 'dueDateAsc') {
        const leftDue = left.dueDate ? getTime(left.dueDate) : Number.POSITIVE_INFINITY;
        const rightDue = right.dueDate ? getTime(right.dueDate) : Number.POSITIVE_INFINITY;

        if (leftDue !== rightDue) {
          return leftDue - rightDue;
        }

        return getTime(right.createdAt) - getTime(left.createdAt);
      }

      return getTime(right.createdAt) - getTime(left.createdAt);
    });

    return nextTasks;
  }, [filteredTasks, selectedSort]);

  const laneCounts = useMemo(() => {
    const counts = new Map<Lane | 'all', number>();
    counts.set('all', tasks.filter((task) => matchesTask(task, { ignoreLane: true })).length);

    for (const lane of laneOptions) {
      if (lane.id === 'all') {
        continue;
      }

      counts.set(
        lane.id,
        tasks.filter((task) => task.lane === lane.id && matchesTask(task, { ignoreLane: true })).length,
      );
    }

    return counts;
  }, [
    tasks,
    selectedWorkspaceId,
    selectedFolderId,
    selectedCategoryId,
    selectedStatus,
    selectedPriority,
    normalizedSearchQuery,
    workspacesById,
    foldersById,
    categoriesById,
  ]);

  const workspaceCounts = useMemo(() => {
    const counts = new Map<string | 'all', number>();
    counts.set('all', tasks.filter((task) => matchesTask(task, { ignoreWorkspace: true, ignoreFolder: true })).length);

    for (const workspace of workspaces) {
      counts.set(
        workspace.id,
        tasks.filter(
          (task) => task.workspaceId === workspace.id && matchesTask(task, { ignoreWorkspace: true, ignoreFolder: true }),
        ).length,
      );
    }

    return counts;
  }, [
    tasks,
    workspaces,
    selectedLane,
    selectedCategoryId,
    selectedStatus,
    selectedPriority,
    normalizedSearchQuery,
    workspacesById,
    foldersById,
    categoriesById,
  ]);

  const folderCounts = useMemo(() => {
    const counts = new Map<string | 'all', number>();
    counts.set('all', tasks.filter((task) => matchesTask(task, { ignoreFolder: true })).length);

    for (const folder of visibleFolders) {
      counts.set(
        folder.id,
        tasks.filter((task) => task.folderId === folder.id && matchesTask(task, { ignoreFolder: true })).length,
      );
    }

    return counts;
  }, [
    tasks,
    visibleFolders,
    selectedWorkspaceId,
    selectedLane,
    selectedCategoryId,
    selectedStatus,
    selectedPriority,
    normalizedSearchQuery,
    workspacesById,
    foldersById,
    categoriesById,
  ]);

  const overviewTasks = useMemo(() => tasks.filter((task) => matchesTask(task, { ignoreStatus: true, ignorePriority: true })), [
    tasks,
    selectedWorkspaceId,
    selectedFolderId,
    selectedLane,
    selectedCategoryId,
    selectedStatus,
    selectedPriority,
    normalizedSearchQuery,
    workspacesById,
    foldersById,
    categoriesById,
  ]);

  const overviewStats = useMemo(
    () => ({
      selected: sortedTasks.length,
      context: overviewTasks.length,
      open: overviewTasks.filter((task) => task.status === 'open').length,
      done: overviewTasks.filter((task) => task.status === 'done').length,
      highPriority: overviewTasks.filter((task) => task.priority === 'hoch' || task.priority === 'kritisch').length,
      withDueDate: overviewTasks.filter((task) => Boolean(task.dueDate)).length,
    }),
    [overviewTasks, sortedTasks.length],
  );

  const currentWorkspaceName = useMemo(() => {
    if (!selectedWorkspaceId) {
      return selectedLane === 'all' ? 'Alle Aufgaben' : laneOptions.find((lane) => lane.id === selectedLane)?.label ?? 'Aufgaben';
    }

    return workspaces.find((workspace) => workspace.id === selectedWorkspaceId)?.name ?? 'Aufgaben';
  }, [selectedLane, selectedWorkspaceId, workspaces]);

  const hasActiveFilters =
    selectedWorkspaceId !== null ||
    selectedFolderId !== null ||
    selectedCategoryId !== null ||
    selectedLane !== 'all' ||
    selectedStatus !== 'all' ||
    selectedPriority !== 'all' ||
    normalizedSearchQuery.length > 0;

  function resetAllFilters() {
    setSearchQuery('');
    setSelectedWorkspaceId(null);
    setSelectedFolderId(null);
    setSelectedCategoryId(null);
    setSelectedLane('all');
    setSelectedStatus('all');
    setSelectedPriority('all');
  }

  function resetOverviewQuickFilters() {
    setSelectedStatus('all');
    setSelectedPriority('all');
    setSelectedSort('createdDesc');
  }

  function clearAiSuggestions() {
    setAiSuggestions([]);
    setAiSourceInput('');
    setAiStructureMeta(null);
  }

  function removeAiSuggestion(suggestionId: string) {
    setAiSuggestions((current) => {
      const next = current.filter((item) => item.suggestionId !== suggestionId);
      if (next.length === 0) {
        setAiSourceInput('');
        setAiStructureMeta(null);
      }
      return next;
    });
  }

  function updateAiSuggestion(suggestionId: string, patch: SuggestionPatch) {
    setAiSuggestions((current) =>
      current.map((item) => (item.suggestionId === suggestionId ? { ...item, ...patch } : item)),
    );
  }

  async function undoLastApply() {
    if (!undoState) {
      return;
    }

    try {
      setApplyingSuggestions(true);
      setError(null);

      await Promise.all(undoState.taskIds.map((taskId) => deleteTask(taskId)));
      setTasks((current) => current.filter((task) => !undoState.taskIds.includes(task.id)));
      setUndoState(null);
      setSuccessMessage('Übernahme rückgängig gemacht.');
    } catch (undoError) {
      setError(undoError instanceof Error ? undoError.message : 'Rückgängig konnte nicht ausgeführt werden');
    } finally {
      setApplyingSuggestions(false);
    }
  }

  async function createTaskFromSuggestion(suggestion: LocalAiSuggestion): Promise<Task> {
    const title = suggestion.title.trim();

    if (!title) {
      throw new Error('Jeder Vorschlag braucht einen Titel');
    }

    const validFolderId = suggestion.folderIdSuggestion
      ? folders.some(
          (folder) =>
            folder.id === suggestion.folderIdSuggestion &&
            folder.workspaceId === suggestion.workspaceIdSuggestion,
        )
        ? suggestion.folderIdSuggestion
        : null
      : null;

    return createTask({
      rawInput: aiSourceInput || title,
      title,
      notes: suggestion.notes.trim(),
      workspaceId: suggestion.workspaceIdSuggestion,
      folderId: validFolderId,
      categoryId: suggestion.categoryIdSuggestion,
      priority: suggestion.priority,
      lane: suggestion.lane === 'done' ? 'inbox' : suggestion.lane,
      dueDate: suggestion.dueDate,
      source: 'ai',
    });
  }

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
      clearAiSuggestions();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Aufgabe konnte nicht erstellt werden');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStructureInput() {
    const rawInput = input.trim();
    if (!rawInput) {
      return;
    }

    try {
      setStructuring(true);
      setError(null);
      setSuccessMessage(null);
      setUndoState(null);

      const response = await structureTasks({
        rawInput,
        availableWorkspaces: workspaces.map((workspace) => ({ id: workspace.id, name: workspace.name })),
        availableFolders: folders.map((folder) => ({ id: folder.id, workspaceId: folder.workspaceId, name: folder.name })),
        availableCategories: categories.map((category) => ({ id: category.id, name: category.name })),
      });

      setAiSourceInput(response.rawInput);
      setAiStructureMeta(response.meta);
      setAiSuggestions(
        response.tasks.map((task, index) => ({
          ...task,
          lane: task.lane === 'done' ? 'inbox' : task.lane,
          suggestionId: `suggestion-${index}-${task.title}`,
        })),
      );
    } catch (structureError) {
      setError(structureError instanceof Error ? structureError.message : 'Input konnte nicht strukturiert werden');
    } finally {
      setStructuring(false);
    }
  }

  async function handleApplySuggestion(suggestionId: string) {
    const suggestion = aiSuggestions.find((item) => item.suggestionId === suggestionId);
    if (!suggestion) {
      return;
    }

    const validation = suggestionValidations.get(suggestionId);
    if (validation && !validation.isValid) {
      setError(validation.titleError ?? 'Vorschlag ist noch nicht gültig');
      return;
    }

    try {
      setApplyingSuggestions(true);
      setError(null);

      const createdTask = await createTaskFromSuggestion(suggestion);
      setTasks((current) => [createdTask, ...current]);
      removeAiSuggestion(suggestionId);
      setSuccessMessage('Vorschlag übernommen.');
      setUndoState({ taskIds: [createdTask.id] });
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : 'Vorschlag konnte nicht übernommen werden');
    } finally {
      setApplyingSuggestions(false);
    }
  }

  async function handleApplyAllSuggestions() {
    if (aiSuggestions.length === 0) {
      return;
    }

    if (invalidSuggestionCount > 0) {
      setError(`${invalidSuggestionCount} Vorschlag/Vorschläge brauchen noch einen gültigen Titel.`);
      return;
    }

    try {
      setApplyingSuggestions(true);
      setError(null);

      const createdTasks: Task[] = [];

      for (const suggestion of aiSuggestions) {
        const createdTask = await createTaskFromSuggestion(suggestion);
        createdTasks.push(createdTask);
      }

      setTasks((current) => [...createdTasks.reverse(), ...current]);
      clearAiSuggestions();
      setInput('');
      setSuccessMessage(`${createdTasks.length} Vorschlag/Vorschläge übernommen.`);
      setUndoState({ taskIds: createdTasks.map((task) => task.id) });
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : 'Vorschläge konnten nicht übernommen werden');
    } finally {
      setApplyingSuggestions(false);
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
            <span className="nav-button__content">
              <span>Alle Ordner</span>
              <span className="nav-count">{folderCounts.get('all') ?? 0}</span>
            </span>
          </button>

          {visibleFolders.map((folder) => (
            <button
              key={folder.id}
              className={`nav-button ${selectedFolderId === folder.id ? 'nav-button--active' : ''}`}
              onClick={() => setSelectedFolderId(folder.id)}
              type="button"
            >
              <span className="nav-button__content">
                <span>{folder.name}</span>
                <span className="nav-count">{folderCounts.get(folder.id) ?? 0}</span>
              </span>
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
          <div className="quick-entry-actions">
            <button className="ghost-button" disabled={structuring || !input.trim()} onClick={() => void handleStructureInput()} type="button">
              {structuring ? 'Strukturiere …' : 'Strukturieren'}
            </button>
            <button disabled={submitting} type="submit">
              {submitting ? 'Speichern …' : 'Hinzufügen'}
            </button>
          </div>
        </form>

        {successMessage && (
          <div className="notice notice--success">
            <div className="notice__content">
              <span>{successMessage}</span>
              {undoState && (
                <button className="ghost-button ghost-button--small" disabled={applyingSuggestions} onClick={() => void undoLastApply()} type="button">
                  Rückgängig
                </button>
              )}
            </div>
          </div>
        )}

        {aiSuggestions.length > 0 && (
          <section className="ai-panel">
            <div className="ai-panel__header">
              <div>
                <h3>Strukturvorschläge</h3>
                <p>Vorschläge aus der Assistenzschicht. Nichts wird automatisch gespeichert.</p>
              </div>
              <div className="ai-panel__actions">
                <button className="ghost-button ghost-button--small" disabled={applyingSuggestions} onClick={clearAiSuggestions} type="button">
                  Verwerfen
                </button>
                <button className="primary-button ghost-button--small" disabled={applyingSuggestions || invalidSuggestionCount > 0} onClick={() => void handleApplyAllSuggestions()} type="button">
                  {applyingSuggestions ? 'Übernehme …' : `Alle übernehmen (${aiSuggestions.length})`}
                </button>
              </div>
            </div>

            <div className="ai-panel__source">Quelle: {aiSourceInput}</div>
            {aiMetaDisplay && (
              <div className="ai-panel__meta">
                <span className="badge">Quelle: {aiMetaDisplay.source}</span>
                {aiMetaDisplay.detail && <span className="badge">{aiMetaDisplay.detail}</span>}
              </div>
            )}
            {invalidSuggestionCount > 0 && <div className="ai-panel__validation">Mindestens ein Vorschlag braucht noch einen gültigen Titel.</div>}

            <div className="ai-suggestion-list">
              {aiSuggestions.map((suggestion) => (
                <AiSuggestionCard
                  key={suggestion.suggestionId}
                  suggestion={suggestion}
                  workspaces={workspaces}
                  folders={folders}
                  categories={categories}
                  validation={suggestionValidations.get(suggestion.suggestionId) ?? { isValid: true, titleError: null, folderHint: null }}
                  isApplying={applyingSuggestions}
                  onChange={(patch) => updateAiSuggestion(suggestion.suggestionId, patch)}
                  onRemove={() => removeAiSuggestion(suggestion.suggestionId)}
                  onApply={() => void handleApplySuggestion(suggestion.suggestionId)}
                />
              ))}
            </div>
          </section>
        )}

        <section className="overview-grid" aria-label="Übersicht zur aktuellen Ansicht">
          <button type="button" className="overview-card overview-card--button" onClick={resetOverviewQuickFilters}>
            <span className="overview-card__label">Aktuelle Auswahl</span>
            <strong className="overview-card__value">{overviewStats.selected}</strong>
            <span className="overview-card__hint">setzt Schnellfilter zurück</span>
          </button>
          <button
            type="button"
            className={`overview-card overview-card--button ${selectedStatus === 'open' ? 'overview-card--active' : ''}`}
            onClick={() => setSelectedStatus((current) => (current === 'open' ? 'all' : 'open'))}
          >
            <span className="overview-card__label">Offen</span>
            <strong className="overview-card__value">{overviewStats.open}</strong>
            <span className="overview-card__hint">setzt Statusfilter</span>
          </button>
          <button
            type="button"
            className={`overview-card overview-card--button ${selectedStatus === 'done' ? 'overview-card--active' : ''}`}
            onClick={() => setSelectedStatus((current) => (current === 'done' ? 'all' : 'done'))}
          >
            <span className="overview-card__label">Erledigt</span>
            <strong className="overview-card__value">{overviewStats.done}</strong>
            <span className="overview-card__hint">setzt Statusfilter</span>
          </button>
          <button
            type="button"
            className={`overview-card overview-card--button ${selectedPriority === 'highPlus' ? 'overview-card--active' : ''}`}
            onClick={() => setSelectedPriority((current) => (current === 'highPlus' ? 'all' : 'highPlus'))}
          >
            <span className="overview-card__label">Hoch / Kritisch</span>
            <strong className="overview-card__value">{overviewStats.highPriority}</strong>
            <span className="overview-card__hint">setzt Prioritätsfilter</span>
          </button>
          <button
            type="button"
            className={`overview-card overview-card--button ${selectedSort === 'dueDateAsc' ? 'overview-card--active' : ''}`}
            onClick={() => setSelectedSort((current) => (current === 'dueDateAsc' ? 'createdDesc' : 'dueDateAsc'))}
          >
            <span className="overview-card__label">Mit Fälligkeit</span>
            <strong className="overview-card__value">{overviewStats.withDueDate}</strong>
            <span className="overview-card__hint">sortiert nach Fälligkeit</span>
          </button>
        </section>

        <div className="filter-toolbar filter-toolbar--grid">
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

          <div className="filter-field">
            <label htmlFor="status-filter">Status</label>
            <select
              id="status-filter"
              value={selectedStatus}
              onChange={(event) => setSelectedStatus(event.target.value as StatusFilterId)}
            >
              {statusOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-field">
            <label htmlFor="priority-filter">Priorität</label>
            <select
              id="priority-filter"
              value={selectedPriority}
              onChange={(event) => setSelectedPriority(event.target.value as PriorityFilterId)}
            >
              {priorityOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-field">
            <label htmlFor="sort-filter">Sortierung</label>
            <select
              id="sort-filter"
              value={selectedSort}
              onChange={(event) => setSelectedSort(event.target.value as SortOptionId)}
            >
              {sortOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <button className="ghost-button" type="button" onClick={resetAllFilters}>
            Alle Filter zurücksetzen
          </button>
        </div>

        <div className="result-meta">
          <span className="badge">{sortedTasks.length} Aufgaben</span>
          <span className="badge">Kontext: {overviewStats.context}</span>
          <span className="badge">Sortierung: {sortOptions.find((option) => option.id === selectedSort)?.label}</span>
          {selectedWorkspaceId && <span className="badge">Workspace: {workspacesById.get(selectedWorkspaceId)?.name ?? '–'}</span>}
          {selectedFolderId && <span className="badge">Ordner: {foldersById.get(selectedFolderId)?.name ?? '–'}</span>}
          {selectedCategoryId && <span className="badge">Kategorie: {categoriesById.get(selectedCategoryId)?.name ?? '–'}</span>}
          {selectedLane !== 'all' && <span className="badge">Lane: {laneOptions.find((lane) => lane.id === selectedLane)?.label ?? selectedLane}</span>}
          {selectedStatus !== 'all' && <span className="badge">Status: {statusOptions.find((option) => option.id === selectedStatus)?.label ?? selectedStatus}</span>}
          {selectedPriority !== 'all' && <span className="badge">Priorität: {priorityOptions.find((option) => option.id === selectedPriority)?.label ?? selectedPriority}</span>}
          {searchQuery.trim() && <span className="badge">Suche: {searchQuery.trim()}</span>}
          {hasActiveFilters && (
            <button className="ghost-button ghost-button--small" type="button" onClick={resetAllFilters}>
              Filter löschen
            </button>
          )}
        </div>

        {error && <div className="notice notice--error">{error}</div>}
        {loading && <div className="notice">Lade Daten …</div>}

        {!loading && (
          <section className="task-list">
            {sortedTasks.map((task) => {
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

            {sortedTasks.length === 0 && <div className="notice">Keine Aufgaben in dieser Ansicht.</div>}
          </section>
        )}
      </section>
    </main>
  );
}
