import type {
  CategoryOption,
  FolderOption,
  StructureArgs,
  StructureLane,
  StructurePriority,
  StructureTaskSuggestion,
  WorkspaceOption,
} from './types.js';

const weekdayMap: Record<string, number> = {
  sonntag: 0,
  sonntags: 0,
  montag: 1,
  montags: 1,
  dienstag: 2,
  dienstags: 2,
  mittwoch: 3,
  mittwochs: 3,
  donnerstag: 4,
  donnerstags: 4,
  freitag: 5,
  freitags: 5,
  samstag: 6,
  samstags: 6,
};

export function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(base: Date, days: number): Date {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(base: Date, months: number): Date {
  return new Date(base.getFullYear(), base.getMonth() + months, 1);
}

function getDaysUntilWeekday(base: Date, weekday: number, includeToday = true): number {
  const currentWeekday = base.getDay();
  let diff = (weekday - currentWeekday + 7) % 7;

  if (diff === 0 && !includeToday) {
    diff = 7;
  }

  return diff;
}

function getUpcomingWeekday(base: Date, weekday: number, includeToday = true): Date {
  return addDays(startOfDay(base), getDaysUntilWeekday(base, weekday, includeToday));
}

export function splitRawInput(rawInput: string): string[] {
  const normalized = rawInput
    .replace(/\r/g, '\n')
    .replace(/\[[ xX]?\]\s*/g, '\n')
    .replace(/[•◦▪▸]/g, '\n')
    .replace(/\|/g, '\n')
    .replace(/\n\s*[-*+]\s+/g, '\n')
    .replace(/\n\s*\d+[.)]\s+/g, '\n')
    .replace(/;\s+(?=[A-ZÄÖÜa-zäöü0-9])/g, '\n')
    .replace(/\s+[•◦▪▸]\s+/g, '\n');

  const lines = normalized
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => line.split(/\s{2,}/).map((part) => part.trim()).filter(Boolean));

  return lines.length > 0 ? lines : [rawInput.trim()];
}

export function extractTags(value: string): string[] {
  return Array.from(new Set(Array.from(value.matchAll(/#([\p{L}0-9_-]+)/gu)).map((match) => match[1].toLowerCase())));
}

export function inferPriority(value: string): StructurePriority {
  const text = normalize(value);

  if (/(kritisch|dringend|asap|sofort|heute noch|unbedingt|prioritaet 1|prio 1|deadline|frist heute)/.test(text)) {
    return 'kritisch';
  }

  if (/(bald|wichtig|zeitnah|morgen|diese woche|priority high|prio 2|hoch|frist|bis freitag)/.test(text)) {
    return 'hoch';
  }

  if (/(spater|spaeter|irgendwann|niedrig|optional|nice to have|naechsten monat|nächsten monat)/.test(text)) {
    return 'niedrig';
  }

  return 'mittel';
}

export function inferLane(value: string, dueDate: string | null): StructureLane {
  const text = normalize(value);

  if (/(erledigt|done|abgeschlossen)/.test(text)) {
    return 'done';
  }

  if (/(heute|sofort|dringend|asap|bis heute)/.test(text)) {
    return 'today';
  }

  if (/(morgen|diese woche|bis freitag|bis ende der woche)/.test(text)) {
    return 'week';
  }

  if (/(spater|spaeter|naechste woche|nächste woche|naechsten monat|nächsten monat)/.test(text)) {
    return 'later';
  }

  if (dueDate) {
    const today = startOfDay(new Date());
    const due = startOfDay(new Date(dueDate));
    const diffDays = Math.floor((due.getTime() - today.getTime()) / 86400000);

    if (diffDays <= 1) {
      return 'today';
    }

    if (diffDays <= 7) {
      return 'week';
    }

    return 'later';
  }

  return 'inbox';
}

function parseWeekdayDate(text: string, today: Date): string | null {
  for (const [weekdayName, weekdayIndex] of Object.entries(weekdayMap)) {
    const nextWeekPattern = new RegExp(`\\b(?:naechsten|nächsten|kommenden)\\s+${weekdayName}\\b`);
    if (nextWeekPattern.test(text)) {
      const currentWeekday = today.getDay();
      const diff = getDaysUntilWeekday(today, weekdayIndex, false);
      const days = diff <= 7 - currentWeekday ? diff + 7 : diff;
      return toIsoDate(addDays(startOfDay(today), days));
    }

    const genericPattern = new RegExp(`\\b(?:am|bis)?\\s*${weekdayName}\\b`);
    if (genericPattern.test(text)) {
      return toIsoDate(getUpcomingWeekday(today, weekdayIndex, true));
    }
  }

  return null;
}

export function parseDueDate(value: string): string | null {
  const text = normalize(value);
  const today = startOfDay(new Date());

  if (/\bheute\b/.test(text)) {
    return toIsoDate(today);
  }

  if (/\bmorgen\b/.test(text)) {
    return toIsoDate(addDays(today, 1));
  }

  if (/\buebermorgen\b|\bübermorgen\b/.test(text)) {
    return toIsoDate(addDays(today, 2));
  }

  if (/\bnaechste woche\b|\bnächste woche\b/.test(text)) {
    return toIsoDate(addDays(today, 7));
  }

  if (/\bende der woche\b|\bbis ende der woche\b/.test(text)) {
    return toIsoDate(getUpcomingWeekday(today, 5, true));
  }

  if (/\bnaechsten monat\b|\bnächsten monat\b/.test(text)) {
    return toIsoDate(addMonths(today, 1));
  }

  const weekdayDate = parseWeekdayDate(text, today);
  if (weekdayDate) {
    return weekdayDate;
  }

  const isoMatch = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const germanMatch = text.match(/\b(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?\b/);
  if (germanMatch) {
    const day = Number(germanMatch[1]);
    const month = Number(germanMatch[2]);
    let year = germanMatch[3] ? Number(germanMatch[3]) : today.getFullYear();

    if (year < 100) {
      year += 2000;
    }

    const candidate = new Date(year, month - 1, day);
    if (candidate.getMonth() === month - 1 && candidate.getDate() === day) {
      if (!germanMatch[3] && candidate < today) {
        candidate.setFullYear(candidate.getFullYear() + 1);
      }

      return toIsoDate(candidate);
    }
  }

  return null;
}

export function stripTrailingDateHints(value: string): string {
  return value
    .replace(/\b(?:heute|morgen|übermorgen|uebermorgen|diese woche|naechste woche|nächste woche)\b/gi, '')
    .replace(/\b(?:bis|am)\s+(?:montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)\b/gi, '')
    .replace(/\b\d{1,2}[./]\d{1,2}(?:[./]\d{2,4})?\b/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function splitTitleAndNotes(value: string): { title: string; notes: string } {
  const cleaned = stripTrailingDateHints(value.trim().replace(/^[-*+]\s+/, ''));
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

export function scoreNameMatch(input: string, candidateName: string): number {
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

  const longestTokenLength = Math.max(...matchingTokens.map((token) => token.length));
  return matchingTokens.length * 5 + matchingTokens.join('').length + longestTokenLength;
}

export function pickBestWorkspace(input: string, workspaces: WorkspaceOption[]): WorkspaceOption | null {
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

export function pickBestFolder(input: string, folders: FolderOption[], workspaceId: string | null): FolderOption | null {
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

export function pickBestCategory(input: string, categories: CategoryOption[]): CategoryOption | null {
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

export function inferCategoryByKeyword(input: string, categories: CategoryOption[]): CategoryOption | null {
  const text = normalize(input);
  const keywordMap: Array<{ pattern: RegExp; aliases: string[] }> = [
    { pattern: /(einkauf|kaufen|bestellen|shop|lebensmittel)/, aliases: ['einkauf', 'shopping', 'besorgung'] },
    { pattern: /(arzt|gesundheit|therapie|medikament|apotheke|arzttermin)/, aliases: ['gesundheit', 'medizin'] },
    { pattern: /(rechnung|bank|finanz|uberweisung|überweisung|steuer|zahlung)/, aliases: ['finanzen', 'rechnung', 'bank'] },
    { pattern: /(arbeit|job|projekt|meeting|kunde|termin mit kunde)/, aliases: ['arbeit', 'job', 'projekt'] },
    { pattern: /(haushalt|putzen|wohnung|wasche|wäsche|waesche)/, aliases: ['haushalt', 'zuhause'] },
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

export function structureHeuristically(args: StructureArgs): StructureTaskSuggestion[] {
  const { rawInput, workspaces, folders, categories } = args;
  const defaultWorkspaceId = workspaces.find((workspace) => workspace.id === 'ws_unsorted')?.id ?? workspaces[0]?.id ?? 'ws_unsorted';

  return splitRawInput(rawInput)
    .slice(0, 20)
    .map((entry) => {
      const globalFolderMatch = pickBestFolder(entry, folders, null);
      const workspaceMatch = pickBestWorkspace(entry, workspaces);
      const workspaceIdSuggestion = workspaceMatch?.id ?? globalFolderMatch?.workspaceId ?? defaultWorkspaceId;

      const folderMatch =
        pickBestFolder(entry, folders, workspaceIdSuggestion) ??
        (globalFolderMatch?.workspaceId === workspaceIdSuggestion ? globalFolderMatch : null);

      const categoryContext = [entry, folderMatch?.name ?? '', workspaceMatch?.name ?? ''].join(' ').trim();
      const categoryMatch = pickBestCategory(categoryContext, categories) ?? inferCategoryByKeyword(categoryContext, categories);
      const dueDate = parseDueDate(entry);
      const priority = inferPriority(entry);
      const lane = inferLane(entry, dueDate);
      const tags = extractTags(entry);
      const split = splitTitleAndNotes(entry);
      const confidence = computeConfidence({
        workspaceMatched: Boolean(workspaceMatch || globalFolderMatch),
        folderMatched: Boolean(folderMatch),
        categoryMatched: Boolean(categoryMatch),
        dueDateMatched: Boolean(dueDate),
        titleWasSplit: Boolean(split.notes),
        rawInput: entry,
      });

      return {
        title: split.title || entry.trim(),
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
}
