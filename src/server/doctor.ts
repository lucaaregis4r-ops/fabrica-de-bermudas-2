import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import type { DoctorReport, ToolCheck } from '../shared/contracts.js';
import { inspectLegacyConfigStatus } from './config.js';

function checkNode(): ToolCheck {
  const version = process.version;
  const major = parseInt(version.replace('v', '').split('.')[0], 10);
  const ok = major >= 20;
  return {
    name: 'Node.js',
    installed: true,
    version,
    path: process.execPath,
    error: ok ? undefined : `Versão do Node (${version}) é inferior ao LTS 20 recomendada.`,
    recommendation: ok ? undefined : 'Atualize o Node.js para a versão LTS recomendada (ex: v22.x).',
  };
}

function checkExecutable(cmd: string, displayName: string, installRecommendation: string): ToolCheck {
  try {
    const stdout = execSync(`${cmd} -version`, { stdio: ['pipe', 'pipe', 'ignore'], encoding: 'utf-8' });
    const firstLine = stdout.split('\n')[0].trim();
    let binPath = '';
    try {
      binPath = execSync(`which ${cmd}`, { stdio: ['pipe', 'pipe', 'ignore'], encoding: 'utf-8' }).trim();
    } catch {
      binPath = cmd;
    }
    return {
      name: displayName,
      installed: true,
      version: firstLine,
      path: binPath,
    };
  } catch {
    return {
      name: displayName,
      installed: false,
      error: `Executável '${cmd}' não encontrado no PATH.`,
      recommendation: installRecommendation,
    };
  }
}

function checkStorageWritable(baseDir = process.cwd()): ToolCheck {
  const storageDir = path.join(baseDir, 'storage');
  try {
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
    const testFile = path.join(storageDir, `.writable-test-${Date.now()}.tmp`);
    fs.writeFileSync(testFile, 'ok', 'utf-8');
    fs.unlinkSync(testFile);
    return {
      name: 'Storage Local Gravável',
      installed: true,
      path: storageDir,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      name: 'Storage Local Gravável',
      installed: false,
      error: `Não foi possível gravar na pasta de storage: ${msg}`,
      recommendation: `Verifique as permissões de gravação na pasta: ${storageDir}`,
    };
  }
}

function checkBrowser(): ToolCheck {
  const candidates = [
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    'google-chrome',
    'chromium',
    'chromium-browser',
  ];

  for (const candidate of candidates) {
    try {
      const isPath = candidate.startsWith('/');
      const whichCmd = isPath ? `test -x "${candidate}" && echo "${candidate}"` : `which ${candidate}`;
      const found = execSync(whichCmd, { stdio: ['pipe', 'pipe', 'ignore'], encoding: 'utf-8' }).trim();
      if (found) {
        return {
          name: 'Navegador para Renderização (Chromium/Chrome)',
          installed: true,
          path: found,
        };
      }
    } catch {
      // test next
    }
  }

  return {
    name: 'Navegador para Renderização (Chromium/Chrome)',
    installed: false,
    error: 'Nenhum executável do Google Chrome ou Chromium foi encontrado no sistema.',
    recommendation: 'Instale o Google Chrome ou Chromium (ex: sudo apt install chromium-browser ou google-chrome-stable).',
  };
}

export function generateDoctorReport(baseDir = process.cwd(), env = process.env): DoctorReport {
  const node = checkNode();
  const ffmpeg = checkExecutable('ffmpeg', 'FFmpeg', 'Instale o FFmpeg via apt: sudo apt install ffmpeg');
  const ffprobe = checkExecutable('ffprobe', 'ffprobe', 'Instale o ffprobe via apt: sudo apt install ffmpeg');
  const storageWritable = checkStorageWritable(baseDir);
  const browser = checkBrowser();
  const legacyConfig = inspectLegacyConfigStatus(baseDir, env);

  const allRequiredOk = Boolean(
    node.installed &&
    !node.error &&
    ffmpeg.installed &&
    ffprobe.installed &&
    storageWritable.installed &&
    browser.installed
  );

  const summary = allRequiredOk
    ? 'Ambiente local validado com sucesso para desenvolvimento e renderização.'
    : 'Existem pendências no ambiente local que requerem atenção.';

  return {
    node,
    ffmpeg,
    ffprobe,
    storageWritable,
    browser,
    legacyConfig,
    allRequiredOk,
    summary,
  };
}
