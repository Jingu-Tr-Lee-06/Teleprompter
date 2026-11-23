export type ControlMode = 'scroll' | 'slide'; // 연속 스크롤 모드 vs 포인터 슬라이드 제어 모드

export interface ScriptLine {
  id: string;
  paragraphIndex: number;
  lineIndexInParagraph: number;
  text: string;
  charCount: number;         // 공백 제외 글자 수 (자동 시간 배분 기준)
  durationMs: number;        // 최종 계산된 해당 줄의 재생 시간 (ms)
  manualDurationMs?: number; // 사용자가 직접 지정한 줄별 시간 (ms)
}

export interface ScriptParagraph {
  id: string;
  index: number;
  lines: ScriptLine[];
  manualDurationMs?: number; // 사용자가 직접 지정한 문단별 시간 (ms)
  totalDurationMs: number;   // 해당 문단의 최종 합산 시간 (ms)
}

export interface PrompterConfig {
  totalTargetDurationSec: number; // 목표 전체 발표 시간 (초)
  fontSizePx: number;             // 글자 크기 (px)
  lineHeight: number;             // 줄 간격 배수 (예: 1.6)
  controlMode: ControlMode;       // 포인터 제어 방식
  isMirrored: boolean;            // 하드웨어 프롬프터용 좌우 반전 여부
}

export interface ParsedScriptResult {
  paragraphs: ScriptParagraph[];
  flatLines: ScriptLine[];       // 스크롤 엔진이 순차 접근하기 위한 1차원 줄 배열
  totalCalculatedMs: number;     // 실제 배분된 총 시간 (ms)
  isOverTime: boolean;           // 수동 지정 시간 합계가 목표 전체 시간을 초과했는지 여부
}