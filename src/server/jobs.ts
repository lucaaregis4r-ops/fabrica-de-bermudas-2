import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  type ScenePlan,
  type SceneTimeline,
  type VoiceTake,
  ScenePlanSchema,
  SceneTimelineSchema,
} from '../shared/contracts.js';
import { loadSarueRig, planScenes, type PlanOptions } from './director.js';
import { synthesize, DEFAULT_PIPER_PROFILE, type VoiceProfile } from './voice.js';
import { compileTimeline, generateSrt } from './timeline.js';
import { renderVideo, inspectVideoWithFfprobe } from './render.js';

export type ProjectStatus =
  | 'draft'
  | 'planning'
  | 'planned'
  | 'synthesizing'
  | 'ready'
  | 'rendering'
  | 'completed'
  | 'failed';

export interface ProjectMeta {
  projectId: string;
  title: string;
  characterId: string;
  status: ProjectStatus;
  currentRevisionId: string;
  createdAt: string;
  updatedAt: string;
  lastError?: string;
}

export interface CreateProjectOptions {
  title: string;
  scriptText: string;
  characterId?: string;
  baseDir?: string;
}

export interface JobExecutionOptions {
  targetStep?: 'plan' | 'voice' | 'all';
  planOptions?: PlanOptions;
  voiceProfile?: VoiceProfile;
  forceVoiceRegenerate?: boolean;
  baseDir?: string;
}

export interface JobExecutionResult {
  projectId: string;
  status: ProjectStatus;
  plan?: ScenePlan;
  timelines?: SceneTimeline[];
  srt?: string;
  durationSeconds?: number;
  resumedFromStep?: 'plan' | 'voice' | 'none';
}

/**
 * Retorna o diretório base do projeto em storage/projects/<projectId>
 */
export function getProjectDir(projectId: string, baseDir = process.cwd()): string {
  return path.join(baseDir, 'storage', 'projects', projectId);
}

/**
 * Cria um novo projeto e persiste a estrutura de diretórios e arquivos iniciais
 */
export function createProject(options: CreateProjectOptions): ProjectMeta {
  const baseDir = options.baseDir || process.cwd();
  const rawId = `proj-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const projectId = rawId.toLowerCase();
  const projectDir = getProjectDir(projectId, baseDir);

  fs.mkdirSync(projectDir, { recursive: true });
  fs.mkdirSync(path.join(projectDir, 'audio'), { recursive: true });
  fs.mkdirSync(path.join(projectDir, 'output'), { recursive: true });

  const scriptPath = path.join(projectDir, 'script.txt');
  fs.writeFileSync(scriptPath, options.scriptText, 'utf-8');

  const now = new Date().toISOString();
  const scriptHash = crypto.createHash('sha256').update(options.scriptText).digest('hex').slice(0, 10);
  const meta: ProjectMeta = {
    projectId,
    title: options.title,
    characterId: options.characterId || 'sarue',
    status: 'draft',
    currentRevisionId: `rev-${scriptHash}`,
    createdAt: now,
    updatedAt: now,
  };

  const metaPath = path.join(projectDir, 'meta.json');
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');

  return meta;
}

/**
 * Recupera um projeto existente e seus dados persistidos
 */
export function getProject(
  projectId: string,
  baseDir = process.cwd()
): {
  meta: ProjectMeta;
  scriptText: string;
  plan?: ScenePlan;
  timelines?: SceneTimeline[];
  srt?: string;
} {
  const projectDir = getProjectDir(projectId, baseDir);
  const metaPath = path.join(projectDir, 'meta.json');

  if (!fs.existsSync(metaPath)) {
    throw new Error(`Projeto '${projectId}' não encontrado em ${projectDir}`);
  }

  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8')) as ProjectMeta;
  const scriptPath = path.join(projectDir, 'script.txt');
  const scriptText = fs.existsSync(scriptPath) ? fs.readFileSync(scriptPath, 'utf-8') : '';

  let plan: ScenePlan | undefined;
  const planPath = path.join(projectDir, 'plan.json');
  if (fs.existsSync(planPath)) {
    try {
      plan = JSON.parse(fs.readFileSync(planPath, 'utf-8')) as ScenePlan;
    } catch {
      // Ignora erro de leitura de plano corrompido
    }
  }

  let timelines: SceneTimeline[] | undefined;
  const timelinePath = path.join(projectDir, 'timeline.json');
  if (fs.existsSync(timelinePath)) {
    try {
      timelines = JSON.parse(fs.readFileSync(timelinePath, 'utf-8')) as SceneTimeline[];
    } catch {
      // Ignora erro
    }
  }

  let srt: string | undefined;
  const srtPath = path.join(projectDir, 'subtitles.srt');
  if (fs.existsSync(srtPath)) {
    srt = fs.readFileSync(srtPath, 'utf-8');
  }

  return { meta, scriptText, plan, timelines, srt };
}

/**
 * Atualiza o plano de cena de um projeto manualmente ou via revisão
 */
export function updateProjectPlan(
  projectId: string,
  plan: ScenePlan,
  baseDir = process.cwd()
): void {
  const projectDir = getProjectDir(projectId, baseDir);
  const metaPath = path.join(projectDir, 'meta.json');
  if (!fs.existsSync(metaPath)) {
    throw new Error(`Projeto '${projectId}' não encontrado.`);
  }

  // Validação estrita do schema Zod
  const validatedPlan = ScenePlanSchema.parse(plan);
  const planPath = path.join(projectDir, 'plan.json');
  fs.writeFileSync(planPath, JSON.stringify(validatedPlan, null, 2), 'utf-8');

  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8')) as ProjectMeta;
  meta.status = 'planned';
  meta.updatedAt = new Date().toISOString();
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
}

/**
 * Concatena múltiplos arquivos WAV usando ffmpeg em formato PCM 16-bit 44.1kHz
 */
export function concatAudioFiles(inputPaths: string[], outputPath: string): void {
  if (inputPaths.length === 0) return;
  if (inputPaths.length === 1) {
    fs.copyFileSync(inputPaths[0], outputPath);
    return;
  }

  const listPath = path.join(path.dirname(outputPath), `concat_list_${Date.now()}.txt`);
  const listContent = inputPaths.map((p) => `file '${p}'`).join('\n');
  fs.writeFileSync(listPath, listContent, 'utf-8');

  try {
    execFileSync('ffmpeg', [
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', listPath,
      '-c', 'copy',
      outputPath,
    ]);
  } finally {
    if (fs.existsSync(listPath)) {
      fs.unlinkSync(listPath);
    }
  }
}

/**
 * Executa o fluxo de trabalho encadeado e retomável do projeto:
 * - Se o plano já estiver salvo, retoma sem re-planejar
 * - Se a voz já estiver sintetizada para as falas idênticas, retoma e preserva cache de áudio
 * - Salva atomicamente cada estágio concluído
 */
export async function executeProjectJob(
  projectId: string,
  options: JobExecutionOptions = {}
): Promise<JobExecutionResult> {
  const baseDir = options.baseDir || process.cwd();
  const projectDir = getProjectDir(projectId, baseDir);
  const { meta, scriptText } = getProject(projectId, baseDir);

  const metaPath = path.join(projectDir, 'meta.json');
  const planPath = path.join(projectDir, 'plan.json');
  const timelinePath = path.join(projectDir, 'timeline.json');
  const srtPath = path.join(projectDir, 'subtitles.srt');
  const projectAudioDir = path.join(projectDir, 'audio');

  let resumedFromStep: 'plan' | 'voice' | 'none' = 'none';

  // ----------------------------------------------------
  // ESTÁGIO 1: Planejamento Visual (Diretor)
  // ----------------------------------------------------
  let plan: ScenePlan;
  if (fs.existsSync(planPath)) {
    // Retomada: Plano já gerado e salvo em disco
    plan = JSON.parse(fs.readFileSync(planPath, 'utf-8')) as ScenePlan;
    resumedFromStep = 'plan';
  } else {
    // Executa planejamento com o diretor
    meta.status = 'planning';
    meta.updatedAt = new Date().toISOString();
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');

    const rig = loadSarueRig(baseDir);
    plan = await planScenes(scriptText, rig, {
      ...options.planOptions,
      baseDir,
      scriptRevisionId: meta.currentRevisionId,
    });

    fs.writeFileSync(planPath, JSON.stringify(plan, null, 2), 'utf-8');
    meta.status = 'planned';
    meta.updatedAt = new Date().toISOString();
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');
  }

  if (options.targetStep === 'plan') {
    return {
      projectId,
      status: meta.status,
      plan,
      resumedFromStep,
    };
  }

  // ----------------------------------------------------
  // ESTÁGIO 2: Síntese de Voz e Compilação da Timeline
  // ----------------------------------------------------
  meta.status = 'synthesizing';
  meta.updatedAt = new Date().toISOString();
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');

  const voiceProfile = options.voiceProfile || DEFAULT_PIPER_PROFILE;
  const voiceTakes: VoiceTake[] = [];
  const timelines: SceneTimeline[] = [];

  for (const scene of plan.scenes) {
    const sceneText = scriptText.slice(scene.startChar, scene.endChar);
    
    // synthesize() usa cache SHA-256 interno. Se o texto da fala não mudou,
    // o áudio existente é reaproveitado instantaneamente sem re-síntese!
    const take = await synthesize(sceneText, scene.sceneId, voiceProfile, {
      outputDir: projectAudioDir,
      forceRegenerate: options.forceVoiceRegenerate,
    });
    voiceTakes.push(take);

    const sceneTimeline = compileTimeline(scene, take, 24);
    timelines.push(sceneTimeline);
  }

  // Validação Zod das timelines
  for (const tl of timelines) {
    SceneTimelineSchema.parse(tl);
  }

  fs.writeFileSync(timelinePath, JSON.stringify(timelines, null, 2), 'utf-8');

  // Geração de Legendas SRT
  const srtContent = generateSrt(timelines);
  fs.writeFileSync(srtPath, srtContent, 'utf-8');

  // Concatenação do áudio master do projeto
  const allAudioPaths = voiceTakes.map((v) => v.audioPath);
  const masterAudioPath = path.join(projectAudioDir, 'master_voice.wav');
  concatAudioFiles(allAudioPaths, masterAudioPath);

  const totalDurationMs = voiceTakes.reduce((acc, v) => acc + v.durationMs, 0);
  const durationSeconds = totalDurationMs / 1000;

  meta.status = 'ready';
  meta.updatedAt = new Date().toISOString();
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');

  return {
    projectId,
    status: meta.status,
    plan,
    timelines,
    srt: srtContent,
    durationSeconds,
    resumedFromStep: resumedFromStep === 'none' ? 'none' : 'voice',
  };
}

/**
 * Lista todos os projetos salvos em storage/projects ordenados por data decrescente
 */
export function listProjects(baseDir = process.cwd()): ProjectMeta[] {
  const projectsDir = path.join(baseDir, 'storage', 'projects');
  if (!fs.existsSync(projectsDir)) {
    return [];
  }
  const entries = fs.readdirSync(projectsDir, { withFileTypes: true });
  const list: ProjectMeta[] = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const metaPath = path.join(projectsDir, entry.name, 'meta.json');
      if (fs.existsSync(metaPath)) {
        try {
          const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8')) as ProjectMeta;
          list.push(meta);
        } catch {
          // ignora projetos com meta corrompido
        }
      }
    }
  }
  return list.sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1));
}

/**
 * Aprova a revisão atual do projeto para exportação final
 */
export function approveProjectRevision(projectId: string, baseDir = process.cwd()): ProjectMeta {
  const projectDir = getProjectDir(projectId, baseDir);
  const metaPath = path.join(projectDir, 'meta.json');
  if (!fs.existsSync(metaPath)) {
    throw new Error(`Projeto '${projectId}' não encontrado.`);
  }

  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8')) as ProjectMeta;
  meta.status = 'completed';
  meta.updatedAt = new Date().toISOString();
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf-8');

  return meta;
}

/**
 * Renderiza o vídeo final do projeto com Remotion e mux de áudio AAC estéreo
 */
export async function renderProjectVideo(
  projectId: string,
  baseDir = process.cwd()
): Promise<{ filePath: string; durationSeconds: number; frameCount: number }> {
  const project = getProject(projectId, baseDir);
  if (!project.timelines || project.timelines.length === 0) {
    throw new Error('Projeto não possui timelines compiladas para renderização.');
  }

  const projectDir = getProjectDir(projectId, baseDir);
  const rawVideoPath = path.join(projectDir, 'output', 'raw.mp4');
  const finalVideoPath = path.join(projectDir, 'output', 'final.mp4');
  const masterAudioPath = path.join(projectDir, 'audio', 'master_voice.wav');

  await renderVideo({
    compositionId: 'EpisodeDemo',
    outputPath: rawVideoPath,
    inputProps: {
      scenes: project.timelines,
    },
    concurrency: 1,
  });

  if (fs.existsSync(masterAudioPath)) {
    execFileSync('ffmpeg', [
      '-y',
      '-i', rawVideoPath,
      '-i', masterAudioPath,
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-shortest',
      finalVideoPath,
    ]);
    if (fs.existsSync(rawVideoPath)) fs.unlinkSync(rawVideoPath);
  } else {
    fs.renameSync(rawVideoPath, finalVideoPath);
  }

  const inspection = inspectVideoWithFfprobe(finalVideoPath);
  return {
    filePath: finalVideoPath,
    durationSeconds: inspection.durationSeconds,
    frameCount: inspection.frameCount,
  };
}

