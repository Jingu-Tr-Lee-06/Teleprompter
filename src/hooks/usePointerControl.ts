import { useEffect, useState } from 'react';
import { ControlMode } from '@/types/script';

interface UsePointerControlProps {
  isActive: boolean;
  controlMode: ControlMode;
  onTogglePlay: () => void;
  onStartPlay: () => void;
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
  onNextParagraph,
  onPrevParagraph,
  onAdjustFontSize,
  onExitPrompter,
}: UsePointerControlProps) {
  const [isBlackout, setIsBlackout] = useState(false);

  // 1. 발표 중 화면 절전(꺼짐) 방지 (Screen Wake Lock API)
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

  // 2. 프리젠터 리모컨 + 갤럭시탭 S펜 에어 액션(키보드/미디어 키) 바인딩
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
        onNextParagraph();
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
      onPrevParagraph();
      if (controlMode === 'slide') {
        onStartPlay();
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
        // [리모컨 다음 버튼 + S펜 에어 액션(다음 페이지 / 미디어 재생·다음트랙)]
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

        // [리모컨 이전 버튼 + S펜 에어 액션(이전 페이지 / 이전트랙)]
        case 'ArrowLeft':
        case 'PageUp':
        case 'MediaTrackPrevious': {
          e.preventDefault();
          triggerPrevAction();
          break;
        }

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

    // 3. S펜을 화면 근처에 대고(호버) 사이드 버튼을 직접 눌렀을 때 감지 (PointerEvent)
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