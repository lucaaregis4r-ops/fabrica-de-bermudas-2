import React from 'react';
import { Composition } from 'remotion';
import { DiagnosticCard } from './DiagnosticCard';
import { PilotDemo } from './PilotDemo';
import { EpisodeDemo } from './EpisodeDemo';

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Composição de Diagnóstico (Sprint 1 - 2 segundos / 48 quadros) */}
      <Composition
        id="DiagnosticCard"
        component={DiagnosticCard}
        durationInFrames={48}
        fps={24}
        width={720}
        height={1280}
        defaultProps={{
          title: 'Fábrica de Bermudas 2.0',
          subtitle: 'Sprint 1: Fundação & Diagnóstico',
          version: 'v0.1.0',
        }}
      />

      {/* Composição do Piloto do Saruê (Sprint 2 - 16 segundos / 384 quadros) */}
      <Composition
        id="PilotDemo"
        component={PilotDemo}
        durationInFrames={384}
        fps={24}
        width={720}
        height={1280}
        defaultProps={{
          audioPath: undefined,
        }}
      />

      {/* Composição do Episódio Completo do Saruê (Sprint 5 - 60 a 90 segundos) */}
      <Composition
        id="EpisodeDemo"
        component={EpisodeDemo}
        durationInFrames={1440}
        fps={24}
        width={720}
        height={1280}
        calculateMetadata={({ props }) => {
          if (props && Array.isArray((props as any).scenes) && (props as any).scenes.length > 0) {
            const total = (props as any).scenes.reduce(
              (acc: number, s: any) => acc + (s.frameCount || 120),
              0
            );
            return { durationInFrames: Math.max(24, total) };
          }
          return { durationInFrames: 1440 };
        }}
        defaultProps={{
          scenes: [],
        }}
      />
    </>
  );
};
