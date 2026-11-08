import { z } from 'zod';

// ==========================================
// 1. Contratos Base de Saúde e Diagnóstico
// ==========================================

export const HealthStatusSchema = z.object({
  status: z.literal('ok'),
  service: z.string(),
  version: z.string(),
  timestamp: z.string(),
  uptime: z.number(),
});
export type HealthStatus = z.infer<typeof HealthStatusSchema>;

export const ToolCheckSchema = z.object({
  name: z.string(),
  installed: z.boolean(),
  version: z.string().optional(),
  path: z.string().optional(),
  error: z.string().optional(),
  recommendation: z.string().optional(),
});
export type ToolCheck = z.infer<typeof ToolCheckSchema>;

export const LegacyConfigStatusSchema = z.object({
  found: z.boolean(),
  source: z.enum(['linked', 'auto_detected', 'none']),
  resolvedPath: z.string().nullable(),
  readable: z.boolean(),
  directorProvider: z.string().nullable(),
  directorConfigured: z.boolean(),
  directorSupported: z.boolean(),
  ttsProvider: z.string().nullable(),
  ttsConfigured: z.boolean(),
  message: z.string(),
});
export type LegacyConfigStatus = z.infer<typeof LegacyConfigStatusSchema>;

export const DoctorReportSchema = z.object({
  node: ToolCheckSchema,
  ffmpeg: ToolCheckSchema,
  ffprobe: ToolCheckSchema,
  storageWritable: ToolCheckSchema,
  browser: ToolCheckSchema,
  legacyConfig: LegacyConfigStatusSchema,
  allRequiredOk: z.boolean(),
  summary: z.string(),
});
export type DoctorReport = z.infer<typeof DoctorReportSchema>;

// ==========================================
// 2. Contratos Principais da Fábrica (Plan)
// ==========================================

export const ScriptRevisionSchema = z.object({
  revisionId: z.string(),
  canonicalText: z.string(),
  narrationHash: z.string(),
  characterId: z.string(),
  createdAt: z.string(),
});
export type ScriptRevision = z.infer<typeof ScriptRevisionSchema>;

export const ActionCueSchema = z.object({
  actionId: z.string(),
  target: z.string().optional(),
  anchorText: z.string().optional(),
  anchorOffset: z.number().optional(),
  startFrame: z.number().optional(),
  durationFrames: z.number().optional(),
});
export type ActionCue = z.infer<typeof ActionCueSchema>;

export const ShotSchema = z.object({
  shotId: z.string(),
  setId: z.string(),
  camera: z.enum(['medium', 'close', 'wide']),
  startAnchor: z.string().optional(),
  actions: z.array(ActionCueSchema),
});
export type Shot = z.infer<typeof ShotSchema>;

export const ScenePlanItemSchema = z.object({
  sceneId: z.string(),
  startChar: z.number().int().nonnegative(),
  endChar: z.number().int().positive(),
  shots: z.array(ShotSchema),
});
export type ScenePlanItem = z.infer<typeof ScenePlanItemSchema>;

export const ScenePlanSchema = z.object({
  schemaVersion: z.literal('1.0'),
  scriptRevisionId: z.string(),
  rigVersion: z.string(),
  scenes: z.array(ScenePlanItemSchema),
});
export type ScenePlan = z.infer<typeof ScenePlanSchema>;

export const TimingMarkSchema = z.object({
  text: z.string(),
  startChar: z.number().int().nonnegative(),
  endChar: z.number().int().positive(),
  startMs: z.number().nonnegative(),
  endMs: z.number().nonnegative(),
});
export type TimingMark = z.infer<typeof TimingMarkSchema>;

export const VoiceTakeSchema = z.object({
  sceneId: z.string(),
  audioPath: z.string(),
  durationMs: z.number().positive(),
  voiceKey: z.string(),
  timingLevel: z.enum(['word', 'sentence', 'approximate']),
  marks: z.array(TimingMarkSchema),
});
export type VoiceTake = z.infer<typeof VoiceTakeSchema>;

export const MouthCueSchema = z.object({
  frame: z.number().int().nonnegative(),
  mouthState: z.enum(['open', 'closed']),
});
export type MouthCue = z.infer<typeof MouthCueSchema>;

export const CaptionCueSchema = z.object({
  startFrame: z.number().int().nonnegative(),
  endFrame: z.number().int().positive(),
  text: z.string(),
});
export type CaptionCue = z.infer<typeof CaptionCueSchema>;

export const SceneTimelineSchema = z.object({
  sceneId: z.string(),
  fps: z.literal(24),
  frameCount: z.number().int().positive(),
  shots: z.array(ShotSchema),
  actions: z.array(ActionCueSchema),
  mouthCues: z.array(MouthCueSchema),
  captions: z.array(CaptionCueSchema),
  audioPath: z.string().optional(),
});
export type SceneTimeline = z.infer<typeof SceneTimelineSchema>;

export const ProjectRevisionSchema = z.object({
  revisionId: z.string(),
  scriptRevisionId: z.string(),
  rigVersion: z.string(),
  voiceKey: z.string(),
  scenes: z.array(SceneTimelineSchema),
  status: z.enum(['draft', 'preview_ready', 'approved', 'failed']),
  approvedRevisionId: z.string().nullable(),
});
export type ProjectRevision = z.infer<typeof ProjectRevisionSchema>;
