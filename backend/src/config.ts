export type AiProvider = 'disabled' | 'openai_compatible' | 'openclaw';

export type AiConfig = {
  provider: AiProvider;
  baseUrl: string | null;
  apiKey: string | null;
  model: string | null;
  timeoutMs: number;
  openClawGatewayUrl: string | null;
  openClawGatewayToken: string | null;
  openClawAgent: string | null;
};

function parseProvider(value: string | undefined): AiProvider {
  if (value === 'openai_compatible') {
    return 'openai_compatible';
  }

  if (value === 'openclaw') {
    return 'openclaw';
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
    openClawGatewayUrl: process.env.CLAWNOTE_OPENCLAW_GATEWAY_URL?.trim() || null,
    openClawGatewayToken: process.env.CLAWNOTE_OPENCLAW_GATEWAY_TOKEN?.trim() || null,
    openClawAgent: process.env.CLAWNOTE_OPENCLAW_AGENT?.trim() || null,
  };
}
