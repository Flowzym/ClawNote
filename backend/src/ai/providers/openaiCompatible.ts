import type { AiConfig } from '../../config.js';
import type { StructureArgs } from '../types.js';

function buildMessages(args: StructureArgs) {
  const system = [
    'Du bist ein Strukturierungsdienst für eine lokale Aufgaben-App.',
    'Antworte ausschließlich als JSON.',
    'Erfinde keine Workspaces, Ordner oder Kategorien.',
    'Verwende bevorzugt die vorhandenen IDs aus den bereitgestellten Listen.',
    'Wenn unklar, setze folderIdSuggestion oder categoryIdSuggestion auf null.',
    'dueDate nur als YYYY-MM-DD oder null.',
    'lane nur: inbox, today, week, later, done.',
    'priority nur: niedrig, mittel, hoch, kritisch.',
    'Gib höchstens 20 Vorschläge zurück.',
  ].join(' ');

  const userPayload = {
    rawInput: args.rawInput,
    availableWorkspaces: args.workspaces,
    availableFolders: args.folders,
    availableCategories: args.categories,
    outputFormat: {
      tasks: [
        {
          title: 'string',
          notes: 'string',
          workspaceIdSuggestion: 'string',
          folderIdSuggestion: 'string|null',
          categoryIdSuggestion: 'string|null',
          priority: 'niedrig|mittel|hoch|kritisch',
          lane: 'inbox|today|week|later|done',
          dueDate: 'YYYY-MM-DD|null',
          tags: ['string'],
          confidence: 'number 0..1',
          newFolderSuggestion: 'string|null',
          newCategorySuggestion: 'string|null',
        },
      ],
    },
  };

  return [
    { role: 'system', content: system },
    { role: 'user', content: JSON.stringify(userPayload) },
  ];
}

function extractContent(data: unknown): string {
  if (!data || typeof data !== 'object') {
    throw new Error('Ungültige Provider-Antwort');
  }

  const choices = (data as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    throw new Error('Provider-Antwort enthält keine choices');
  }

  const firstChoice = choices[0] as { message?: { content?: unknown } };
  const content = firstChoice.message?.content;

  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    const text = content
      .map((part) => {
        if (typeof part === 'string') {
          return part;
        }

        if (part && typeof part === 'object' && 'text' in part && typeof (part as { text?: unknown }).text === 'string') {
          return (part as { text: string }).text;
        }

        return '';
      })
      .join('')
      .trim();

    if (text) {
      return text;
    }
  }

  throw new Error('Provider-Antwort enthält keinen lesbaren Inhalt');
}

function tryParseJson(text: string): unknown {
  return JSON.parse(text);
}

function parseJsonFromText(text: string): unknown {
  const trimmed = text.trim();

  const candidates = [trimmed];

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fencedMatch?.[1]) {
    candidates.push(fencedMatch[1].trim());
  }

  const objectStart = trimmed.indexOf('{');
  const objectEnd = trimmed.lastIndexOf('}');
  if (objectStart >= 0 && objectEnd > objectStart) {
    candidates.push(trimmed.slice(objectStart, objectEnd + 1));
  }

  const arrayStart = trimmed.indexOf('[');
  const arrayEnd = trimmed.lastIndexOf(']');
  if (arrayStart >= 0 && arrayEnd > arrayStart) {
    candidates.push(trimmed.slice(arrayStart, arrayEnd + 1));
  }

  for (const candidate of candidates) {
    try {
      return tryParseJson(candidate);
    } catch {
      // next
    }
  }

  throw new Error('Provider-Antwort ist kein gültiges JSON');
}

export async function requestOpenAiCompatibleStructure(args: StructureArgs, config: AiConfig): Promise<unknown> {
  if (!config.baseUrl || !config.model) {
    throw new Error('AI-Konfiguration unvollständig');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const headers = new Headers({
      'Content-Type': 'application/json',
    });

    if (config.apiKey) {
      headers.set('Authorization', `Bearer ${config.apiKey}`);
    }

    const response = await fetch(`${config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model: config.model,
        temperature: 0.1,
        messages: buildMessages(args),
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `AI-HTTP ${response.status}`);
    }

    const data = (await response.json()) as unknown;
    const content = extractContent(data);
    return parseJsonFromText(content);
  } finally {
    clearTimeout(timeoutId);
  }
}
