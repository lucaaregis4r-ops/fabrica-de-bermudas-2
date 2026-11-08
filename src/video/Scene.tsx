import React from 'react';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { SarueRig, type SarueAction, type SarueProp, type CameraPreset } from './characters/SarueRig';
import type { SceneTimeline } from '../shared/contracts';

export interface SceneProps {
  timeline: SceneTimeline;
  showCaptions?: boolean;
}

export const Scene: React.FC<SceneProps> = ({ timeline, showCaptions = true }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  // 1. Determina o plano (shot) atual com base no frame
  // No plano manual, se houver mais de um shot, distribuímos os frames proporcionalmente ou pelos âncoras
  let currentShot = timeline.shots[0];
  let camera: CameraPreset = currentShot ? currentShot.camera : 'medium';

  // Se houver dois planos (ex: troca de plano dentro da primeira cena)
  if (timeline.shots.length > 1) {
    const cutFrame = Math.round(timeline.frameCount * 0.45);
    if (frame >= cutFrame) {
      currentShot = timeline.shots[1];
      camera = currentShot.camera;
    }
  }

  // 2. Determina a ação ativa e objeto (prop)
  let activeAction: SarueAction = 'idle';
  let activeProp: SarueProp = 'none';
  let actionStartFrame = 0;

  for (const actionCue of timeline.actions) {
    const start = actionCue.startFrame ?? 0;
    const duration = actionCue.durationFrames ?? 72;
    if (frame >= start && frame < start + duration) {
      activeAction = actionCue.actionId as SarueAction;
      actionStartFrame = start;
      if (actionCue.target === 'phone') activeProp = 'phone';
      if (actionCue.target === 'timer') activeProp = 'timer';
      break;
    }
  }

  // Se nenhuma ação específica estiver ativa no momento, mantém prop se já foi pego
  if (activeAction === 'idle') {
    if (currentShot && currentShot.actions.some((a) => a.actionId === 'pick_up_phone')) {
      activeProp = 'phone';
    }
  }

  // 3. Determina o estado da boca (mouth cues)
  let mouthState: 'closed' | 'open' = 'closed';
  const currentMouthCue = timeline.mouthCues.find((m) => m.frame === frame);
  if (currentMouthCue) {
    mouthState = currentMouthCue.mouthState;
  } else {
    // Se estiver no intervalo de uma legenda, anima a boca com base no ritmo da fala
    const isSpeaking = timeline.captions.some(
      (c) => frame >= c.startFrame && frame <= c.endFrame
    );
    if (isSpeaking) {
      // Simulação de fala: boca abre e fecha a cada 4-6 quadros nas sílabas
      mouthState = frame % 6 < 3 ? 'open' : 'closed';
    }
  }

  // 4. Determina a legenda ativa (se houver)
  const activeCaption = timeline.captions.find(
    (c) => frame >= c.startFrame && frame <= c.endFrame
  );

  return (
    <div
      style={{
        width,
        height,
        backgroundColor: '#090d16',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Cenário de Fundo: Estúdio Urbano com Gradiente e Iluminação de Borda */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(circle at 50% 35%, #1e293b 0%, #0f172a 60%, #020617 100%)',
        }}
      />

      {/* Iluminação de recorte (Rim light no topo) */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: '10%',
          right: '10%',
          height: '25%',
          background: 'radial-gradient(ellipse at 50% 0%, rgba(56, 189, 248, 0.15) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Camada do Personagem Saruê */}
      <div style={{ flex: 1, width: '100%', position: 'relative', zIndex: 10 }}>
        <SarueRig
          action={activeAction}
          actionStartFrame={actionStartFrame}
          prop={activeProp}
          camera={camera}
          mouthState={mouthState}
          frame={frame}
          fps={fps}
          showDesk={camera === 'medium'}
        />
      </div>

      {/* Camada de Legendas (Posicionada respeitando a margem de segurança editorial) */}
      {showCaptions && activeCaption && (
        <div
          style={{
            position: 'absolute',
            bottom: 233, // Margem de segurança inferior de 233px no 720×1280
            left: 40,    // Margem lateral de 40px
            right: 40,
            zIndex: 100,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              backgroundColor: 'rgba(2, 6, 23, 0.85)',
              padding: '16px 28px',
              borderRadius: 20,
              border: '2px solid rgba(56, 189, 248, 0.4)',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.8)',
              backdropFilter: 'blur(8px)',
              maxWidth: 620,
            }}
          >
            <span
              style={{
                fontSize: 32,
                fontWeight: 800,
                color: '#ffffff',
                lineHeight: 1.3,
                letterSpacing: '-0.01em',
                fontFamily: 'system-ui, -apple-system, sans-serif',
                textShadow: '0 2px 4px rgba(0,0,0,0.8)',
              }}
            >
              {activeCaption.text}
            </span>
          </div>
        </div>
      )}

      {/* Indicador sutil de enquadramento (plano) na prévia */}
      <div
        style={{
          position: 'absolute',
          top: 170, // Abaixo da margem superior de 167px
          right: 40,
          zIndex: 80,
          backgroundColor: 'rgba(15, 23, 42, 0.65)',
          padding: '4px 12px',
          borderRadius: 9999,
          fontSize: 14,
          color: '#94a3b8',
          fontWeight: 600,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}
      >
        {camera === 'close' ? '🔍 Close' : '🎬 Plano Médio'}
      </div>
    </div>
  );
};
