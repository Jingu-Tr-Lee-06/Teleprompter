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
  const [lineProgress, setLineProgress] = useState(0);
  const [elapsedTotalMs, setElapsedTotalMs] = useState(0);

  const lastFrameTimeRef = useRef<number | null>(null);
  const currentLineElapsedRef = useRef<number>(0);
  const rafIdRef = useRef<number | null>(null);

  const reset = useCallback(() => {
    setIsPlaying(false);
    setCurrentIndex(0);
    setLineProgress(0);
    setElapsedTotalMs(0);
    currentLineElapsedRef.current = 0;
    lastFrameTimeRef.current = null;
  }, []);

  const jumpToLine = useCallback(
    (targetIndex: number) => {
      if (flatLines.length === 0) return;
      const clamped = Math.max(0, Math.min(targetIndex, flatLines.length - 1));
      setCurrentIndex(clamped);
      setLineProgress(0);
      currentLineElapsedRef.current = 0;
      lastFrameTimeRef.current = performance.now();

      const precedingMs = flatLines
        .slice(0, clamped)
        .reduce((sum, l) => sum + l.durationMs, 0);
      setElapsedTotalMs(precedingMs);
    },
    [flatLines]
  );

  // 다음 문장(줄)으로 이동
  const jumpToNextLine = useCallback(() => {
    if (flatLines.length === 0) return;
    jumpToLine(currentIndex + 1);
  }, [flatLines.length, currentIndex, jumpToLine]);

  // 이전 문장(줄)으로 이동 (현재 문장을 1초 이상 읽었으면 현재 문장 처음으로, 아니면 직전 문장으로)
  const jumpToPrevLine = useCallback(() => {
    if (flatLines.length === 0) return;
    if (currentLineElapsedRef.current > 1000) {
      jumpToLine(currentIndex);
      return;
    }
    jumpToLine(currentIndex - 1);
  }, [flatLines.length, currentIndex, jumpToLine]);

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

  // 이전 문단 첫 줄로 이동
  const jumpToPrevParagraph = useCallback(() => {
    if (flatLines.length === 0) return;
    const currentLine = flatLines[currentIndex];
    if (!currentLine) return;

    if (currentLine.lineIndexInParagraph > 0 || currentLineElapsedRef.current > 1000) {
      const currentParaStart = flatLines.findIndex(
        (l) => l.paragraphIndex === currentLine.paragraphIndex
      );
      jumpToLine(currentParaStart !== -1 ? currentParaStart : 0);
      return;
    }

    const prevParaIdx = Math.max(0, currentLine.paragraphIndex - 1);
    const prevParaStart = flatLines.findIndex((l) => l.paragraphIndex === prevParaIdx);
    jumpToLine(prevParaStart !== -1 ? prevParaStart : 0);
  }, [flatLines, currentIndex, jumpToLine]);

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
        const nextIdx = currentIndex + 1;
        if (nextIdx >= flatLines.length) {
          setLineProgress(1);
          setIsPlaying(false);
          onFinish?.();
          return;
        }

        // 슬라이드 제어 모드: 한 문장(줄) 시간이 다 되면 다음 문장 위치에 맞춰 대기
        if (controlMode === 'slide') {
          setCurrentIndex(nextIdx);
          setLineProgress(0);
          currentLineElapsedRef.current = 0;
          setIsPlaying(false);
          return;
        }

        // 연속 스크롤 모드: 자연스럽게 다음 줄로 이어서 스크롤
        const overflowMs = currentLineElapsedRef.current - targetDuration;
        setCurrentIndex(nextIdx);
        currentLineElapsedRef.current = overflowMs;
        setLineProgress(
          Math.min(overflowMs / Math.max(flatLines[nextIdx].durationMs, 100), 1)
        );
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
    jumpToNextLine,
    jumpToPrevLine,
    jumpToNextParagraph,
    jumpToPrevParagraph,
  };
}