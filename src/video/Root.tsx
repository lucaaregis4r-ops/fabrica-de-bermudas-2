import React from 'react';
import { Composition } from 'remotion';
import { DiagnosticCard } from './DiagnosticCard';

export const RemotionRoot: React.FC = () => {
  return (
    <>
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
    </>
  );
};
