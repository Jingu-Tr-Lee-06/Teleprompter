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

  // 발표 시작부터 실제로 흐른 초시계 & 문장별 실제 소요 시간(ms) 기록
  const [realElapsedMs, setRealElapsedMs] = useState(0);
  const [lineActualDurationsMs, setLineActualDurationsMs] = useState<Record<number, number>>({});
  const [isClockRunning, setIsClockRunning] = useState(false);

  const lastFrameTimeRef = useRef<number | null>(null);
  const lastClockTimeRef = useRef<number | null>(null);
  const currentLineElapsedRef = useRef<number>(0);
  const currentIndexRef = useRef<number>(0);
  const rafIdRef = useRef<number | null>(null);
  const clockRafIdRef = useRef<number | null>(null);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  const reset = useCallback(() => {
    setIsPlaying(false);
    setIsClockRunning(false);
    setCurrentIndex(0);
    currentIndexRef.current = 0;
    setLineProgress(0);
    setElapsedTotalMs(0);
    setRealElapsedMs(0);
    setLineActualDurationsMs({});
    currentLineElapsedRef.current = 0;
    lastFrameTimeRef.current = null;
    lastClockTimeRef.current = null;
  }, []);

  const jumpToLine = useCallback(
    (targetIndex: number) => {
      if (flatLines.length === 0) return;
      const clamped = Math.max(0, Math.min(targetIndex, flatLines.length - 1));
      setCurrentIndex(clamped);
      currentIndexRef.current = clamped;
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

  const jumpToNextLine = useCallback(() => {
    if (flatLines.length === 0) return;
    jumpToLine(currentIndex + 1);
  }, [flatLines.length, currentIndex, jumpToLine]);

  const jumpToPrevLine = useCallback(() => {
    if (flatLines.length === 0) return;
    if (currentLineElapsedRef.current > 1000) {
      jumpToLine(currentIndex);
      return;
    }
    jumpToLine(currentIndex - 1);
  }, [flatLines.length, currentIndex, jumpToLine]);

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

  // 재생 시작 시 전체 초시계도 함께 가동
  useEffect(() => {
    if (isPlaying) {
      setIsClockRunning(true);
    }
  }, [isPlaying]);

  // 독립 초시계 루프 (슬라이드 모드에서 0초가 되어 스크롤이 멈춰도 실제 시간은 계속 측정)
  useEffect(() => {
    if (!isClockRunning || flatLines.length === 0) {
      lastClockTimeRef.current = null;
      if (clockRafIdRef.current) cancelAnimationFrame(clockRafIdRef.current);
      return;
    }

    const clockTick = (now: number) => {
      if (lastClockTimeRef.current === null) {
        lastClockTimeRef.current = now;
      }
      const deltaMs = now - lastClockTimeRef.current;
      lastClockTimeRef.current = now;

      const activeIdx = currentIndexRef.current;
      setRealElapsedMs((prev) => prev + deltaMs);
      setLineActualDurationsMs((prev) => ({
        ...prev,
        [activeIdx]: (prev[activeIdx] ?? 0) + deltaMs,
      }));

      clockRafIdRef.current = requestAnimationFrame(clockTick);
    };

    clockRafIdRef.current = requestAnimationFrame(clockTick);
    return () => {
      if (clockRafIdRef.current) cancelAnimationFrame(clockRafIdRef.current);
    };
  }, [isClockRunning, flatLines.length]);

  // 스크롤 진행 루프
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
        setIsClockRunning(false);
        return;
      }

      const targetDuration = Math.max(activeLine.durationMs, 100);
      currentLineElapsedRef.current += deltaMs;
      setElapsedTotalMs((prev) => prev + deltaMs);

      if (currentLineElapsedRef.current >= targetDuration) {
        // 슬라이드 제어 모드: 문장 끝에 도달하면 정지(초시계는 계속 흐름)
        if (controlMode === 'slide') {
          currentLineElapsedRef.current = targetDuration;
          setLineProgress(1);
          setIsPlaying(false);
          return;
        }

        const nextIdx = currentIndex + 1;
        if (nextIdx >= flatLines.length) {
          setLineProgress(1);
          setIsPlaying(false);
          setIsClockRunning(false);
          onFinish?.();
          return;
        }

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
    setIsPlaying((prev) => {
      const next = !prev;
      setIsClockRunning(next);
      return next;
    });
  }, []);

  return {
    isPlaying,
    setIsPlaying,
    togglePlay,
    currentIndex,
    lineProgress,
    elapsedTotalMs,
    realElapsedMs,
    lineActualDurationsMs,
    reset,
    jumpToLine,
    jumpToNextLine,
    jumpToPrevLine,
    jumpToNextParagraph,
    jumpToPrevParagraph,
  };
}