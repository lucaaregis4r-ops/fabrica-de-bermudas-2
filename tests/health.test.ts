import { describe, it, expect } from 'vitest';
import { createApp } from '../src/server/index.js';
import { HealthStatusSchema } from '../src/shared/contracts.js';

describe('API de Health e Diagnóstico', () => {
  it('responde com status ok em GET /api/health', async () => {
    const app = createApp();

    // Iniciar servidor em porta efêmera para teste
    const server = app.listen(0);
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Falha ao obter porta efêmera');
    }
    const port = address.port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/health`);
      expect(res.status).toBe(200);

      const json = await res.json();
      const validated = HealthStatusSchema.parse(json);
      expect(validated.status).toBe('ok');
      expect(validated.service).toBe('fabrica-de-bermudas-2');
    } finally {
      server.close();
    }
  });

  it('retorna relatório de doctor válido em GET /api/doctor', async () => {
    const app = createApp();
    const server = app.listen(0);
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Falha ao obter porta efêmera');
    }
    const port = address.port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/doctor`);
      expect(res.status).toBe(200);

      const json = (await res.json()) as { allRequiredOk: boolean; node: { installed: boolean } };
      expect(json.node.installed).toBe(true);
      expect(json.allRequiredOk).toBe(true);
    } finally {
      server.close();
    }
  });
});
