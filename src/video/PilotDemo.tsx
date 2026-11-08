import React from 'react';
import { Series, Audio, staticFile } from 'remotion';
import { Scene } from './Scene';
import type { SceneTimeline } from '../shared/contracts';

// Cena 1 do Piloto: "Peguei o celular..." com troca de plano interna (plano médio -> close)
export const PILOT_SCENE_1_TIMELINE: SceneTimeline = {
  sceneId: 'scene-pilot-1',
  fps: 24,
  frameCount: 204, // 8.5 segundos
  shots: [
    {
      shotId: 'shot-1-1',
      setId: 'desk-studio',
      camera: 'medium',
      startAnchor: 'Peguei o celular',
      actions: [
        {
          actionId: 'pick_up_phone',
          target: 'phone',
          anchorText: 'celular',
          startFrame: 10,
          durationFrames: 70,
        },
      ],
    },
    {
      shotId: 'shot-1-2',
      setId: 'desk-studio',
      camera: 'close',
      startAnchor: 'Quando vi',
      actions: [
        {
          actionId: 'blink',
          startFrame: 110,
          durationFrames: 24,
        },
      ],
    },
  ],
  actions: [
    {
      actionId: 'pick_up_phone',
      target: 'phone',
      startFrame: 10,
      durationFrames: 75,
    },
    {
      actionId: 'blink',
      startFrame: 110,
      durationFrames: 24,
    },
  ],
  mouthCues: [],
  captions: [
    {
      startFrame: 10,
      endFrame: 86,
      text: 'Peguei o celular pra olhar a hora.',
    },
    {
      startFrame: 94,
      endFrame: 196,
      text: 'Quando vi, eu tava respondendo mensagem que podia esperar até amanhã.',
    },
  ],
};

// Cena 2 do Piloto: "Aí coloquei um cronômetro..." com exibição do prop e close na sobrancelha
export const PILOT_SCENE_2_TIMELINE: SceneTimeline = {
  sceneId: 'scene-pilot-2',
  fps: 24,
  frameCount: 180, // 7.5 segundos
  shots: [
    {
      shotId: 'shot-2-1',
      setId: 'desk-studio',
      camera: 'medium',
      startAnchor: 'Aí coloquei um cronômetro',
      actions: [
        {
          actionId: 'show_prop',
          target: 'timer',
          anchorText: 'cronômetro',
          startFrame: 10,
          durationFrames: 70,
        },
      ],
    },
    {
      shotId: 'shot-2-2',
      setId: 'desk-studio',
      camera: 'close',
      startAnchor: 'Até pra parar',
      actions: [
        {
          actionId: 'raise_brow',
          startFrame: 88,
          durationFrames: 85,
        },
      ],
    },
  ],
  actions: [
    {
      actionId: 'show_prop',
      target: 'timer',
      startFrame: 10,
      durationFrames: 70,
    },
    {
      actionId: 'raise_brow',
      startFrame: 88,
      durationFrames: 85,
    },
  ],
  mouthCues: [],
  captions: [
    {
      startFrame: 10,
      endFrame: 80,
      text: 'Aí coloquei um cronômetro de dez minutos.',
    },
    {
      startFrame: 88,
      endFrame: 172,
      text: 'Até pra parar eu inventei um jeito de me fiscalizar.',
    },
  ],
};

export interface PilotDemoProps {
  audioPath?: string;
  scene1?: SceneTimeline;
  scene2?: SceneTimeline;
}

export const PilotDemo: React.FC<PilotDemoProps> = ({
  audioPath,
  scene1 = PILOT_SCENE_1_TIMELINE,
  scene2 = PILOT_SCENE_2_TIMELINE,
}) => {
  return (
    <>
      {audioPath && <Audio src={staticFile(audioPath)} />}
      <Series>
        <Series.Sequence durationInFrames={scene1.frameCount}>
          <Scene timeline={scene1} />
        </Series.Sequence>
        <Series.Sequence durationInFrames={scene2.frameCount}>
          <Scene timeline={scene2} />
        </Series.Sequence>
      </Series>
    </>
  );
};
