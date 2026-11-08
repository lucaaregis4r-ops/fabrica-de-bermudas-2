import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import type { VoiceTake, TimingMark } from '../shared/contracts.js';
import { loadServerConfig } from './config.js';

export interface VoiceProfile {
  voiceKey: string;
  provider: 'piper' | 'minimax' | 'elevenlabs' | 'mock';
  language?: string;
  modelPath?: string;
  configPath?: string;
  speed?: number;
}

export interface SynthesizeOptions {
  pronunciationMap?: Record<string, string>;
  outputDir?: string;
  forceRegenerate?: boolean;
}

export const DEFAULT_PIPER_PROFILE: VoiceProfile = {
  voiceKey: 'pt_BR-faber-medium',
  provider: 'piper',
  language: 'pt-BR',
  modelPath: path.join(process.cwd(), 'storage', 'models', 'piper', 'pt_BR-faber-medium.onnx'),
  configPath: path.join(process.cwd(), 'storage', 'models', 'piper', 'pt_BR-faber-medium.onnx.json'),
};

/**
 * Divide o texto corrido de uma cena em blocos naturais de fala (frases)
 * preservando os índices inclusivos e exclusivos no texto original
 */
export function splitIntoSentenceBlocks(text: string): Array<{ text: string; startChar: number; endChar: number }> {
  const blocks: Array<{ text: string; startChar: number; endChar: number }> = [];
  // Divide por pontuação delimitadora de frase (. ! ? \n ;) mantendo os caracteres
  const regex = /[^.!?\n;]+(?:[.!?\n;]+|$)/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    const raw = match[0];
    const trimmed = raw.trim();
    if (trimmed.length > 0) {
      const offsetInRaw = raw.indexOf(trimmed);
      const startChar = match.index + offsetInRaw;
      const endChar = startChar + trimmed.length;
      blocks.push({
        text: trimmed,
        startChar,
        endChar,
      });
    }
  }

  // Fallback caso a pontuação não produza blocos
  if (blocks.length === 0 && text.trim().length > 0) {
    const trimmed = text.trim();
    const startChar = text.indexOf(trimmed);
    blocks.push({
      text: trimmed,
      startChar,
      endChar: startChar + trimmed.length,
    });
  }

  return blocks;
}

/**
 * Aplica correções fonéticas de pronúncia para envio ao sintetizador,
 * preservando a grafia canônica para a legenda
 */
export function applyPronunciation(text: string, map?: Record<string, string>): string {
  if (!map || Object.keys(map).length === 0) {
    return text;
  }
  let result = text;
  for (const [canonical, phonetic] of Object.entries(map)) {
    // Substitui a palavra isolada
    const regex = new RegExp(`\\b${canonical}\\b`, 'gi');
    result = result.replace(regex, phonetic);
  }
  return result;
}

/**
 * Mede a duração de um arquivo de áudio com ffprobe em milissegundos
 */
export function measureAudioDurationMs(audioPath: string): number {
  if (!fs.existsSync(audioPath)) {
    throw new Error(`Arquivo de áudio não encontrado para medição: ${audioPath}`);
  }
  const stdout = execFileSync(
    'ffprobe',
    [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'json',
      audioPath,
    ],
    { encoding: 'utf-8' }
  );
  const data = JSON.parse(stdout);
  const durationSec = parseFloat(data.format?.duration || '0');
  return Math.round(durationSec * 1000);
}

/**
 * Sintetiza fala usando o Piper local via uvx
 */
export function synthesizePiper(
  spokenText: string,
  outputPath: string,
  profile: VoiceProfile
): void {
  const model = profile.modelPath || DEFAULT_PIPER_PROFILE.modelPath!;
  const config = profile.configPath || DEFAULT_PIPER_PROFILE.configPath!;

  if (!fs.existsSync(model)) {
    throw new Error(`Modelo do Piper não encontrado em: ${model}. Execute o download do modelo pt_BR-faber-medium.`);
  }

  // Invoca o Piper passando o texto via stdin com array seguro de argumentos
  execFileSync(
    'uvx',
    [
      '--from', 'piper-tts', 'piper',
      '--model', model,
      '--config', config,
      '--output_file', outputPath,
    ],
    {
      input: spokenText,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }
  );
}

/**
 * Sintetiza uma cena completa gerando blocos de frase, medindo tempos acumulados e concatenando
 */
export async function synthesize(
  sceneId: string,
  canonicalText: string,
  profile: VoiceProfile = DEFAULT_PIPER_PROFILE,
  options: SynthesizeOptions = {}
): Promise<VoiceTake> {
  const outputDir = options.outputDir || path.join(process.cwd(), 'storage', 'audio', sceneId);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Chave de cache para evitar ressíntese desnecessária
  const hashPayload = JSON.stringify({
    canonicalText,
    voiceKey: profile.voiceKey,
    pronunciation: options.pronunciationMap || {},
  });
  const cacheKey = crypto.createHash('sha256').update(hashPayload).digest('hex').slice(0, 16);
  const finalAudioPath = path.join(outputDir, `take_${cacheKey}.wav`);

  // Se já existe e não forçar, reaproveita
  if (fs.existsSync(finalAudioPath) && !options.forceRegenerate) {
    const totalMs = measureAudioDurationMs(finalAudioPath);
    const cachedMarksFile = path.join(outputDir, `take_${cacheKey}.marks.json`);
    if (fs.existsSync(cachedMarksFile)) {
      const marks = JSON.parse(fs.readFileSync(cachedMarksFile, 'utf-8')) as TimingMark[];
      return {
        sceneId,
        audioPath: finalAudioPath,
        durationMs: totalMs,
        voiceKey: profile.voiceKey,
        timingLevel: 'sentence',
        marks,
      };
    }
  }

  const blocks = splitIntoSentenceBlocks(canonicalText);
  if (blocks.length === 0) {
    throw new Error(`Texto da cena ${sceneId} está vazio ou sem conteúdo falado.`);
  }

  const partFiles: string[] = [];
  const marks: TimingMark[] = [];
  let currentMs = 0;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const partPath = path.join(outputDir, `part_${i}_${Date.now()}.wav`);
    const spokenText = applyPronunciation(block.text, options.pronunciationMap);

    if (profile.provider === 'piper') {
      synthesizePiper(spokenText, partPath, profile);
    } else if (profile.provider === 'mock') {
      // Mock determinístico para testes unitários rápidos sem dependência externa
      const durationMs = Math.max(800, block.text.length * 50);
      const durationSec = (durationMs / 1000).toFixed(2);
      execFileSync('ffmpeg', [
        '-y',
        '-f', 'lavfi',
        '-i', `sine=frequency=300:duration=${durationSec}`,
        '-c:a', 'pcm_s16le',
        partPath,
      ]);
    } else {
      throw new Error(`Provedor de voz "${profile.provider}" ainda não implementado no sprint atual.`);
    }

    const partDurationMs = measureAudioDurationMs(partPath);
    partFiles.push(partPath);

    marks.push({
      text: block.text, // Legenda canônica preservada
      startChar: block.startChar,
      endChar: block.endChar,
      startMs: currentMs,
      endMs: currentMs + partDurationMs,
    });

    currentMs += partDurationMs;
  }

  // Concatenação de todos os blocos de áudio da cena em um arquivo único
  if (partFiles.length === 1) {
    fs.copyFileSync(partFiles[0], finalAudioPath);
  } else {
    // Cria arquivo de lista para concatenação segura com ffmpeg
    const concatListPath = path.join(outputDir, `concat_${cacheKey}.txt`);
    const listContent = partFiles.map((p) => `file '${p}'`).join('\n');
    fs.writeFileSync(concatListPath, listContent, 'utf-8');

    execFileSync('ffmpeg', [
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', concatListPath,
      '-c', 'copy',
      finalAudioPath,
    ]);

    fs.unlinkSync(concatListPath);
  }

  // Remove arquivos temporários de partes
  for (const part of partFiles) {
    if (fs.existsSync(part) && part !== finalAudioPath) {
      fs.unlinkSync(part);
    }
  }

  const finalDurationMs = measureAudioDurationMs(finalAudioPath);

  // Salva marcas em cache
  const marksFile = path.join(outputDir, `take_${cacheKey}.marks.json`);
  fs.writeFileSync(marksFile, JSON.stringify(marks, null, 2), 'utf-8');

  return {
    sceneId,
    audioPath: finalAudioPath,
    durationMs: finalDurationMs,
    voiceKey: profile.voiceKey,
    timingLevel: 'sentence',
    marks,
  };
}
