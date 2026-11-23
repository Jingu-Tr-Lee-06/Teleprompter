import { ParsedScriptResult, ScriptLine, ScriptParagraph } from '@/types/script';

// 대본 텍스트 내 인라인 시간 태그 파싱 정규식
// 예: 문단 시간 "{1m 30s}" 또는 "{45s}", 줄 시간 "[10s]" 또는 "[12.5s]"
const PARAGRAPH_TIME_REGEX = /^\{(?:(\d+)m\s*)?(\d+(?:\.\d+)?)s?\}\s*/i;
const LINE_TIME_REGEX = /\s*\[(?:(\d+)m\s*)?(\d+(?:\.\d+)?)s?\]$/i;

function parseTimeTagToMs(minutesStr?: string, secondsStr?: string): number {
  const mins = minutesStr ? parseFloat(minutesStr) : 0;
  const secs = secondsStr ? parseFloat(secondsStr) : 0;
  return Math.round((mins * 60 + secs) * 1000);
}

function countEffectiveChars(text: string): number {
  const stripped = text.replace(/\s+/g, '');
  return Math.max(stripped.length, 1); // 빈 줄이나 기호만 있는 줄도 최소 1가중치 부여
}

export function parseAndCalculateScript(
  rawText: string,
  totalTargetDurationSec: number,
  manualOverrides?: {
    paragraphTimes?: Record<number, number>; // paragraphIndex -> ms
    lineTimes?: Record<string, number>;      // "pIdx-lIdx" -> ms
  }
): ParsedScriptResult {
  const totalTargetMs = Math.max(totalTargetDurationSec * 1000, 1000);
  
  // 빈 줄(연속 개행)을 기준으로 문단 분리
  const rawParagraphs = rawText
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  // 1단계: 텍스트 파싱 및 수동 지정 시간 추출
  const draftParagraphs: ScriptParagraph[] = rawParagraphs.map((pText, pIdx) => {
    let cleanParagraphText = pText;
    let paragraphManualMs = manualOverrides?.paragraphTimes?.[pIdx];

    // 문단 첫머리의 {시간} 태그 확인
    const pMatch = cleanParagraphText.match(PARAGRAPH_TIME_REGEX);
    if (pMatch) {
      if (paragraphManualMs === undefined) {
        paragraphManualMs = parseTimeTagToMs(pMatch[1], pMatch[2]);
      }
      cleanParagraphText = cleanParagraphText.replace(PARAGRAPH_TIME_REGEX, '');
    }

    const rawLines = cleanParagraphText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const lines: ScriptLine[] = rawLines.map((lText, lIdx) => {
      const lineKey = `${pIdx}-${lIdx}`;
      let cleanLineText = lText;
      let lineManualMs = manualOverrides?.lineTimes?.[lineKey];

      // 줄 끝의 [시간] 태그 확인
      const lMatch = cleanLineText.match(LINE_TIME_REGEX);
      if (lMatch) {
        if (lineManualMs === undefined) {
          lineManualMs = parseTimeTagToMs(lMatch[1], lMatch[2]);
        }
        cleanLineText = cleanLineText.replace(LINE_TIME_REGEX, '');
      }

      return {
        id: lineKey,
        paragraphIndex: pIdx,
        lineIndexInParagraph: lIdx,
        text: cleanLineText,
        charCount: countEffectiveChars(cleanLineText),
        durationMs: lineManualMs ?? 0,
        manualDurationMs: lineManualMs,
      };
    });

    return {
      id: `p-${pIdx}`,
      index: pIdx,
      lines,
      manualDurationMs: paragraphManualMs,
      totalDurationMs: 0,
    };
  });

  // 2단계: 문단별 수동 지정 시간이 있는 경우, 해당 문단 내부 줄들에게 잔여 시간 배분
  let allocatedTimeMs = 0;
  let unallocatedCharCount = 0;

  draftParagraphs.forEach((para) => {
    if (para.manualDurationMs !== undefined) {
      const fixedLinesMs = para.lines.reduce(
        (sum, l) => sum + (l.manualDurationMs ?? 0),
        0
      );
      const flexibleLines = para.lines.filter((l) => l.manualDurationMs === undefined);
      const flexibleChars = flexibleLines.reduce((sum, l) => sum + l.charCount, 0);
      const remainingParaMs = Math.max(para.manualDurationMs - fixedLinesMs, 0);

      para.lines.forEach((line) => {
        if (line.manualDurationMs === undefined) {
          line.durationMs =
            flexibleChars > 0
              ? Math.round((line.charCount / flexibleChars) * remainingParaMs)
              : 0;
        }
      });

      para.totalDurationMs = para.lines.reduce((sum, l) => sum + l.durationMs, 0);
      allocatedTimeMs += para.totalDurationMs;
    } else {
      // 문단 시간이 지정되지 않은 경우, 줄별 수동 시간만 먼저 합산
      para.lines.forEach((line) => {
        if (line.manualDurationMs !== undefined) {
          allocatedTimeMs += line.manualDurationMs;
        } else {
          unallocatedCharCount += line.charCount;
        }
      });
    }
  });

  // 3단계: 전체 목표 시간에서 이미 배정된 시간을 뺀 잔여 시간을 미지정 줄들에 글자 수 비례 배분
  const remainingGlobalMs = Math.max(totalTargetMs - allocatedTimeMs, 0);

  draftParagraphs.forEach((para) => {
    if (para.manualDurationMs === undefined) {
      para.lines.forEach((line) => {
        if (line.manualDurationMs === undefined) {
          line.durationMs =
            unallocatedCharCount > 0
              ? Math.round((line.charCount / unallocatedCharCount) * remainingGlobalMs)
              : 0;
        }
      });
      para.totalDurationMs = para.lines.reduce((sum, l) => sum + l.durationMs, 0);
    }
  });

  const flatLines = draftParagraphs.flatMap((p) => p.lines);
  const totalCalculatedMs = flatLines.reduce((sum, l) => sum + l.durationMs, 0);

  return {
    paragraphs: draftParagraphs,
    flatLines,
    totalCalculatedMs,
    isOverTime: allocatedTimeMs > totalTargetMs,
  };
}