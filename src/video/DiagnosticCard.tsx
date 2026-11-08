import React from 'react';
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

export interface DiagnosticCardProps {
  title?: string;
  subtitle?: string;
  version?: string;
}

export const DiagnosticCard: React.FC<DiagnosticCardProps> = ({
  title = 'Fábrica de Bermudas 2.0',
  subtitle = 'Sprint 1: Fundação & Diagnóstico',
  version = 'v0.1.0',
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();

  const opacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: 'clamp',
  });

  const scale = interpolate(frame, [0, 20], [0.92, 1], {
    extrapolateRight: 'clamp',
  });

  const progress = interpolate(frame, [0, durationInFrames], [0, 100], {
    extrapolateRight: 'clamp',
  });

  const glow = Math.sin((frame / fps) * Math.PI * 2) * 10 + 15;

  return (
    <div
      style={{
        width,
        height,
        backgroundColor: '#0f172a',
        color: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '80px 40px',
        boxSizing: 'border-box',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        opacity,
        transform: `scale(${scale})`,
      }}
    >
      {/* Cabeçalho */}
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            display: 'inline-block',
            backgroundColor: '#3b82f6',
            color: '#ffffff',
            padding: '8px 20px',
            borderRadius: '9999px',
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            boxShadow: `0 0 ${glow}px rgba(59, 130, 246, 0.6)`,
          }}
        >
          {version}
        </div>
        <h1
          style={{
            fontSize: 56,
            fontWeight: 900,
            margin: '24px 0 8px 0',
            lineHeight: 1.1,
            color: '#ffffff',
          }}
        >
          {title}
        </h1>
        <p
          style={{
            fontSize: 28,
            color: '#94a3b8',
            margin: 0,
            fontWeight: 500,
          }}
        >
          {subtitle}
        </p>
      </div>

      {/* Cartão Central de Status */}
      <div
        style={{
          width: '100%',
          maxWidth: 600,
          backgroundColor: '#1e293b',
          borderRadius: 24,
          padding: 36,
          boxSizing: 'border-box',
          border: '1px solid #334155',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
        }}
      >
        <div style={{ fontSize: 24, color: '#38bdf8', fontWeight: 600, marginBottom: 16 }}>
          ✓ Render Local com Remotion
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, fontSize: 22 }}>
          <div>
            <span style={{ color: '#64748b' }}>Resolução:</span>
            <div style={{ fontWeight: 600, color: '#f1f5f9' }}>{width} × {height}</div>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>Taxa de Quadros:</span>
            <div style={{ fontWeight: 600, color: '#f1f5f9' }}>{fps} fps</div>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>Duração:</span>
            <div style={{ fontWeight: 600, color: '#f1f5f9' }}>{(durationInFrames / fps).toFixed(1)}s (48 quadros)</div>
          </div>
          <div>
            <span style={{ color: '#64748b' }}>Quadro Atual:</span>
            <div style={{ fontWeight: 600, color: '#f1f5f9' }}>{frame + 1} / {durationInFrames}</div>
          </div>
        </div>

        {/* Barra de Progresso Animada */}
        <div
          style={{
            marginTop: 32,
            height: 12,
            backgroundColor: '#334155',
            borderRadius: 6,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progress}%`,
              backgroundColor: '#10b981',
              borderRadius: 6,
            }}
          />
        </div>
      </div>

      {/* Rodapé Informativo */}
      <div
        style={{
          fontSize: 20,
          color: '#64748b',
          textAlign: 'center',
          lineHeight: 1.5,
        }}
      >
        Fábrica Editorial • Dell Inspiron 5458 • Linux Mint
        <br />
        <span style={{ color: '#38bdf8' }}>Renderizado e verificado com ffprobe</span>
      </div>
    </div>
  );
};
