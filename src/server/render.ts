import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';

export interface VideoInspection {
  filePath: string;
  width: number;
  height: number;
  codec: string;
  fps: number;
  durationSeconds: number;
  frameCount: number;
  fileSizeBytes: number;
}

/**
 * Inspeciona arquivo de vídeo usando ffprobe com lista de argumentos (seguro contra caminhos com espaços e acentos)
 */
export function inspectVideoWithFfprobe(videoPath: string): VideoInspection {
  if (!fs.existsSync(videoPath)) {
    throw new Error(`Arquivo não encontrado para inspeção ffprobe: ${videoPath}`);
  }

  const stat = fs.statSync(videoPath);
  const args = [
    '-v',
    'error',
    '-select_streams',
    'v:0',
    '-show_entries',
    'stream=width,height,codec_name,r_frame_rate,duration,nb_frames:format=duration',
    '-of',
    'json',
    videoPath,
  ];

  const stdout = execFileSync('ffprobe', args, { encoding: 'utf-8' });
  const data = JSON.parse(stdout);

  const stream = data.streams && data.streams[0] ? data.streams[0] : null;
  const format = data.format || {};

  if (!stream) {
    throw new Error(`Nenhum fluxo de vídeo encontrado pelo ffprobe em: ${videoPath}`);
  }

  let fps = 24;
  if (stream.r_frame_rate) {
    const parts = stream.r_frame_rate.split('/');
    if (parts.length === 2 && Number(parts[1]) > 0) {
      fps = Math.round(Number(parts[0]) / Number(parts[1]));
    } else {
      fps = Number(stream.r_frame_rate);
    }
  }

  const durationStr = stream.duration || format.duration || '0';
  const durationSeconds = parseFloat(durationStr);
  const frameCount = stream.nb_frames ? parseInt(stream.nb_frames, 10) : Math.round(durationSeconds * fps);

  return {
    filePath: videoPath,
    width: stream.width,
    height: stream.height,
    codec: stream.codec_name,
    fps,
    durationSeconds,
    frameCount,
    fileSizeBytes: stat.size,
  };
}

export interface RenderOptions {
  compositionId?: string;
  outputPath?: string;
  inputProps?: Record<string, unknown>;
  concurrency?: number;
  browserExecutable?: string;
}

/**
 * Renderiza uma composição Remotion em MP4
 */
export async function renderVideo(options: RenderOptions = {}): Promise<VideoInspection> {
  const {
    compositionId = 'DiagnosticCard',
    outputPath = path.join(process.cwd(), 'storage', 'diagnostics', 'diagnostic_card.mp4'),
    inputProps = {},
    concurrency = 1,
    browserExecutable = fs.existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined,
  } = options;

  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const entryPoint = path.join(process.cwd(), 'src', 'video', 'index.ts');

  // 1. Bundle Remotion
  const bundled = await bundle({
    entryPoint,
    webpackOverride: (config) => config,
  });

  const timeoutInMilliseconds = 90000;

  // 2. Select Composition
  const composition = await selectComposition({
    serveUrl: bundled,
    id: compositionId,
    inputProps,
    browserExecutable,
    timeoutInMilliseconds,
  });

  // 3. Render MP4
  await renderMedia({
    composition,
    serveUrl: bundled,
    codec: 'h264',
    outputLocation: outputPath,
    inputProps,
    concurrency,
    browserExecutable,
    timeoutInMilliseconds,
  });

  // 4. Inspecionar com ffprobe
  return inspectVideoWithFfprobe(outputPath);
}
