import React from 'react';
import { Sequence } from 'remotion';
import { Scene } from './Scene';
import type { SceneTimeline } from '../shared/contracts';

export interface EpisodeDemoProps {
  scenes?: SceneTimeline[];
}

export const EpisodeDemo: React.FC<EpisodeDemoProps> = ({ scenes = [] }) => {
  let accumulatedFrames = 0;

  return (
    <div style={{ flex: 1, backgroundColor: '#090d16', width: '100%', height: '100%' }}>
      {scenes.map((scene, idx) => {
        const fromFrame = accumulatedFrames;
        const duration = scene.frameCount || 120;
        accumulatedFrames += duration;

        return (
          <Sequence
            key={scene.sceneId || `scene-${idx}`}
            from={fromFrame}
            durationInFrames={duration}
          >
            <Scene timeline={scene} showCaptions={true} />
          </Sequence>
        );
      })}
    </div>
  );
};
