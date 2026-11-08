import fs from 'node:fs';
import path from 'node:path';
import { parse as parseToml } from 'smol-toml';
import type { LegacyConfigStatus } from '../shared/contracts.js';

export const SUPPORTED_DIRECTOR_PROVIDERS = ['gemini', 'groq', 'openai', 'openrouter', 'local_mock'] as const;
export type DirectorProvider = typeof SUPPORTED_DIRECTOR_PROVIDERS[number];

export const SUPPORTED_TTS_PROVIDERS = ['piper', 'minimax', 'elevenlabs'] as const;
export type TTSProvider = typeof SUPPORTED_TTS_PROVIDERS[number];

export interface ServerConfig {
  port: number;
  host: string;
  storageDir: string;
  projectsDir: string;
  director: {
    provider: DirectorProvider;
    model?: string;
    apiKey?: string;
  };
  tts: {
    provider: TTSProvider;
    apiKey?: string;
    groupId?: string;
  };
}

export interface LocalSettings {
  legacyConfigPath?: string;
}

const ALLOWED_SIBLING_NAMES = ['geradordevideos', 'fabrica de bermudas', 'fábrica de bermudas'];

/**
 * Retorna o caminho para storage/local-settings.json
 */
export function getLocalSettingsPath(baseDir = process.cwd()): string {
  return path.join(baseDir, 'storage', 'local-settings.json');
}

/**
 * Lê storage/local-settings.json de forma segura
 */
export function readLocalSettings(baseDir = process.cwd()): LocalSettings {
  const settingsPath = getLocalSettingsPath(baseDir);
  if (!fs.existsSync(settingsPath)) {
    return {};
  }
  try {
    const raw = fs.readFileSync(settingsPath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null && typeof parsed.legacyConfigPath === 'string') {
      return { legacyConfigPath: parsed.legacyConfigPath };
    }
    return {};
  } catch {
    return {};
  }
}

/**
 * Salva apenas o caminho do config legado em storage/local-settings.json (sem chaves)
 */
export function writeLocalSettings(settings: LocalSettings, baseDir = process.cwd()): void {
  const storageDir = path.join(baseDir, 'storage');
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }
  const settingsPath = getLocalSettingsPath(baseDir);
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
}

/**
 * Busca por config.toml nas pastas irmãs permitidas
 */
export function findLegacyConfigAuto(baseDir = process.cwd()): string | null {
  const parentDir = path.resolve(baseDir, '..');
  const foundPaths: string[] = [];

  for (const siblingName of ALLOWED_SIBLING_NAMES) {
    const candidateDir = path.join(parentDir, siblingName);
    const candidateFile = path.join(candidateDir, 'config.toml');
    try {
      if (fs.existsSync(candidateFile) && fs.statSync(candidateFile).isFile()) {
        foundPaths.push(candidateFile);
      }
    } catch {
      // Ignorar erros de permissão de acesso a pastas
    }
  }

  // Só usa se houver exatamente um caminho encontrado
  if (foundPaths.length === 1) {
    return foundPaths[0];
  }

  return null;
}

/**
 * Resolve o caminho do config.toml legado (link explícito tem prioridade sobre busca automática)
 */
export function resolveLegacyConfigPath(baseDir = process.cwd()): { path: string | null; source: 'linked' | 'auto_detected' | 'none' } {
  const settings = readLocalSettings(baseDir);
  if (settings.legacyConfigPath) {
    return { path: settings.legacyConfigPath, source: 'linked' };
  }

  const detected = findLegacyConfigAuto(baseDir);
  if (detected) {
    return { path: detected, source: 'auto_detected' };
  }

  return { path: null, source: 'none' };
}

interface RawAllowedLegacyConfig {
  llm_provider?: string;
  gemini_api_key?: string;
  groq_api_key?: string;
  openai_api_key?: string;
  openrouter_api_key?: string;
  gemini_model?: string;
  openai_model?: string;
  groq_model?: string;
  openrouter_model?: string;
  minimax_api_key?: string;
  minimax_group_id?: string;
  elevenlabs_api_key?: string;
}

function cleanString(val: unknown): string | undefined {
  if (typeof val === 'string') {
    const trimmed = val.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  return undefined;
}

/**
 * Lê estritamente os campos permitidos do config.toml sem expor dados brutos
 */
export function readAllowedLegacyFields(filePath: string): { data: RawAllowedLegacyConfig; error?: string } {
  try {
    if (!fs.existsSync(filePath)) {
      return { data: {}, error: 'Arquivo config.toml não encontrado no caminho indicado.' };
    }
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = parseToml(content) as Record<string, unknown>;

    const app = (parsed.app && typeof parsed.app === 'object' ? parsed.app : {}) as Record<string, unknown>;
    const minimax = (parsed.minimax_tts && typeof parsed.minimax_tts === 'object' ? parsed.minimax_tts : {}) as Record<string, unknown>;
    const elevenlabs = (parsed.elevenlabs && typeof parsed.elevenlabs === 'object' ? parsed.elevenlabs : {}) as Record<string, unknown>;

    const data: RawAllowedLegacyConfig = {
      llm_provider: cleanString(app.llm_provider),
      gemini_api_key: cleanString(app.gemini_api_key),
      groq_api_key: cleanString(app.groq_api_key),
      openai_api_key: cleanString(app.openai_api_key),
      openrouter_api_key: cleanString(app.openrouter_api_key),
      gemini_model: cleanString(app.gemini_model),
      openai_model: cleanString(app.openai_model),
      groq_model: cleanString(app.groq_model),
      openrouter_model: cleanString(app.openrouter_model),
      minimax_api_key: cleanString(minimax.api_key),
      minimax_group_id: cleanString(minimax.group_id),
      elevenlabs_api_key: cleanString(elevenlabs.api_key),
    };

    return { data };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Falha ao processar arquivo TOML';
    // Garantir que a mensagem de erro seja resumida e não exponha conteúdo sensível
    return { data: {}, error: `Erro de sintaxe no arquivo TOML legado: ${message}` };
  }
}

/**
 * Inspeciona o status da configuração legada para diagnóstico seguro (SEM EXPOR CHAVES)
 */
export function inspectLegacyConfigStatus(baseDir = process.cwd(), env = process.env): LegacyConfigStatus {
  const { path: resolvedPath, source } = resolveLegacyConfigPath(baseDir);

  if (!resolvedPath) {
    // Checar se há variáveis de ambiente da 2.0 definidas diretamente
    const envDirector = cleanString(env.DIRECTOR_PROVIDER);
    const envTts = cleanString(env.TTS_PROVIDER);
    return {
      found: false,
      source: 'none',
      resolvedPath: null,
      readable: false,
      directorProvider: envDirector || null,
      directorConfigured: Boolean(envDirector),
      directorSupported: envDirector ? (SUPPORTED_DIRECTOR_PROVIDERS as readonly string[]).includes(envDirector) : false,
      ttsProvider: envTts || 'piper',
      ttsConfigured: true, // Piper local é o padrão
      message: 'Nenhum config.toml legado encontrado nem vinculado. Piloto local disponível.',
    };
  }

  const { data, error } = readAllowedLegacyFields(resolvedPath);
  if (error) {
    return {
      found: true,
      source,
      resolvedPath,
      readable: false,
      directorProvider: null,
      directorConfigured: false,
      directorSupported: false,
      ttsProvider: null,
      ttsConfigured: false,
      message: `Arquivo legado encontrado em ${resolvedPath}, porém ilegível: ${error}`,
    };
  }

  // Precedência: variável de ambiente da 2.0 prevalece sobre legado
  const chosenDirectorRaw = cleanString(env.DIRECTOR_PROVIDER) || data.llm_provider || 'local_mock';
  const directorSupported = (SUPPORTED_DIRECTOR_PROVIDERS as readonly string[]).includes(chosenDirectorRaw);
  
  let directorConfigured = false;
  if (chosenDirectorRaw === 'gemini') {
    directorConfigured = Boolean(cleanString(env.GEMINI_API_KEY) || data.gemini_api_key);
  } else if (chosenDirectorRaw === 'groq') {
    directorConfigured = Boolean(cleanString(env.GROQ_API_KEY) || data.groq_api_key);
  } else if (chosenDirectorRaw === 'openai') {
    directorConfigured = Boolean(cleanString(env.OPENAI_API_KEY) || data.openai_api_key);
  } else if (chosenDirectorRaw === 'openrouter') {
    directorConfigured = Boolean(cleanString(env.OPENROUTER_API_KEY) || data.openrouter_api_key);
  } else if (chosenDirectorRaw === 'local_mock') {
    directorConfigured = true;
  }

  const chosenTtsRaw = cleanString(env.TTS_PROVIDER) || 'piper';
  let ttsConfigured = false;
  if (chosenTtsRaw === 'piper') {
    ttsConfigured = true;
  } else if (chosenTtsRaw === 'minimax') {
    ttsConfigured = Boolean(cleanString(env.MINIMAX_API_KEY) || data.minimax_api_key);
  } else if (chosenTtsRaw === 'elevenlabs') {
    ttsConfigured = Boolean(cleanString(env.ELEVENLABS_API_KEY) || data.elevenlabs_api_key);
  }

  return {
    found: true,
    source,
    resolvedPath,
    readable: true,
    directorProvider: chosenDirectorRaw,
    directorConfigured,
    directorSupported,
    ttsProvider: chosenTtsRaw,
    ttsConfigured,
    message: `Configuração legada lida com sucesso (${source === 'linked' ? 'vínculo explícito' : 'detecção automática'}).`,
  };
}

/**
 * Constrói a configuração efetiva do servidor em memória. NUNCA EXPÕE AS CHAVES EM LOGS OU NO CLIENTE.
 */
export function loadServerConfig(baseDir = process.cwd(), env = process.env): ServerConfig {
  const { path: resolvedPath } = resolveLegacyConfigPath(baseDir);
  const legacyData = resolvedPath ? readAllowedLegacyFields(resolvedPath).data : {};

  // Diretor
  const directorProviderRaw = cleanString(env.DIRECTOR_PROVIDER) || legacyData.llm_provider || 'local_mock';
  const directorProvider = (SUPPORTED_DIRECTOR_PROVIDERS as readonly string[]).includes(directorProviderRaw)
    ? (directorProviderRaw as DirectorProvider)
    : 'local_mock';

  let apiKey: string | undefined;
  let model: string | undefined = cleanString(env.DIRECTOR_MODEL);

  if (directorProvider === 'gemini') {
    apiKey = cleanString(env.GEMINI_API_KEY) || legacyData.gemini_api_key;
    model = model || legacyData.gemini_model || 'gemini-1.5-flash';
  } else if (directorProvider === 'groq') {
    apiKey = cleanString(env.GROQ_API_KEY) || legacyData.groq_api_key;
    model = model || legacyData.groq_model || 'llama-3.3-70b-versatile';
  } else if (directorProvider === 'openai') {
    apiKey = cleanString(env.OPENAI_API_KEY) || legacyData.openai_api_key;
    model = model || legacyData.openai_model || 'gpt-4o-mini';
  } else if (directorProvider === 'openrouter') {
    apiKey = cleanString(env.OPENROUTER_API_KEY) || legacyData.openrouter_api_key;
    model = model || legacyData.openrouter_model;
  }

  // TTS
  const ttsProviderRaw = cleanString(env.TTS_PROVIDER) || 'piper';
  const ttsProvider = (SUPPORTED_TTS_PROVIDERS as readonly string[]).includes(ttsProviderRaw)
    ? (ttsProviderRaw as TTSProvider)
    : 'piper';

  let ttsApiKey: string | undefined;
  let ttsGroupId: string | undefined;

  if (ttsProvider === 'minimax') {
    ttsApiKey = cleanString(env.MINIMAX_API_KEY) || legacyData.minimax_api_key;
    ttsGroupId = legacyData.minimax_group_id;
  } else if (ttsProvider === 'elevenlabs') {
    ttsApiKey = cleanString(env.ELEVENLABS_API_KEY) || legacyData.elevenlabs_api_key;
  }

  const storageDir = path.join(baseDir, 'storage');
  const projectsDir = path.join(storageDir, 'projects');

  // Garantir diretórios de storage existentes
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }
  if (!fs.existsSync(projectsDir)) {
    fs.mkdirSync(projectsDir, { recursive: true });
  }

  return {
    port: env.PORT ? parseInt(env.PORT, 10) : 3000,
    host: env.HOST || '127.0.0.1',
    storageDir,
    projectsDir,
    director: {
      provider: directorProvider,
      model,
      apiKey,
    },
    tts: {
      provider: ttsProvider,
      apiKey: ttsApiKey,
      groupId: ttsGroupId,
    },
  };
}
