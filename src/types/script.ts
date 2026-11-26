export type ControlMode = 'scroll' | 'slide';

export interface ScriptLine {
  id: string;
  paragraphIndex: number;
  lineIndexInParagraph: number;
  text: string;
  charCount: number;
  durationMs: number;
  manualDurationMs?: number;
}

export interface ScriptParagraph {
  id: string;
  index: number;
  lines: ScriptLine[];
  manualDurationMs?: number;
  totalDurationMs: number;
}

export interface PrompterConfig {
  totalTargetDurationSec: number;
  fontSizePx: number;
  lineHeight: number;
  controlMode: ControlMode;
  isMirrored: boolean;
}

export interface ParsedScriptResult {
  paragraphs: ScriptParagraph[];
  flatLines: ScriptLine[];
  totalCalculatedMs: number;
  isOverTime: boolean;
}