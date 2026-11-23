'use client';

import React, { useRef, useEffect, useState, useMemo } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  X,
  Plus,
  Minus,
  FlipHorizontal2,
  ChevronLeft,
  ChevronRight,
  EyeOff,
} from 'lucide-react';
import { ParsedScriptResult, PrompterConfig } from '@/types/script';
import { useTeleprompter } from '@/hooks/useTeleprompter';
import { usePointerControl } from '@/hooks/usePointerControl';

interface PrompterViewProps {
  parsed: ParsedScriptResult;
  config: PrompterConfig;
  onUpdateConfig: (partial: Partial<PrompterConfig>) => void;
  onExit: () => void;
}

function formatClock(ms: number): string {
  const totalSec = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function PrompterView({
  parsed,
  config,
  onUpdateConfig,
  onExit,
}: PrompterViewProps) {
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [translateY, setTranslateY] = useState(0);

  const {
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
  } = useTeleprompter({
    flatLines: parsed.flatLines,
    controlMode: config.controlMode,
  });

  const { isBlackout, setIsBlackout } = usePointerControl({
    isActive: true,
    controlMode: config.controlMode,
    onTogglePlay: togglePlay,
    onStartPlay: () => setIsPlaying(true),
    onNextParagraph: jumpToNextParagraph,
    onPrevParagraph: jumpToPrevParagraph,
    onAdjustFontSize: (delta) =>
      onUpdateConfig({
        fontSizePx: Math.max(24, Math.min(120, config.fontSizePx + delta)),
      }),
    onExitPrompter: onExit,
  });

  // 현재 줄의 실제 픽셀 높이와 진행률(lineProgress)을 기반으로 Y축 이동 거리 계산
  useEffect(() => {
    const activeEl = lineRefs.current[currentIndex];
    if (!activeEl) return;

    const offsetTop = activeEl.offsetTop;
    const height = activeEl.offsetHeight;
    const smoothOffset = offsetTop + height * lineProgress;
    setTranslateY(-smoothOffset);
  }, [currentIndex, lineProgress, config.fontSizePx, parsed.flatLines]);

  const activeLine = parsed.flatLines[currentIndex];
  const remainingTotalMs = Math.max(0, parsed.totalCalculatedMs - elapsedTotalMs);

  // 현재 문장(줄)의 남은 초 (정수 올림, 숫자만 표기용)
  const currentLineRemainingSec = useMemo(() => {
    if (!activeLine) return 0;
    const remMs = activeLine.durationMs * (1 - lineProgress);
    return Math.max(0, Math.ceil(remMs / 1000));
  }, [activeLine, lineProgress]);

  // 현재 문단의 남은 시간 계산
  const currentParagraphRemainingMs = useMemo(() => {
    if (!activeLine) return 0;
    const paraLines = parsed.flatLines.filter(
      (l) => l.paragraphIndex === activeLine.paragraphIndex
    );
    const currentIdxInPara = paraLines.findIndex((l) => l.id === activeLine.id);
    const currentLineRem = activeLine.durationMs * (1 - lineProgress);
    const followingLinesRem = paraLines
      .slice(currentIdxInPara + 1)
      .reduce((sum, l) => sum + l.durationMs, 0);
    return currentLineRem + followingLinesRem;
  }, [activeLine, lineProgress, parsed.flatLines]);

  // 블랙스크린(암전) 모드 렌더링
  if (isBlackout) {
    return (
      <div
        onClick={() => setIsBlackout(false)}
        className="fixed inset-0 bg-black z-50 flex items-end justify-center pb-8 cursor-pointer select-none"
      >
        <span className="text-zinc-800 text-xs">
          블랙스크린 모드 (리모컨 버튼 또는 화면 클릭 시 복귀)
        </span>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black text-white z-50 overflow-hidden select-none flex flex-col">
      {/* 상단 HUD 컨트롤 바 */}
      <div className="relative z-30 flex items-center justify-between px-6 py-3 bg-zinc-950/90 border-b border-zinc-900 opacity-30 hover:opacity-100 transition-opacity duration-200">
        <div className="flex items-center gap-3">
          <button
            onClick={togglePlay}
            className="flex items-center gap-1.5 bg-white text-black font-bold px-3.5 py-1.5 rounded-md text-sm cursor-pointer"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            <span>{isPlaying ? '일시정지' : '재생'}</span>
          </button>

          <button
            onClick={reset}
            className="p-2 text-zinc-400 hover:text-white rounded-md cursor-pointer"
            title="처음으로"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-zinc-800 mx-1" />

          {/* 문단 이동 버튼 */}
          <button
            onClick={jumpToPrevParagraph}
            className="p-1.5 text-zinc-400 hover:text-white cursor-pointer"
            title="이전 문단 (←)"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-xs font-mono text-zinc-300">
            문단 {(activeLine?.paragraphIndex ?? 0) + 1} / {parsed.paragraphs.length}
          </span>
          <button
            onClick={jumpToNextParagraph}
            className="p-1.5 text-zinc-400 hover:text-white cursor-pointer"
            title="다음 문단 (→)"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* 중앙 타이머 디스플레이 */}
        <div className="flex items-center gap-6 font-mono">
          <div className="text-center">
            <span className="text-[10px] text-zinc-500 block">현재 문단 남은 시간</span>
            <span className="text-lg font-bold text-amber-400">
              {formatClock(currentParagraphRemainingMs)}
            </span>
          </div>
          <div className="text-center">
            <span className="text-[10px] text-zinc-500 block">전체 남은 시간</span>
            <span className="text-lg font-bold text-emerald-400">
              {formatClock(remainingTotalMs)}
            </span>
          </div>
        </div>

        {/* 우측 글자 크기 / 반전 / 암전 / 나가기 */}
        <div className="flex items-center gap-2">
          <button
            onClick={() =>
              onUpdateConfig({ fontSizePx: Math.max(24, config.fontSizePx - 4) })
            }
            className="p-1.5 bg-zinc-900 hover:bg-zinc-800 rounded text-zinc-300 cursor-pointer"
            title="글자 작게 (-)"
          >
            <Minus className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono w-10 text-center text-zinc-400">
            {config.fontSizePx}px
          </span>
          <button
            onClick={() =>
              onUpdateConfig({ fontSizePx: Math.min(120, config.fontSizePx + 4) })
            }
            className="p-1.5 bg-zinc-900 hover:bg-zinc-800 rounded text-zinc-300 cursor-pointer"
            title="글자 크게 (+)"
          >
            <Plus className="w-4 h-4" />
          </button>

          <button
            onClick={() => onUpdateConfig({ isMirrored: !config.isMirrored })}
            className={`p-2 rounded cursor-pointer ${
              config.isMirrored ? 'bg-sky-500/20 text-sky-400' : 'text-zinc-400 hover:text-white'
            }`}
            title="좌우 반전 (하프미러용)"
          >
            <FlipHorizontal2 className="w-4 h-4" />
          </button>

          <button
            onClick={() => setIsBlackout(true)}
            className="p-2 text-zinc-400 hover:text-white rounded cursor-pointer"
            title="블랙스크린 암전 (B)"
          >
            <EyeOff className="w-4 h-4" />
          </button>

          <button
            onClick={onExit}
            className="ml-2 flex items-center gap-1 bg-zinc-900 hover:bg-red-950/70 text-zinc-300 hover:text-red-300 px-3 py-1.5 rounded-md text-xs cursor-pointer"
          >
            <X className="w-4 h-4" />
            <span>에디터 (ESC)</span>
          </button>
        </div>
      </div>

      {/* 우측 상단 현재 문장 남은 초 대형 카운트다운 (숫자만 표기) */}
      <div className="pointer-events-none fixed top-20 right-10 z-25">
        <span className="text-white font-extrabold text-7xl md:text-8xl leading-none tracking-tight tabular-nums drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]">
          {currentLineRemainingSec}
        </span>
      </div>

      {/* 시선 고정 가이드라인 (화면 상단 35% 위치 기준선) */}
      <div className="pointer-events-none fixed inset-x-0 top-[35%] z-20 flex items-center justify-between px-4">
        <div className="w-3 h-3 border-t-2 border-r-2 border-emerald-500 rotate-45" />
        <div className="flex-1 border-t border-dashed border-zinc-800/80 mx-3" />
        <div className="w-3 h-3 border-t-2 border-l-2 border-emerald-500 -rotate-45" />
      </div>

      {/* 본문 스크롤 스테이지 */}
      <div
        className={`relative flex-1 w-full max-w-5xl mx-auto px-8 ${
          config.isMirrored ? 'scale-x-[-1]' : ''
        }`}
      >
        <div
          style={{
            transform: `translate3d(0, calc(35vh + ${translateY}px), 0)`,
            fontSize: `${config.fontSizePx}px`,
            lineHeight: config.lineHeight,
          }}
          className="will-change-transform transition-none"
        >
          {parsed.flatLines.map((line, idx) => {
            const isCurrent = idx === currentIndex;
            const isPast = idx < currentIndex;
            const isNewParagraph = idx > 0 && line.lineIndexInParagraph === 0;

            return (
              <div
                key={line.id}
                ref={(el) => {
                  lineRefs.current[idx] = el;
                }}
                onClick={() => jumpToLine(idx)}
                className={`cursor-pointer transition-opacity duration-200 break-keep font-bold tracking-tight ${
                  isNewParagraph ? 'mt-[1.4em]' : 'mt-[0.35em]'
                } ${
                  isCurrent
                    ? 'text-white opacity-100'
                    : isPast
                    ? 'text-zinc-500 opacity-30'
                    : 'text-zinc-200 opacity-50 hover:opacity-80'
                }`}
              >
                {line.text}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}