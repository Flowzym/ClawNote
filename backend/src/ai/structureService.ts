import { getAiConfig } from '../config.js';
import { structureHeuristically } from './heuristicStructure.js';
import { normalizeStructureResult } from './normalizeStructureResult.js';
import { requestOpenAiCompatibleStructure } from './providers/openaiCompatible.js';
import type { StructureArgs, StructureResponse } from './types.js';

export async function structureWithAiOrFallback(args: StructureArgs): Promise<StructureResponse> {
  const config = getAiConfig();

  if (config.provider === 'disabled') {
    return {
      rawInput: args.rawInput,
      tasks: structureHeuristically(args),
      meta: {
        source: 'heuristic',
        fallbackUsed: false,
        provider: 'disabled',
      },
    };
  }

  try {
    const rawResult = await requestOpenAiCompatibleStructure(args, config);
    const tasks = normalizeStructureResult(rawResult, args);

    if (tasks.length === 0) {
      throw new Error('LLM lieferte keine verwertbaren Vorschläge');
    }

    return {
      rawInput: args.rawInput,
      tasks,
      meta: {
        source: 'llm',
        fallbackUsed: false,
        provider: config.provider,
      },
    };
  } catch {
    return {
      rawInput: args.rawInput,
      tasks: structureHeuristically(args),
      meta: {
        source: 'heuristic',
        fallbackUsed: true,
        provider: config.provider,
      },
    };
  }
}
