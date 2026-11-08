import React from 'react';
import { Composition } from 'remotion';
import { DiagnosticCard } from './DiagnosticCard';
import { PilotDemo } from './PilotDemo';

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
    </>
  );
};
