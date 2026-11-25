export type ControlMode = 'scroll' | 'slide';
export type AdvanceTrigger = 'manual' | 'voice' | 'snap' | 'voice+snap';

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
  advanceTrigger: AdvanceTrigger; // 문장 넘김 트리거 방식 선택
  isMirrored: boolean;
}

export interface ParsedScriptResult {
  paragraphs: ScriptParagraph[];
  flatLines: ScriptLine[];
  totalCalculatedMs: number;
  isOverTime: boolean;
}