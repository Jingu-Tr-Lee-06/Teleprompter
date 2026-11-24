import { useEffect, useState } from 'react';
import { ControlMode } from '@/types/script';

interface UsePointerControlProps {
  isActive: boolean;
  controlMode: ControlMode;
  onTogglePlay: () => void;
  onStartPlay: () => void;
  onNextLine: () => void;
  onPrevLine: () => void;
  onNextParagraph: () => void;
  onPrevParagraph: () => void;
  onAdjustFontSize: (deltaPx: number) => void;
  onExitPrompter: () => void;
}

export function usePointerControl({
  isActive,
  controlMode,
  onTogglePlay,
  onStartPlay,
  onNextLine,
  onPrevLine,
  onNextParagraph,
  onPrevParagraph,
  onAdjustFontSize,
  onExitPrompter,
}: UsePointerControlProps) {
  const [isBlackout, setIsBlackout] = useState(false);

  // 1. 발표 중 화면 절전(꺼짐) 방지
  useEffect(() => {
    if (!isActive) return;

    let wakeLock: WakeLockSentinel | null = null;
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await navigator.wakeLock.request('screen');
        }
      } catch {
        // 일부 브라우저 정책 예외 무시
      }
    };

    requestWakeLock();
    return () => {
      wakeLock?.release().catch(() => {});
    };
  }, [isActive]);

  // 2. 프리젠터 리모컨 + 갤럭시탭 S펜 버튼 바인딩
  useEffect(() => {
    if (!isActive) {
      setIsBlackout(false);
      return;
    }

    const triggerNextAction = () => {
      if (isBlackout) {
        setIsBlackout(false);
        return;
      }
      if (controlMode === 'slide') {
        // 슬라이드 제어 모드: 다음 문장(줄)으로 이동 후 해당 문장 카운트다운 시작
        onNextLine();
        onStartPlay();
      } else {
        onTogglePlay();
      }
    };

    const triggerPrevAction = () => {
      if (isBlackout) {
        setIsBlackout(false);
        return;
      }
      if (controlMode === 'slide') {
        onPrevLine();
        onStartPlay();
      } else {
        onPrevParagraph();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      switch (e.key) {
        // [S펜 버튼 / 리모컨 다음 버튼] -> 문장 단위로 다음 이동
        case 'ArrowRight':
        case 'PageDown':
        case ' ':
        case 'Enter':
        case 'MediaTrackNext':
        case 'MediaPlayPause': {
          e.preventDefault();
          triggerNextAction();
          break;
        }

        // [S펜 두 번 누르기 / 리모컨 이전 버튼] -> 문장 단위로 이전 이동
        case 'ArrowLeft':
        case 'PageUp':
        case 'MediaTrackPrevious': {
          e.preventDefault();
          triggerPrevAction();
          break;
        }

        // [키보드 위/아래 화살표는 문단 단위 빠른 점프 유지]
        case 'ArrowDown': {
          e.preventDefault();
          onNextParagraph();
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          onPrevParagraph();
          break;
        }

        case 'b':
        case 'B':
        case '.': {
          e.preventDefault();
          setIsBlackout((prev) => !prev);
          break;
        }

        case '+':
        case '=': {
          e.preventDefault();
          onAdjustFontSize(4);
          break;
        }
        case '-':
        case '_': {
          e.preventDefault();
          onAdjustFontSize(-4);
          break;
        }

        case 'Escape': {
          e.preventDefault();
          onExitPrompter();
          break;
        }
      }
    };

    // S펜 호버 상태 사이드 버튼 직접 클릭 감지
    const handlePointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'pen' && (e.button === 5 || e.buttons === 32)) {
        e.preventDefault();
        triggerNextAction();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('pointerdown', handlePointerDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [
    isActive,
    controlMode,
    isBlackout,
    onTogglePlay,
    onStartPlay,
    onNextLine,
    onPrevLine,
    onNextParagraph,
    onPrevParagraph,
    onAdjustFontSize,
    onExitPrompter,
  ]);

  return {
    isBlackout,
    setIsBlackout,
  };
}