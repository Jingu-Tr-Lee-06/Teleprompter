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
  Timer,
  PanelLeftClose,
  PanelLeftOpen,
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

function formatStopwatch(ms: number): string {
  const totalTenths = Math.floor(Math.max(0, ms) / 100);
  const m = Math.floor(totalTenths / 600);
  const s = Math.floor((totalTenths % 600) / 10);
  const d = totalTenths % 10;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${d}`;
}

function formatDiffSec(diffMs: number): string {
  const sec = diffMs / 1000;
  if (Math.abs(sec) < 0.05) return '0.0s';
  const sign = sec > 0 ? '+' : '';
  return `${sign}${sec.toFixed(1)}s`;
}

export function PrompterView({
  parsed,
  config,
  onUpdateConfig,
  onExit,
}: PrompterViewProps) {
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);
  const tableRowRefs = useRef<(HTMLTableRowElement | null)[]>([]);
  const [translateY, setTranslateY] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const {
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
  } = useTeleprompter({
    flatLines: parsed.flatLines,
    controlMode: config.controlMode,
  });

  const { isBlackout, setIsBlackout } = usePointerControl({
    isActive: true,
    controlMode: config.controlMode,
    onTogglePlay: togglePlay,
    onStartPlay: () => setIsPlaying(true),
    onNextLine: jumpToNextLine,
    onPrevLine: jumpToPrevLine,
    onNextParagraph: jumpToNextParagraph,
    onPrevParagraph: jumpToPrevParagraph,
    onAdjustFontSize: (delta) =>
      onUpdateConfig({
        fontSizePx: Math.max(24, Math.min(120, config.fontSizePx + delta)),
      }),
    onExitPrompter: onExit,
  });

  // 현재 줄의 실제 픽셀 높이와 진행률(lineProgress: 0 -> 1)에 따라 스크롤 이동
  useEffect(() => {
    const activeEl = lineRefs.current[currentIndex];
    if (!activeEl) return;

    const offsetTop = activeEl.offsetTop;
    const height = activeEl.offsetHeight;
    const smoothOffset = offsetTop + height * lineProgress;
    setTranslateY(-smoothOffset);
  }, [currentIndex, lineProgress, config.fontSizePx, parsed.flatLines]);

  // 좌측 시간 분석 테이블의 현재 행이 항상 보이도록 자동 스크롤
  useEffect(() => {
    const rowEl = tableRowRefs.current[currentIndex];
    if (rowEl && isSidebarOpen) {
      rowEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [currentIndex, isSidebarOpen]);

  const activeLine = parsed.flatLines[currentIndex];
  const remainingTotalMs = Math.max(0, parsed.totalCalculatedMs - elapsedTotalMs);

  const currentLineRemainingSec = useMemo(() => {
    if (!activeLine) return 0;
    const remMs = activeLine.durationMs * (1 - lineProgress);
    return Math.max(0, Math.ceil(remMs / 1000));
  }, [activeLine, lineProgress]);

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

  const totalPaceDiffMs = useMemo(() => {
    let diff = 0;
    parsed.flatLines.forEach((line, idx) => {
      const actual = lineActualDurationsMs[idx];
      if (actual !== undefined) {
        diff += actual - line.durationMs;
      }
    });
    return diff;
  }, [parsed.flatLines, lineActualDurationsMs]);

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
      {/* 상단 HUD 컨트롤 바 (z-50 최상단 고정) */}
      <div className="relative z-50 flex items-center justify-between px-4 py-3 bg-zinc-950 border-b border-zinc-800">
        <div className="flex items-center gap-2.5">
          {/* 좌측 초시계 테이블 열기/닫기 버튼 */}
          <button
            onClick={() => setIsSidebarOpen((prev) => !prev)}
            className="p-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 rounded-md cursor-pointer border border-zinc-800"
            title={isSidebarOpen ? '초시계 패널 숨기기' : '초시계 패널 보기'}
          >
            {isSidebarOpen ? (
              <PanelLeftClose className="w-4 h-4" />
            ) : (
              <PanelLeftOpen className="w-4 h-4" />
            )}
          </button>

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

          <button
            onClick={jumpToPrevParagraph}
            className="p-1.5 text-zinc-400 hover:text-white cursor-pointer"
            title="이전 문단 (↑)"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-xs font-mono text-zinc-300">
            문단 {(activeLine?.paragraphIndex ?? 0) + 1} / {parsed.paragraphs.length}
          </span>
          <button
            onClick={jumpToNextParagraph}
            className="p-1.5 text-zinc-400 hover:text-white cursor-pointer"
            title="다음 문단 (↓)"
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

      {/* 메인 바디 영역 (좌측 초시계 패널 + 우측 본문 스테이지) */}
      <div className="relative flex-1 flex overflow-hidden">
        {/* 좌측 패널: 발표 초시계 & 문장별 계획 대비 증감 시간 테이블 (z-40) */}
        {isSidebarOpen && (
          <aside className="relative z-40 w-72 shrink-0 h-full bg-zinc-950 border-r border-zinc-800 flex flex-col">
            {/* 상단 초시계 영역 */}
            <div className="p-4 border-b border-zinc-800 bg-zinc-900/80">
              <div className="flex items-center justify-between text-xs text-zinc-400 mb-1">
                <span className="flex items-center gap-1.5 font-medium text-zinc-300">
                  <Timer className="w-4 h-4 text-emerald-400" />
                  발표 경과 초시계
                </span>
                <span
                  className={`font-mono font-bold ${
                    totalPaceDiffMs > 500
                      ? 'text-rose-400'
                      : totalPaceDiffMs < -500
                      ? 'text-sky-400'
                      : 'text-zinc-400'
                  }`}
                >
                  누적 {formatDiffSec(totalPaceDiffMs)}
                </span>
              </div>
              <div className="text-3xl font-extrabold font-mono text-white tracking-tight tabular-nums">
                {formatStopwatch(realElapsedMs)}
              </div>
            </div>

            {/* 문장별 계획 대비 증감 테이블 */}
            <div className="flex-1 overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 z-10 bg-zinc-900 text-zinc-400 border-b border-zinc-800 text-[11px]">
                  <tr>
                    <th className="py-2 px-2.5 font-medium w-8">#</th>
                    <th className="py-2 px-1.5 font-medium">문장</th>
                    <th className="py-2 px-1.5 font-medium text-right w-12">계획</th>
                    <th className="py-2 px-2.5 font-medium text-right w-14">증감</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900 font-mono">
                  {parsed.flatLines.map((line, idx) => {
                    const actualMs = lineActualDurationsMs[idx];
                    const hasStarted = actualMs !== undefined;
                    const isCurrent = idx === currentIndex;
                    const diffMs = hasStarted ? actualMs - line.durationMs : 0;

                    return (
                      <tr
                        key={line.id}
                        ref={(el) => {
                          tableRowRefs.current[idx] = el;
                        }}
                        onClick={() => jumpToLine(idx)}
                        className={`cursor-pointer transition-colors ${
                          isCurrent
                            ? 'bg-zinc-800 text-white'
                            : hasStarted
                            ? 'text-zinc-300 hover:bg-zinc-900'
                            : 'text-zinc-500 hover:bg-zinc-900/50'
                        }`}
                      >
                        <td className="py-2 px-2.5 text-[11px] text-zinc-500">
                          {idx + 1}
                        </td>
                        <td className="py-2 px-1.5 font-sans truncate max-w-[115px]">
                          {line.text}
                        </td>
                        <td className="py-2 px-1.5 text-right text-zinc-400 tabular-nums">
                          {(line.durationMs / 1000).toFixed(1)}s
                        </td>
                        <td
                          className={`py-2 px-2.5 text-right font-bold tabular-nums ${
                            !hasStarted
                              ? 'text-zinc-600'
                              : diffMs > 50
                              ? 'text-rose-400'
                              : diffMs < -50
                              ? 'text-sky-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          {hasStarted ? formatDiffSec(diffMs) : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </aside>
        )}

        {/* 우측 본문 스크롤 영역 */}
        <div className="relative flex-1 overflow-hidden">
          {/* 우측 상단 현재 문장 남은 초 대형 카운트다운 (숫자만 표기) */}
          <div className="pointer-events-none absolute top-6 right-8 z-30">
            <span className="text-white font-extrabold text-7xl md:text-8xl leading-none tracking-tight tabular-nums drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]">
              {currentLineRemainingSec}
            </span>
          </div>

          {/* 시선 고정 가이드라인 */}
          <div className="pointer-events-none absolute inset-x-0 top-[35%] z-20 flex items-center justify-between px-4">
            <div className="w-3 h-3 border-t-2 border-r-2 border-emerald-500 rotate-45" />
            <div className="flex-1 border-t border-dashed border-zinc-800/80 mx-3" />
            <div className="w-3 h-3 border-t-2 border-l-2 border-emerald-500 -rotate-45" />
          </div>

          {/* 본문 스크롤 스테이지 */}
          <div
            className={`relative w-full h-full px-8 pr-28 ${
              config.isMirrored ? 'scale-x-[-1]' : ''
            }`}
          >
            <div
              style={{
                transform: `translate3d(0, calc(35vh + ${translateY}px), 0)`,
                fontSize: `${config.fontSizePx}px`,
                lineHeight: config.lineHeight,
              }}
              className="will-change-transform transition-none max-w-4xl mx-auto"
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
      </div>
    </div>
  );
}