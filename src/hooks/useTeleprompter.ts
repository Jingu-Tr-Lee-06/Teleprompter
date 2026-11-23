import { useState, useEffect, useRef, useCallback } from 'react';
import { ControlMode, ScriptLine } from '@/types/script';

interface UseTeleprompterProps {
  flatLines: ScriptLine[];
  controlMode: ControlMode;
  onFinish?: () => void;
}

export function useTeleprompter({
  flatLines,
  controlMode,
  onFinish,
}: UseTeleprompterProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lineProgress, setLineProgress] = useState(0); // 현재 줄 내 진행률 (0.0 ~ 1.0)
  const [elapsedTotalMs, setElapsedTotalMs] = useState(0);

  const lastFrameTimeRef = useRef<number | null>(null);
  const currentLineElapsedRef = useRef<number>(0);
  const rafIdRef = useRef<number | null>(null);

  // 대본이 변경되거나 처음부터 다시 시작할 때 초기화
  const reset = useCallback(() => {
    setIsPlaying(false);
    setCurrentIndex(0);
    setLineProgress(0);
    setElapsedTotalMs(0);
    currentLineElapsedRef.current = 0;
    lastFrameTimeRef.current = null;
  }, []);

  // 특정 줄 인덱스로 즉시 이동 (슬라이드성 제어 및 클릭 이동용)
  const jumpToLine = useCallback(
    (targetIndex: number) => {
      if (flatLines.length === 0) return;
      const clamped = Math.max(0, Math.min(targetIndex, flatLines.length - 1));
      setCurrentIndex(clamped);
      setLineProgress(0);
      currentLineElapsedRef.current = 0;
      lastFrameTimeRef.current = performance.now();

      // 이전 줄들의 합산 시간을 계산해 전체 경과 시간 동기화
      const precedingMs = flatLines
        .slice(0, clamped)
        .reduce((sum, l) => sum + l.durationMs, 0);
      setElapsedTotalMs(precedingMs);
    },
    [flatLines]
  );

  // 다음 문단 첫 줄로 이동
  const jumpToNextParagraph = useCallback(() => {
    if (flatLines.length === 0) return;
    const currentParaIdx = flatLines[currentIndex]?.paragraphIndex ?? 0;
    const nextParaLineIdx = flatLines.findIndex(
      (l, idx) => idx > currentIndex && l.paragraphIndex > currentParaIdx
    );
    if (nextParaLineIdx !== -1) {
      jumpToLine(nextParaLineIdx);
    } else {
      jumpToLine(flatLines.length - 1);
    }
  }, [flatLines, currentIndex, jumpToLine]);

  // 이전 문단 첫 줄로 이동 (현재 문단 중간이면 현재 문단 처음으로, 처음이면 이전 문단으로)
  const jumpToPrevParagraph = useCallback(() => {
    if (flatLines.length === 0) return;
    const currentLine = flatLines[currentIndex];
    if (!currentLine) return;

    // 현재 문단의 첫 줄이 아니거나, 첫 줄이라도 1초 이상 지났다면 현재 문단 처음으로 복귀
    if (currentLine.lineIndexInParagraph > 0 || currentLineElapsedRef.current > 1000) {
      const currentParaStart = flatLines.findIndex(
        (l) => l.paragraphIndex === currentLine.paragraphIndex
      );
      jumpToLine(currentParaStart !== -1 ? currentParaStart : 0);
      return;
    }

    // 이미 문단 맨 앞이라면 직전 문단 첫 줄로 이동
    const prevParaIdx = Math.max(0, currentLine.paragraphIndex - 1);
    const prevParaStart = flatLines.findIndex((l) => l.paragraphIndex === prevParaIdx);
    jumpToLine(prevParaStart !== -1 ? prevParaStart : 0);
  }, [flatLines, currentIndex, jumpToLine]);

  // requestAnimationFrame 루프
  useEffect(() => {
    if (!isPlaying || flatLines.length === 0) {
      lastFrameTimeRef.current = null;
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      return;
    }

    const tick = (now: number) => {
      if (lastFrameTimeRef.current === null) {
        lastFrameTimeRef.current = now;
      }
      const deltaMs = now - lastFrameTimeRef.current;
      lastFrameTimeRef.current = now;

      const activeLine = flatLines[currentIndex];
      if (!activeLine) {
        setIsPlaying(false);
        return;
      }

      const targetDuration = Math.max(activeLine.durationMs, 100);
      currentLineElapsedRef.current += deltaMs;
      setElapsedTotalMs((prev) => prev + deltaMs);

      if (currentLineElapsedRef.current >= targetDuration) {
        // 슬라이드 모드일 때는 문단이 바뀌는 경계에서 자동 정지하여 포인터 입력을 대기
        const nextIdx = currentIndex + 1;
        if (nextIdx >= flatLines.length) {
          setLineProgress(1);
          setIsPlaying(false);
          onFinish?.();
          return;
        }

        const isParagraphBoundary =
          flatLines[nextIdx].paragraphIndex !== activeLine.paragraphIndex;

        if (controlMode === 'slide' && isParagraphBoundary) {
          // 문단 끝에 도달하면 다음 문단 첫 줄에 맞춰 세우고 일시정지 (포인터 다음 버튼 대기)
          setCurrentIndex(nextIdx);
          setLineProgress(0);
          currentLineElapsedRef.current = 0;
          setIsPlaying(false);
          return;
        }

        // 연속 스크롤 모드이거나 같은 문단 내 줄바꿈이면 자연스럽게 다음 줄로 진행
        const overflowMs = currentLineElapsedRef.current - targetDuration;
        setCurrentIndex(nextIdx);
        currentLineElapsedRef.current = overflowMs;
        setLineProgress(Math.min(overflowMs / Math.max(flatLines[nextIdx].durationMs, 100), 1));
      } else {
        setLineProgress(currentLineElapsedRef.current / targetDuration);
      }

      rafIdRef.current = requestAnimationFrame(tick);
    };

    rafIdRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, [isPlaying, currentIndex, flatLines, controlMode, onFinish]);

  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  return {
    isPlaying,
    setIsPlaying,
    togglePlay,
    currentIndex,
    lineProgress,
    elapsedTotalMs,
    reset,
    jumpToLine,
    jumpToNextParagraph,
    jumpToPrevParagraph,
  };
}