export type AiProvider = 'disabled' | 'openai_compatible';

export type AiConfig = {
  provider: AiProvider;
  baseUrl: string | null;
  apiKey: string | null;
  model: string | null;
  timeoutMs: number;
};

function parseProvider(value: string | undefined): AiProvider {
  if (value === 'openai_compatible') {
    return 'openai_compatible';
  }

  return 'disabled';
}

function parseTimeout(value: string | undefined): number {
  const timeout = Number(value ?? 20000);

  if (!Number.isFinite(timeout) || timeout <= 0) {
    return 20000;
  }

  return timeout;
}

export function getAiConfig(): AiConfig {
  return {
    provider: parseProvider(process.env.CLAWNOTE_AI_PROVIDER),
    baseUrl: process.env.CLAWNOTE_AI_BASE_URL?.trim() || null,
    apiKey: process.env.CLAWNOTE_AI_API_KEY?.trim() || null,
    model: process.env.CLAWNOTE_AI_MODEL?.trim() || null,
    timeoutMs: parseTimeout(process.env.CLAWNOTE_AI_TIMEOUT_MS),
  };
}
