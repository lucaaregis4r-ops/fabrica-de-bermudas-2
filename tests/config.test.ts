import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  findLegacyConfigAuto,
  resolveLegacyConfigPath,
  readAllowedLegacyFields,
  inspectLegacyConfigStatus,
  loadServerConfig,
  writeLocalSettings,
} from '../src/server/config.js';

describe('Configuração e Herança do config.toml Legado', () => {
  let tempRoot: string;
  let workspaceDir: string;

  beforeEach(() => {
    // Cria diretório temporário para isolar os testes
    tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fábrica teste espaços '));
    workspaceDir = path.join(tempRoot, 'Fabrica 2.0');
    fs.mkdirSync(workspaceDir, { recursive: true });
  });

  afterEach(() => {
    try {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    } catch {
      // Ignorar erros de limpeza
    }
  });

  it('detecta automaticamente config.toml em pasta irmã permitida', () => {
    const siblingDir = path.join(tempRoot, 'fabrica de bermudas');
    fs.mkdirSync(siblingDir, { recursive: true });
    const configPath = path.join(siblingDir, 'config.toml');
    fs.writeFileSync(configPath, '[app]\nllm_provider = "gemini"\ngemini_api_key = "fake-key-123"', 'utf-8');

    const detected = findLegacyConfigAuto(workspaceDir);
    expect(detected).toBe(configPath);

    const resolved = resolveLegacyConfigPath(workspaceDir);
    expect(resolved.source).toBe('auto_detected');
    expect(resolved.path).toBe(configPath);
  });

  it('retorna null se houver múltiplos configs em pastas irmãs (ambiguidade exige link)', () => {
    const sibling1 = path.join(tempRoot, 'fabrica de bermudas');
    const sibling2 = path.join(tempRoot, 'geradordevideos');
    fs.mkdirSync(sibling1, { recursive: true });
    fs.mkdirSync(sibling2, { recursive: true });
    fs.writeFileSync(path.join(sibling1, 'config.toml'), '[app]\nllm_provider = "gemini"', 'utf-8');
    fs.writeFileSync(path.join(sibling2, 'config.toml'), '[app]\nllm_provider = "groq"', 'utf-8');

    const detected = findLegacyConfigAuto(workspaceDir);
    expect(detected).toBeNull();
  });

  it('dá prioridade ao vínculo explícito sobre detecção automática', () => {
    const autoSibling = path.join(tempRoot, 'fabrica de bermudas');
    fs.mkdirSync(autoSibling, { recursive: true });
    fs.writeFileSync(path.join(autoSibling, 'config.toml'), '[app]\nllm_provider = "gemini"', 'utf-8');

    const explicitCustomDir = path.join(tempRoot, 'outra pasta customizada');
    fs.mkdirSync(explicitCustomDir, { recursive: true });
    const explicitConfig = path.join(explicitCustomDir, 'config.toml');
    fs.writeFileSync(explicitConfig, '[app]\nllm_provider = "groq"', 'utf-8');

    // Registrar vínculo explícito
    writeLocalSettings({ legacyConfigPath: explicitConfig }, workspaceDir);

    const resolved = resolveLegacyConfigPath(workspaceDir);
    expect(resolved.source).toBe('linked');
    expect(resolved.path).toBe(explicitConfig);
  });

  it('dá prioridade a variáveis explícitas de ambiente da 2.0 sobre os valores legados', () => {
    const configPath = path.join(workspaceDir, 'mock.config.toml');
    fs.writeFileSync(
      configPath,
      `
[app]
llm_provider = "gemini"
gemini_api_key = "legacy-gemini-key"
groq_api_key = "legacy-groq-key"
`,
      'utf-8'
    );
    writeLocalSettings({ legacyConfigPath: configPath }, workspaceDir);

    const customEnv: NodeJS.ProcessEnv = {
      DIRECTOR_PROVIDER: 'groq',
      GROQ_API_KEY: 'env-override-groq-key',
    };

    const config = loadServerConfig(workspaceDir, customEnv);
    expect(config.director.provider).toBe('groq');
    expect(config.director.apiKey).toBe('env-override-groq-key');
  });

  it('lida com arquivo ausente de forma segura sem lançar exceções', () => {
    const nonExistent = path.join(workspaceDir, 'nao-existe.toml');
    const { data, error } = readAllowedLegacyFields(nonExistent);
    expect(data).toEqual({});
    expect(error).toBeDefined();

    writeLocalSettings({ legacyConfigPath: nonExistent }, workspaceDir);
    const status = inspectLegacyConfigStatus(workspaceDir, {});
    expect(status.found).toBe(true);
    expect(status.readable).toBe(false);
  });

  it('lida com arquivo TOML com sintaxe inválida de forma resumida e segura', () => {
    const invalidToml = path.join(workspaceDir, 'corrupto.toml');
    fs.writeFileSync(invalidToml, '[app\ninvalid toml syntax = = =', 'utf-8');
    const { data, error } = readAllowedLegacyFields(invalidToml);
    expect(data).toEqual({});
    expect(error).toContain('Erro de sintaxe no arquivo TOML legado');
  });

  it('suporta caminhos com espaços e acentos', () => {
    const spaceDir = path.join(tempRoot, 'diretório com espaços e acentuação áéíóú');
    fs.mkdirSync(spaceDir, { recursive: true });
    const targetFile = path.join(spaceDir, 'config.toml');
    fs.writeFileSync(
      targetFile,
      `
[app]
llm_provider = "openai"
openai_api_key = "fake-key-with-spaces"
`,
      'utf-8'
    );

    const { data, error } = readAllowedLegacyFields(targetFile);
    expect(error).toBeUndefined();
    expect(data.llm_provider).toBe('openai');
    expect(data.openai_api_key).toBe('fake-key-with-spaces');
  });

  it('não vaza valores de chaves secretas em diagnósticos ou arquivos de vínculo', () => {
    const secretKey = 'SECRET_SUPER_CONFIDENTIAL_KEY_12345';
    const configPath = path.join(workspaceDir, 'secret.config.toml');
    fs.writeFileSync(
      configPath,
      `
[app]
llm_provider = "gemini"
gemini_api_key = "${secretKey}"
[minimax_tts]
api_key = "${secretKey}"
`,
      'utf-8'
    );

    writeLocalSettings({ legacyConfigPath: configPath }, workspaceDir);

    // 1. Verifica arquivo local-settings.json
    const localSettingsRaw = fs.readFileSync(path.join(workspaceDir, 'storage', 'local-settings.json'), 'utf-8');
    expect(localSettingsRaw).not.toContain(secretKey);

    // 2. Verifica relatório de diagnóstico retornado ao client/doctor
    const status = inspectLegacyConfigStatus(workspaceDir, {});
    const statusJson = JSON.stringify(status);
    expect(statusJson).not.toContain(secretKey);
    expect(status.directorConfigured).toBe(true);
    expect(status.ttsConfigured).toBe(true);
  });
});
