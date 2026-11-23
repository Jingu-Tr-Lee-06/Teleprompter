import { useEffect, useState } from 'react';
import { ControlMode } from '@/types/script';

interface UsePointerControlProps {
  isActive: boolean; // 프롬프터 뷰가 열려 있을 때만 활성화
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
        // 배터리 절약 모드 등 일부 브라우저 정책으로 거부될 경우 무시
      }
    };

    requestWakeLock();
    return () => {
      wakeLock?.release().catch(() => {});
    };
  }, [isActive]);

  // 2. 프리젠터 리모컨 및 키보드 단축키 바인딩
  useEffect(() => {
    if (!isActive) {
      setIsBlackout(false);
      return;
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      // 입력 폼에 포커스가 있을 때는 가로채지 않음
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      switch (e.key) {
        // [리모컨 다음 버튼 / 스페이스바]
        case 'ArrowRight':
        case 'PageDown':
        case ' ': {
          e.preventDefault();
          if (isBlackout) {
            setIsBlackout(false);
            return;
          }
          if (controlMode === 'slide') {
            // 슬라이드성 제어 모드: 다음 문단(슬라이드)으로 즉시 스냅 이동 후 카운트다운 시작
            onNextParagraph();
            onStartPlay();
          } else {
            // 연속 스크롤 모드: 재생 / 일시정지 토글
            onTogglePlay();
          }
          break;
        }

        // [리모컨 이전 버튼]
        case 'ArrowLeft':
        case 'PageUp': {
          e.preventDefault();
          if (isBlackout) {
            setIsBlackout(false);
            return;
          }
          onPrevParagraph();
          if (controlMode === 'slide') {
            onStartPlay();
          }
          break;
        }

        // [스크롤 모드에서 문단 수동 점프용 상/하 화살표]
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

        // [리모컨 블랙스크린 버튼: 로지텍/MS 리모컨 표준 키 'b' 또는 '.']
        case 'b':
        case 'B':
        case '.': {
          e.preventDefault();
          setIsBlackout((prev) => !prev);
          break;
        }

        // [글자 크기 실시간 조절: + / -]
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

        // [프롬프터 종료]
        case 'Escape': {
          e.preventDefault();
          onExitPrompter();
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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