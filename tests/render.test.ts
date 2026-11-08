import { describe, it, expect } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';
import { inspectVideoWithFfprobe } from '../src/server/render.js';

describe('Inspeção de Vídeo com ffprobe', () => {
  const diagnosticVideoPath = path.join(
    process.cwd(),
    'storage',
    'diagnostics',
    'diagnostic_card.mp4'
  );

  it('lê metadados exatos do vídeo de diagnóstico de 2 segundos', () => {
    // Se o vídeo já foi renderizado pelo script de diagnóstico
    if (fs.existsSync(diagnosticVideoPath)) {
      const inspection = inspectVideoWithFfprobe(diagnosticVideoPath);
      expect(inspection.width).toBe(720);
      expect(inspection.height).toBe(1280);
      expect(inspection.fps).toBe(24);
      expect(inspection.codec).toBe('h264');
      expect(inspection.durationSeconds).toBeCloseTo(2.0, 1);
      expect(inspection.frameCount).toBe(48);
      expect(inspection.fileSizeBytes).toBeGreaterThan(10000);
    }
  });

  it('lança erro descritivo quando o arquivo de vídeo não existe', () => {
    const fakePath = path.join(process.cwd(), 'storage', 'inexistente.mp4');
    expect(() => inspectVideoWithFfprobe(fakePath)).toThrow(/não encontrado para inspeção/);
  });
});
