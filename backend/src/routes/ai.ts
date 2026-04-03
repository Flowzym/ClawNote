import { FastifyInstance } from 'fastify';

type WorkspaceOption = { id: string; name: string };
type FolderOption = { id: string; workspaceId: string; name: string };
type CategoryOption = { id: string; name: string };

type StructureRequestBody = {
  rawInput?: string;
  availableWorkspaces?: WorkspaceOption[];
  availableFolders?: FolderOption[];
  availableCategories?: CategoryOption[];
};

type StructureTaskSuggestion = {
  title: string;
  notes: string;
  workspaceIdSuggestion: string;
  folderIdSuggestion: string | null;
  categoryIdSuggestion: string | null;
  priority: 'niedrig' | 'mittel' | 'hoch' | 'kritisch';
  lane: 'inbox' | 'today' | 'week' | 'later' | 'done';
  dueDate: string | null;
  tags: string[];
  confidence: number;
  newFolderSuggestion: string | null;
  newCategorySuggestion: string | null;
};

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(base: Date, days: number): Date {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

function splitRawInput(rawInput: string): string[] {
  const normalized = rawInput
    .replace(/\r/g, '\n')
    .replace(/[•◦▪▸]/g, '\n')
    .replace(/\n\s*[-*+]\s+/g, '\n')
    .replace(/\n\s*\d+[.)]\s+/g, '\n')
    .replace(/;\s+(?=[A-ZÄÖÜa-zäöü0-9])/g, '\n');

  const lines = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.length > 0 ? lines : [rawInput.trim()];
}

function extractTags(value: string): string[] {
  return Array.from(new Set(Array.from(value.matchAll(/#([\p{L}0-9_-]+)/gu)).map((match) => match[1].toLowerCase())));
}

function inferPriority(value: string): 'niedrig' | 'mittel' | 'hoch' | 'kritisch' {
  const text = normalize(value);

  if (/(kritisch|dringend|asap|sofort|heute noch|unbedingt|prioritaet 1|prio 1)/.test(text)) {
    return 'kritisch';
  }

  if (/(bald|wichtig|zeitnah|morgen|diese woche|priority high|prio 2|hoch)/.test(text)) {
    return 'hoch';
  }

  if (/(spater|spaeter|irgendwann|niedrig|optional|nice to have)/.test(text)) {
    return 'niedrig';
  }

  return 'mittel';
}

function inferLane(value: string, dueDate: string | null): 'inbox' | 'today' | 'week' | 'later' | 'done' {
  const text = normalize(value);

  if (/(erledigt|done|abgeschlossen)/.test(text)) {
    return 'done';
  }

  if (/(heute|sofort|dringend|asap)/.test(text)) {
    return 'today';
  }

  if (/(morgen|diese woche|bis freitag|bis ende der woche)/.test(text)) {
    return 'week';
  }

  if (/(spater|spaeter|naechste woche|nächste woche|naechsten monat|nächsten monat)/.test(text)) {
    return 'later';
  }

  if (dueDate) {
    const today = new Date();
    const due = new Date(dueDate);
    const diffDays = Math.floor((due.getTime() - new Date(toIsoDate(today)).getTime()) / 86400000);

    if (diffDays <= 1) {
      return 'today';
    }

    if (diffDays <= 7) {
      return 'week';
    }
  }

  return 'inbox';
}

function parseDueDate(value: string): string | null {
  const text = normalize(value);
  const today = new Date();

  if (/\bheute\b/.test(text)) {
    return toIsoDate(today);
  }

  if (/\bmorgen\b/.test(text)) {
    return toIsoDate(addDays(today, 1));
  }

  if (/\buebermorgen\b|\bübermorgen\b/.test(text)) {
    return toIsoDate(addDays(today, 2));
  }

  const isoMatch = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const germanMatch = text.match(/\b(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?\b/);
  if (germanMatch) {
    const day = Number(germanMatch[1]);
    const month = Number(germanMatch[2]);
    let year = germanMatch[3] ? Number(germanMatch[3]) : today.getFullYear();

    if (year < 100) {
      year += 2000;
    }

    const candidate = new Date(year, month - 1, day);
    if (candidate.getMonth() === month - 1 && candidate.getDate() === day) {
      if (!germanMatch[3] && candidate < new Date(toIsoDate(today))) {
        candidate.setFullYear(candidate.getFullYear() + 1);
      }

      return toIsoDate(candidate);
    }
  }

  return null;
}

function splitTitleAndNotes(value: string): { title: string; notes: string } {
  const cleaned = value.trim().replace(/^[-*+]\s+/, '');
  const separatorMatch = cleaned.match(/^(.{1,140}?)(?:\s[-–—:]\s)(.+)$/);

  if (separatorMatch) {
    return {
      title: separatorMatch[1].trim(),
      notes: separatorMatch[2].trim(),
    };
  }

  return {
    title: cleaned,
    notes: '',
  };
}

function scoreNameMatch(input: string, candidateName: string): number {
  const normalizedInput = normalize(input);
  const normalizedCandidate = normalize(candidateName);

  if (!normalizedInput || !normalizedCandidate) {
    return 0;
  }

  if (normalizedInput.includes(normalizedCandidate)) {
    return normalizedCandidate.length + 20;
  }

  const candidateTokens = normalizedCandidate.split(/\s+/).filter((token) => token.length >= 3);
  const matchingTokens = candidateTokens.filter((token) => normalizedInput.includes(token));

  if (matchingTokens.length === 0) {
    return 0;
  }

  return matchingTokens.length * 5 + matchingTokens.join('').length;
}

function pickBestWorkspace(input: string, workspaces: WorkspaceOption[]): WorkspaceOption | null {
  let best: WorkspaceOption | null = null;
  let bestScore = 0;

  for (const workspace of workspaces) {
    const score = scoreNameMatch(input, workspace.name);
    if (score > bestScore) {
      best = workspace;
      bestScore = score;
    }
  }

  return bestScore > 0 ? best : null;
}

function pickBestFolder(input: string, folders: FolderOption[], workspaceId: string | null): FolderOption | null {
  const relevantFolders = workspaceId ? folders.filter((folder) => folder.workspaceId === workspaceId) : folders;
  let best: FolderOption | null = null;
  let bestScore = 0;

  for (const folder of relevantFolders) {
    const score = scoreNameMatch(input, folder.name);
    if (score > bestScore) {
      best = folder;
      bestScore = score;
    }
  }

  return bestScore > 0 ? best : null;
}

function pickBestCategory(input: string, categories: CategoryOption[]): CategoryOption | null {
  let best: CategoryOption | null = null;
  let bestScore = 0;

  for (const category of categories) {
    const score = scoreNameMatch(input, category.name);
    if (score > bestScore) {
      best = category;
      bestScore = score;
    }
  }

  return bestScore > 0 ? best : null;
}

function inferCategoryByKeyword(input: string, categories: CategoryOption[]): CategoryOption | null {
  const text = normalize(input);
  const keywordMap: Array<{ pattern: RegExp; aliases: string[] }> = [
    { pattern: /(einkauf|kaufen|bestellen|shop)/, aliases: ['einkauf', 'shopping', 'besorgung'] },
    { pattern: /(arzt|gesundheit|therapie|medikament|apotheke)/, aliases: ['gesundheit', 'medizin'] },
    { pattern: /(rechnung|bank|finanz|überweisung|steuer)/, aliases: ['finanzen', 'rechnung', 'bank'] },
    { pattern: /(arbeit|job|projekt|meeting|kunde)/, aliases: ['arbeit', 'job', 'projekt'] },
    { pattern: /(haushalt|putzen|wohnung|wäsche|waesche)/, aliases: ['haushalt', 'zuhause'] },
  ];

  for (const entry of keywordMap) {
    if (!entry.pattern.test(text)) {
      continue;
    }

    const match = categories.find((category) => entry.aliases.some((alias) => normalize(category.name).includes(alias)));
    if (match) {
      return match;
    }
  }

  return null;
}

function computeConfidence(parts: {
  workspaceMatched: boolean;
  folderMatched: boolean;
  categoryMatched: boolean;
  dueDateMatched: boolean;
  titleWasSplit: boolean;
  rawInput: string;
}): number {
  let confidence = 0.45;

  if (parts.workspaceMatched) confidence += 0.15;
  if (parts.folderMatched) confidence += 0.1;
  if (parts.categoryMatched) confidence += 0.1;
  if (parts.dueDateMatched) confidence += 0.08;
  if (parts.titleWasSplit) confidence += 0.05;
  if (parts.rawInput.length <= 140) confidence += 0.03;

  return Math.max(0.35, Math.min(0.95, Number(confidence.toFixed(2))));
}

export async function registerAiRoutes(app: FastifyInstance) {
  app.post('/structure', async (request, reply) => {
    const body = request.body as StructureRequestBody;
    const rawInput = body.rawInput?.trim() ?? '';

    if (!rawInput) {
      return reply.code(400).send({ error: 'rawInput ist erforderlich' });
    }

    const workspaces = body.availableWorkspaces ?? [];
    const folders = body.availableFolders ?? [];
    const categories = body.availableCategories ?? [];

    const defaultWorkspaceId = workspaces.find((workspace) => workspace.id === 'ws_unsorted')?.id ?? workspaces[0]?.id ?? 'ws_unsorted';

    const tasks: StructureTaskSuggestion[] = splitRawInput(rawInput)
      .slice(0, 20)
      .map((entry) => {
        const workspaceMatch = pickBestWorkspace(entry, workspaces);
        const workspaceIdSuggestion = workspaceMatch?.id ?? defaultWorkspaceId;

        const folderMatch = pickBestFolder(entry, folders, workspaceIdSuggestion);
        const categoryMatch = pickBestCategory(entry, categories) ?? inferCategoryByKeyword(entry, categories);
        const dueDate = parseDueDate(entry);
        const priority = inferPriority(entry);
        const lane = inferLane(entry, dueDate);
        const tags = extractTags(entry);
        const split = splitTitleAndNotes(entry);
        const confidence = computeConfidence({
          workspaceMatched: Boolean(workspaceMatch),
          folderMatched: Boolean(folderMatch),
          categoryMatched: Boolean(categoryMatch),
          dueDateMatched: Boolean(dueDate),
          titleWasSplit: Boolean(split.notes),
          rawInput: entry,
        });

        return {
          title: split.title,
          notes: split.notes,
          workspaceIdSuggestion,
          folderIdSuggestion: folderMatch?.id ?? null,
          categoryIdSuggestion: categoryMatch?.id ?? null,
          priority,
          lane,
          dueDate,
          tags,
          confidence,
          newFolderSuggestion: null,
          newCategorySuggestion: null,
        };
      });

    return {
      rawInput,
      tasks,
    };
  });
}
