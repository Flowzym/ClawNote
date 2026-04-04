import {
  extractTags,
  inferLane,
  inferPriority,
  normalize,
  parseDueDate,
  scoreNameMatch,
  splitTitleAndNotes,
} from './heuristicStructure.js';
import type {
  FolderOption,
  StructureArgs,
  StructureLane,
  StructurePriority,
  StructureTaskSuggestion,
} from './types.js';

type RawSuggestion = Partial<StructureTaskSuggestion> & {
  rawText?: unknown;
  text?: unknown;
  originalText?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function pickFromIdOrName<T extends { id: string; name: string }>(value: unknown, options: T[]): T | null {
  const raw = normalizeString(value);
  if (!raw) {
    return null;
  }

  const byId = options.find((option) => option.id === raw);
  if (byId) {
    return byId;
  }

  const normalizedRaw = normalize(raw);
  const exactName = options.find((option) => normalize(option.name) === normalizedRaw);
  if (exactName) {
    return exactName;
  }

  let best: T | null = null;
  let bestScore = 0;

  for (const option of options) {
    const score = scoreNameMatch(raw, option.name);
    if (score > bestScore) {
      best = option;
      bestScore = score;
    }
  }

  return bestScore > 0 ? best : null;
}

function normalizePriority(value: unknown, fallbackText: string): StructurePriority {
  const raw = normalizeString(value);

  if (raw === 'niedrig' || raw === 'mittel' || raw === 'hoch' || raw === 'kritisch') {
    return raw;
  }

  return inferPriority(fallbackText);
}

function normalizeLane(value: unknown, fallbackText: string, dueDate: string | null): StructureLane {
  const raw = normalizeString(value);

  if (raw === 'inbox' || raw === 'today' || raw === 'week' || raw === 'later' || raw === 'done') {
    return raw;
  }

  return inferLane(fallbackText, dueDate);
}

function normalizeTags(value: unknown, fallbackText: string): string[] {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .map((entry) => normalizeString(entry).toLowerCase())
          .filter(Boolean),
      ),
    );
  }

  return extractTags(fallbackText);
}

function normalizeConfidence(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(0.35, Math.min(0.95, Number(value.toFixed(2))));
  }

  return 0.72;
}

function deriveBaseText(rawSuggestion: RawSuggestion): string {
  return [
    normalizeString(rawSuggestion.rawText),
    normalizeString(rawSuggestion.text),
    normalizeString(rawSuggestion.originalText),
    normalizeString(rawSuggestion.title),
    normalizeString(rawSuggestion.notes),
  ]
    .filter(Boolean)
    .join(' ')
    .trim();
}

function normalizeTitleAndNotes(rawSuggestion: RawSuggestion): { title: string; notes: string; baseText: string } {
  const title = normalizeString(rawSuggestion.title);
  const notes = normalizeString(rawSuggestion.notes);
  const baseText = deriveBaseText(rawSuggestion);

  if (title) {
    return { title, notes, baseText: baseText || `${title} ${notes}`.trim() };
  }

  const split = splitTitleAndNotes(baseText);
  return {
    title: split.title || baseText.slice(0, 140).trim(),
    notes: notes || split.notes,
    baseText,
  };
}

function normalizeDueDate(value: unknown, fallbackText: string): string | null {
  const raw = normalizeString(value);

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  return parseDueDate(raw || fallbackText);
}

function getRawSuggestions(payload: unknown): RawSuggestion[] {
  if (Array.isArray(payload)) {
    return payload.filter(isRecord) as RawSuggestion[];
  }

  if (isRecord(payload)) {
    const tasks = payload.tasks;
    if (Array.isArray(tasks)) {
      return tasks.filter(isRecord) as RawSuggestion[];
    }
  }

  return [];
}

function resolveWorkspaceId(rawSuggestion: RawSuggestion, args: StructureArgs, defaultWorkspaceId: string): string {
  const workspace = pickFromIdOrName(rawSuggestion.workspaceIdSuggestion, args.workspaces);
  if (workspace) {
    return workspace.id;
  }

  const globalFolder = pickFromIdOrName(rawSuggestion.folderIdSuggestion, args.folders);
  if (globalFolder) {
    return globalFolder.workspaceId;
  }

  return defaultWorkspaceId;
}

function resolveFolder(rawSuggestion: RawSuggestion, folderOptions: FolderOption[]): FolderOption | null {
  return pickFromIdOrName(rawSuggestion.folderIdSuggestion, folderOptions);
}

export function normalizeStructureResult(payload: unknown, args: StructureArgs): StructureTaskSuggestion[] {
  const rawSuggestions = getRawSuggestions(payload).slice(0, 20);
  const defaultWorkspaceId = args.workspaces.find((workspace) => workspace.id === 'ws_unsorted')?.id ?? args.workspaces[0]?.id ?? 'ws_unsorted';

  return rawSuggestions
    .map((rawSuggestion) => {
      const { title, notes, baseText } = normalizeTitleAndNotes(rawSuggestion);

      if (!title) {
        return null;
      }

      const workspaceIdSuggestion = resolveWorkspaceId(rawSuggestion, args, defaultWorkspaceId);
      const folderOptions = args.folders.filter((folder) => folder.workspaceId === workspaceIdSuggestion);
      const folder = resolveFolder(rawSuggestion, folderOptions);
      const category = pickFromIdOrName(rawSuggestion.categoryIdSuggestion, args.categories);
      const dueDate = normalizeDueDate(rawSuggestion.dueDate, baseText);
      const fallbackText = [title, notes, baseText].filter(Boolean).join(' ').trim();

      return {
        title,
        notes,
        workspaceIdSuggestion,
        folderIdSuggestion: folder?.id ?? null,
        categoryIdSuggestion: category?.id ?? null,
        priority: normalizePriority(rawSuggestion.priority, fallbackText),
        lane: normalizeLane(rawSuggestion.lane, fallbackText, dueDate),
        dueDate,
        tags: normalizeTags(rawSuggestion.tags, fallbackText),
        confidence: normalizeConfidence(rawSuggestion.confidence),
        newFolderSuggestion: normalizeString(rawSuggestion.newFolderSuggestion) || null,
        newCategorySuggestion: normalizeString(rawSuggestion.newCategorySuggestion) || null,
      };
    })
    .filter((value): value is StructureTaskSuggestion => Boolean(value));
}
