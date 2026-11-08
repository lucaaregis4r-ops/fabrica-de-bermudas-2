import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  type ScenePlan,
  type ScenePlanItem,
  type Shot,
  type ActionCue,
  ScenePlanSchema,
} from '../shared/contracts.js';
import { loadServerConfig } from './config.js';

export interface RigSpecification {
  characterId: string;
  name: string;
  species?: string;
  version: string;
  description?: string;
  supportedActions: string[];
  supportedProps: string[];
  supportedSets: string[];
  cameras: Record<string, { scale: number; translateX: number; translateY: number; showDesk?: boolean }>;
}

export type DirectorErrorCode =
  | 'CONFIG_MISSING'
  | 'AUTH_FAILED'
  | 'INVALID_PROVIDER_RESPONSE'
  | 'CATALOG_VALIDATION_ERROR'
  | 'NETWORK_ERROR';

export class DirectorError extends Error {
  public readonly code: DirectorErrorCode;
  public readonly details?: unknown;

  constructor(code: DirectorErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'DirectorError';
    this.code = code;
    this.details = details;
  }
}

export interface PlanOptions {
  provider?: 'gemini' | 'groq' | 'openai' | 'openrouter' | 'mock' | 'auto';
  apiKey?: string;
  model?: string;
  allowRepair?: boolean;
  fallbackToLocalStoryboard?: boolean;
  scriptRevisionId?: string;
  baseDir?: string;
}

export interface ParsedSceneBlock {
  sceneId: string;
  text: string;
  startChar: number;
  endChar: number;
}

/**
 * Carrega o rig padrão do Saruê
 */
export function loadSarueRig(baseDir = process.cwd()): RigSpecification {
  const rigPath = path.join(baseDir, 'assets', 'characters', 'sarue', 'rig.json');
  if (!fs.existsSync(rigPath)) {
    throw new DirectorError('CATALOG_VALIDATION_ERROR', `Arquivo rig.json não encontrado em ${rigPath}`);
  }
  const raw = fs.readFileSync(rigPath, 'utf-8');
  return JSON.parse(raw) as RigSpecification;
}

/**
 * Divide o texto do roteiro em blocos de cena preservando os índices exatos de caracteres (literalidade com acentos e emoji)
 */
export function parseScriptScenes(scriptText: string): ParsedSceneBlock[] {
  if (!scriptText || scriptText.trim().length === 0) {
    return [];
  }

  const rawParagraphs = scriptText.split(/\r?\n\s*\r?\n/);
  const scenes: ParsedSceneBlock[] = [];
  let currentSearchPos = 0;
  let index = 1;

  for (const para of rawParagraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;
    const startChar = scriptText.indexOf(trimmed, currentSearchPos);
    if (startChar === -1) continue;
    const endChar = startChar + trimmed.length;
    currentSearchPos = endChar;

    scenes.push({
      sceneId: `scene-${index}`,
      text: trimmed,
      startChar,
      endChar,
    });
    index++;
  }

  return scenes;
}

/**
 * Valida o plano de cenas contra o catálogo do Rig e a literalidade do texto
 */
export function validatePlanAgainstCatalog(
  plan: ScenePlan,
  scriptText: string,
  rig: RigSpecification,
  options: { strictAnchors?: boolean } = {}
): void {
  const allowedActions = new Set(rig.supportedActions);
  const allowedProps = new Set(rig.supportedProps);
  const allowedSets = new Set(rig.supportedSets);
  const allowedCameras = new Set(['medium', 'close', 'wide']);

  for (const scene of plan.scenes) {
    if (scene.startChar < 0 || scene.endChar > scriptText.length || scene.startChar >= scene.endChar) {
      throw new DirectorError(
        'CATALOG_VALIDATION_ERROR',
        `Cena ${scene.sceneId} possui fatias de caracteres inválidas: [${scene.startChar}, ${scene.endChar}] no texto de tamanho ${scriptText.length}`
      );
    }

    const sceneText = scriptText.slice(scene.startChar, scene.endChar);

    for (const shot of scene.shots) {
      if (!allowedSets.has(shot.setId)) {
        throw new DirectorError(
          'CATALOG_VALIDATION_ERROR',
          `Cenário '${shot.setId}' no shot '${shot.shotId}' não existe no catálogo (${rig.supportedSets.join(', ')})`
        );
      }

      if (!allowedCameras.has(shot.camera)) {
        throw new DirectorError(
          'CATALOG_VALIDATION_ERROR',
          `Câmera '${shot.camera}' no shot '${shot.shotId}' não suportada`
        );
      }

      for (const cue of shot.actions) {
        if (!allowedActions.has(cue.actionId)) {
          throw new DirectorError(
            'CATALOG_VALIDATION_ERROR',
            `Ação '${cue.actionId}' não existe no catálogo de ações permitidas (${rig.supportedActions.join(', ')})`
          );
        }

        if (cue.target && !allowedProps.has(cue.target)) {
          throw new DirectorError(
            'CATALOG_VALIDATION_ERROR',
            `Objeto alvo '${cue.target}' não existe no catálogo de props permitidos (${rig.supportedProps.join(', ')})`
          );
        }

        // Validação de âncora de texto (deve estar dentro da fatia da fala)
        if (cue.anchorText) {
          if (!sceneText.includes(cue.anchorText)) {
            if (options.strictAnchors) {
              throw new DirectorError(
                'CATALOG_VALIDATION_ERROR',
                `Âncora de texto "${cue.anchorText}" não encontrada na fala da cena ${scene.sceneId}: "${sceneText}"`
              );
            }
          }
        }
      }
    }
  }
}

/**
 * Storyboard Local Inteligente e Determinístico (Funciona 100% offline ou quando o provedor remoto não estiver disponível)
 */
export function generateDeterministicStoryboard(
  scriptText: string,
  rig: RigSpecification,
  revisionId?: string
): ScenePlan {
  const blocks = parseScriptScenes(scriptText);
  const revId = revisionId || `rev-${crypto.createHash('sha256').update(scriptText).digest('hex').slice(0, 10)}`;

  const scenes: ScenePlanItem[] = blocks.map((block, idx) => {
    const textLower = block.text.toLowerCase();
    const shots: Shot[] = [];

    // Heurísticas semânticas para relacionar as ações à fala
    if (textLower.includes('sofá') || textLower.includes('descansar') || textLower.includes('sentado')) {
      // Cena de descanso / cansaço no sofá
      shots.push({
        shotId: `shot-${idx + 1}-1`,
        setId: 'living_room_sofa',
        camera: 'medium',
        actions: [
          { actionId: 'tired', startFrame: 0, durationFrames: 96 },
        ],
      });
      // Se tiver mais de uma frase, faz corte para close ou olhar mesa
      if (block.text.includes('.')) {
        shots.push({
          shotId: `shot-${idx + 1}-2`,
          setId: 'living_room_sofa',
          camera: 'close',
          actions: [
            { actionId: 'look_desk', startFrame: 0, durationFrames: 72 },
          ],
        });
      }
    } else if (textLower.includes('celular') || textLower.includes('mensagem') || textLower.includes('olhar a hora')) {
      if (textLower.includes('longe do sofá') || textLower.includes('guardar') || textLower.includes('largo')) {
        shots.push({
          shotId: `shot-${idx + 1}-1`,
          setId: 'living_room_sofa',
          camera: 'medium',
          actions: [
            { actionId: 'store_phone', target: 'phone', startFrame: 0, durationFrames: 72 },
          ],
        });
      } else {
        // Pega o celular
        shots.push({
          shotId: `shot-${idx + 1}-1`,
          setId: 'studio',
          camera: 'medium',
          actions: [
            { actionId: 'pick_up_phone', target: 'phone', startFrame: 0, durationFrames: 72 },
          ],
        });
        shots.push({
          shotId: `shot-${idx + 1}-2`,
          setId: 'studio',
          camera: 'close',
          actions: [
            { actionId: 'idle', target: 'phone', startFrame: 0, durationFrames: 96 },
          ],
        });
      }
    } else if (textLower.includes('cronômetro') || textLower.includes('fiscalizar') || textLower.includes('minutos')) {
      shots.push({
        shotId: `shot-${idx + 1}-1`,
        setId: 'studio',
        camera: 'medium',
        actions: [
          { actionId: 'show_prop', target: 'timer', anchorText: 'cronômetro', startFrame: 0, durationFrames: 72 },
        ],
      });
      shots.push({
        shotId: `shot-${idx + 1}-2`,
        setId: 'studio',
        camera: 'close',
        actions: [
          { actionId: 'raise_brow', startFrame: 0, durationFrames: 72 },
        ],
      });
    } else if (textLower.includes('caderno') || textLower.includes('treino') || textLower.includes('terça-feira')) {
      shots.push({
        shotId: `shot-${idx + 1}-1`,
        setId: 'studio',
        camera: 'medium',
        actions: [
          { actionId: 'point', target: 'notebook', startFrame: 0, durationFrames: 80 },
        ],
      });
    } else if (textLower.includes('jogo') || textLower.includes('amigo') || textLower.includes('quadra')) {
      shots.push({
        shotId: `shot-${idx + 1}-1`,
        setId: 'sports_court',
        camera: 'wide',
        actions: [
          { actionId: 'relax', startFrame: 0, durationFrames: 80 },
        ],
      });
    } else {
      // Plano padrão com alternância rítmica
      const camera = idx % 2 === 0 ? 'medium' : 'close';
      const actionId = idx % 3 === 0 ? 'point' : idx % 3 === 1 ? 'raise_brow' : 'relax';
      shots.push({
        shotId: `shot-${idx + 1}-1`,
        setId: 'studio',
        camera,
        actions: [
          { actionId, startFrame: 0, durationFrames: 72 },
        ],
      });
    }

    return {
      sceneId: block.sceneId,
      startChar: block.startChar,
      endChar: block.endChar,
      shots,
    };
  });

  return {
    schemaVersion: '1.0',
    scriptRevisionId: revId,
    rigVersion: rig.version,
    scenes,
  };
}

/**
 * Executa chamada ao provedor Gemini REST API
 */
async function callGeminiDirectorApi(
  scriptText: string,
  blocks: ParsedSceneBlock[],
  rig: RigSpecification,
  apiKey: string,
  model = 'gemini-1.5-flash',
  repairErrorPrompt?: string
): Promise<string> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const systemInstructions = `Você é o Diretor de Cena da Fábrica de Bermudas 2.0.
Seu objetivo é transformar as falas de cada cena do roteiro em um plano de direção visual (shots e actions) coerente, sem jamais alterar o texto das falas.

CATÁLOGO RIG DISPONÍVEL:
- Ações: ${JSON.stringify(rig.supportedActions)}
- Objetos (props): ${JSON.stringify(rig.supportedProps)}
- Cenários (sets): ${JSON.stringify(rig.supportedSets)}
- Câmeras: ["medium", "close", "wide"]

REGRAS:
1. Responda ESTRITAMENTE em formato JSON que obedeça ao esquema:
{
  "schemaVersion": "1.0",
  "scriptRevisionId": "rev-auto",
  "rigVersion": "${rig.version}",
  "scenes": [
    {
      "sceneId": string,
      "startChar": number,
      "endChar": number,
      "shots": [
        {
          "shotId": string,
          "setId": string,
          "camera": "medium" | "close" | "wide",
          "actions": [
            { "actionId": string, "target": string (opcional), "anchorText": string (opcional) }
          ]
        }
      ]
    }
  ]
}
2. O startChar e endChar de cada cena DEVEM corresponder exatamente aos índices fornecidos.
3. Não use ações, props ou cenários que não estejam no catálogo.`;

  const scenesInfo = blocks.map((b) => ({
    sceneId: b.sceneId,
    text: b.text,
    startChar: b.startChar,
    endChar: b.endChar,
  }));

  let userPrompt = `Roteiro por cenas:\n${JSON.stringify(scenesInfo, null, 2)}`;
  if (repairErrorPrompt) {
    userPrompt += `\n\nATENÇÃO: Sua resposta anterior teve erro de validação. Corrija o plano para obedecer rigorosamente ao schema e ao catálogo: ${repairErrorPrompt}`;
  }

  const payload = {
    contents: [
      {
        role: 'user',
        parts: [{ text: `${systemInstructions}\n\n${userPrompt}` }],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: 'application/json',
    },
  };

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new DirectorError('AUTH_FAILED', `Autenticação rejeitada pelo Gemini (HTTP ${response.status})`);
    }
    const errText = await response.text();
    throw new DirectorError('NETWORK_ERROR', `Falha na requisição ao Gemini (HTTP ${response.status}): ${errText}`);
  }

  const json = await response.json();
  const textContent = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textContent) {
    throw new DirectorError('INVALID_PROVIDER_RESPONSE', 'Gemini retornou resposta vazia');
  }

  return textContent;
}

/**
 * Função principal de planejamento de cenas:
 * - Valida catálogo
 * - Preserva literalidade do texto
 * - Conecta provedor (Gemini/Mock)
 * - Realiza até 1 tentativa de reparo
 * - Retorna storyboard local se configurado como fallback
 */
export async function planScenes(
  scriptText: string,
  rig: RigSpecification,
  options: PlanOptions = {}
): Promise<ScenePlan> {
  const baseDir = options.baseDir || process.cwd();
  const serverConfig = loadServerConfig(baseDir);

  const provider = options.provider && options.provider !== 'auto'
    ? options.provider
    : serverConfig.director.provider;

  const apiKey = options.apiKey !== undefined
    ? options.apiKey
    : serverConfig.director.apiKey;
  const model = options.model || serverConfig.director.model || 'gemini-1.5-flash';
  const allowRepair = options.allowRepair !== false;
  const fallbackToLocal = options.fallbackToLocalStoryboard !== false;

  const blocks = parseScriptScenes(scriptText);
  if (blocks.length === 0) {
    throw new DirectorError('INVALID_PROVIDER_RESPONSE', 'Roteiro vazio ou sem cenas válidas');
  }

  // 1. Provedor Mock Local
  if (provider === 'mock' || provider === 'local_mock') {
    const plan = generateDeterministicStoryboard(scriptText, rig, options.scriptRevisionId);
    validatePlanAgainstCatalog(plan, scriptText, rig);
    return plan;
  }

  // 2. Provedor Gemini
  if (provider === 'gemini') {
    if (!apiKey || apiKey.trim().length === 0) {
      if (fallbackToLocal) {
        return generateDeterministicStoryboard(scriptText, rig, options.scriptRevisionId);
      }
      throw new DirectorError('CONFIG_MISSING', 'Provedor Gemini selecionado, mas nenhuma chave de API configurada.');
    }

    try {
      // Primeira tentativa de geração
      let rawResponse = await callGeminiDirectorApi(scriptText, blocks, rig, apiKey, model);
      let parsedJson: unknown;

      try {
        parsedJson = JSON.parse(rawResponse);
      } catch (parseErr) {
        if (allowRepair) {
          rawResponse = await callGeminiDirectorApi(
            scriptText,
            blocks,
            rig,
            apiKey,
            model,
            `JSON inválido retornado: ${String(parseErr)}`
          );
          parsedJson = JSON.parse(rawResponse);
        } else {
          throw parseErr;
        }
      }

      // Validação Zod e Catálogo
      let plan: ScenePlan;
      try {
        plan = ScenePlanSchema.parse(parsedJson);
        validatePlanAgainstCatalog(plan, scriptText, rig);
      } catch (validationErr) {
        if (allowRepair) {
          const errMsg = validationErr instanceof Error ? validationErr.message : String(validationErr);
          const repairedResponse = await callGeminiDirectorApi(
            scriptText,
            blocks,
            rig,
            apiKey,
            model,
            `Erro de validação de catálogo ou schema: ${errMsg}`
          );
          plan = ScenePlanSchema.parse(JSON.parse(repairedResponse));
          validatePlanAgainstCatalog(plan, scriptText, rig);
        } else {
          throw validationErr;
        }
      }

      return plan;
    } catch (err) {
      if (err instanceof DirectorError && err.code === 'AUTH_FAILED') {
        throw err; // Autenticação rejeitada não deve ser mascarada como sucesso silencioso
      }

      if (fallbackToLocal) {
        return generateDeterministicStoryboard(scriptText, rig, options.scriptRevisionId);
      }
      throw err;
    }
  }

  // 3. Provedor Desconhecido ou Ausente
  if (fallbackToLocal) {
    return generateDeterministicStoryboard(scriptText, rig, options.scriptRevisionId);
  }
  throw new DirectorError('CONFIG_MISSING', `Provedor de direção '${provider}' não suportado ou sem credenciais.`);
}
