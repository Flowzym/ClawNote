import type { AiConfig } from '../../config.js';
import type { StructureArgs } from '../types.js';

export async function requestOpenClawStructure(_args: StructureArgs, config: AiConfig): Promise<unknown> {
  if (!config.openClawGatewayUrl) {
    throw new Error('OpenClaw-Provider gewählt, aber CLAWNOTE_OPENCLAW_GATEWAY_URL fehlt.');
  }

  throw new Error(
    'OpenClaw-Provider ist strukturell vorbereitet, aber die konkrete Gateway-API ist noch nicht implementiert. Die aktuelle App fällt deshalb kontrolliert auf Heuristik zurück.',
  );
}
