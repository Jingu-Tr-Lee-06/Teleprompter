'use client';

import React from 'react';
import {
  Play,
  Clock,
  Type,
  MonitorPlay,
  Sliders,
  AlertTriangle,
  RotateCcw,
  Mic,
} from 'lucide-react';
import { AdvanceTrigger, ParsedScriptResult, PrompterConfig } from '@/types/script';

interface ScriptEditorProps {
  rawText: string;
  onChangeRawText: (text: string) => void;
  parsed: ParsedScriptResult;
  config: PrompterConfig;
  onUpdateConfig: (partial: Partial<PrompterConfig>) => void;
  onSetParagraphTime: (paragraphIndex: number, sec: number | undefined) => void;
  onSetLineTime: (lineId: string, sec: number | undefined) => void;
  onResetManualTimes: () => void;
  onStartPrompter: () => void;
}

function formatSec(ms: number): string {
  const totalSec = Math.round(ms / 100) / 10;
  const mins = Math.floor(totalSec / 60);
  const secs = (totalSec % 60).toFixed(1).replace(/\.0$/, '');
  return mins > 0 ? `${mins}분 ${secs}초` : `${secs}초`;
}

export function ScriptEditor({
  rawText,
  onChangeRawText,
  parsed,
  config,
  onUpdateConfig,
  onSetParagraphTime,
  onSetLineTime,
  onResetManualTimes,
  onStartPrompter,
}: ScriptEditorProps) {
  const targetMinutes = Math.floor(config.totalTargetDurationSec / 60);
  const targetSeconds = config.totalTargetDurationSec % 60;

  const handleTimeChange = (mins: number, secs: number) => {
    const clampedMins = Math.max(0, mins);
    const clampedSecs = Math.max(0, Math.min(59, secs));
    onUpdateConfig({ totalTargetDurationSec: clampedMins * 60 + clampedSecs });
  };

  const handleTriggerSelect = (nextTrigger: AdvanceTrigger) => {
    onUpdateConfig({
      advanceTrigger: nextTrigger,
      controlMode: nextTrigger !== 'manual' ? 'slide' : config.controlMode,
    });
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* 상단 제어 바 */}
      <header className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur px-6 py-4 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <MonitorPlay className="w-6 h-6 text-emerald-400" />
          <h1 className="text-lg font-bold tracking-tight">웹 텔레프롬프터 스튜디오</h1>
        </div>

        {/* 핵심 설정 컨트롤러 */}
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {/* 1. 전체 발표 시간 설정 */}
          <div className="flex items-center gap-2 bg-zinc-800 px-3 py-1.5 rounded-lg border border-zinc-700">
            <Clock className="w-4 h-4 text-emerald-400" />
            <span className="text-zinc-400">전체 시간:</span>
            <input
              type="number"
              min={0}
              max={180}
              value={targetMinutes}
              onChange={(e) => handleTimeChange(Number(e.target.value), targetSeconds)}
              className="w-12 bg-zinc-950 border border-zinc-700 rounded px-1.5 py-0.5 text-center font-mono"
            />
            <span>분</span>
            <input
              type="number"
              min={0}
              max={59}
              value={targetSeconds}
              onChange={(e) => handleTimeChange(targetMinutes, Number(e.target.value))}
              className="w-12 bg-zinc-950 border border-zinc-700 rounded px-1.5 py-0.5 text-center font-mono"
            />
            <span>초</span>
          </div>

          {/* 2. 글자 크기 설정 */}
          <div className="flex items-center gap-2 bg-zinc-800 px-3 py-1.5 rounded-lg border border-zinc-700">
            <Type className="w-4 h-4 text-sky-400" />
            <span className="text-zinc-400">글자 크기:</span>
            <input
              type="range"
              min={28}
              max={96}
              step={2}
              value={config.fontSizePx}
              onChange={(e) => onUpdateConfig({ fontSizePx: Number(e.target.value) })}
              className="w-24 accent-sky-400"
            />
            <span className="font-mono w-10 text-right">{config.fontSizePx}px</span>
          </div>

          {/* 3. 스크롤 제어 모드 선택 */}
          <div className="flex items-center gap-2 bg-zinc-800 px-3 py-1.5 rounded-lg border border-zinc-700">
            <Sliders className="w-4 h-4 text-amber-400" />
            <select
              value={config.controlMode}
              onChange={(e) =>
                onUpdateConfig({ controlMode: e.target.value as 'scroll' | 'slide' })
              }
              className="bg-transparent text-zinc-100 focus:outline-none cursor-pointer"
            >
              <option value="slide" className="bg-zinc-900">포인터 슬라이드 제어 모드</option>
              <option value="scroll" className="bg-zinc-900">연속 스크롤 모드</option>
            </select>
          </div>

          {/* 4. 문장 넘김 방식 선택 (수동 / 음성 / 손가락 튕기기 / 음성+손가락) */}
          <div className="flex items-center gap-2 bg-zinc-800 px-3 py-1.5 rounded-lg border border-zinc-700">
            <Mic className="w-4 h-4 text-rose-400" />
            <select
              value={config.advanceTrigger ?? 'manual'}
              onChange={(e) => handleTriggerSelect(e.target.value as AdvanceTrigger)}
              className="bg-transparent text-zinc-100 focus:outline-none cursor-pointer"
            >
              <option value="manual" className="bg-zinc-900">수동 넘김 (펜슬/키)</option>
              <option value="voice" className="bg-zinc-900">음성 인식 넘김</option>
              <option value="snap" className="bg-zinc-900">손가락 튕기기 (딱)</option>
              <option value="voice+snap" className="bg-zinc-900">음성 + 손가락 동시</option>
            </select>
          </div>

          {/* 프롬프터 실행 버튼 */}
          <button
            onClick={onStartPrompter}
            disabled={parsed.flatLines.length === 0}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-700 text-zinc-950 font-bold px-5 py-2 rounded-lg transition cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>프롬프터 시작</span>
          </button>
        </div>
      </header>

      {/* 시간 초과 경고 배너 */}
      {parsed.isOverTime && (
        <div className="bg-amber-500/15 border-b border-amber-500/40 px-6 py-2.5 flex items-center gap-2 text-amber-300 text-sm">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>
            수동 지정된 문단/줄 시간 합계가 목표 전체 시간보다 큽니다. (현재 배정 합계:{' '}
            <strong>{formatSec(parsed.totalCalculatedMs)}</strong>)
          </span>
        </div>
      )}

      {/* 메인 2단 작업 영역 */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-zinc-800">
        {/* 좌측: 원문 대본 입력 에디터 */}
        <section className="p-6 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-300">대본 원문 입력</h2>
            <span className="text-xs text-zinc-500">
              빈 줄(Enter 두 번)로 문단 구분 · 문단 첫머리{' '}
              <code className="text-zinc-300">{'{30s}'}</code>, 줄 끝{' '}
              <code className="text-zinc-300">{'[5s]'}</code> 태그 지원
            </span>
          </div>
          <textarea
            value={rawText}
            onChange={(e) => onChangeRawText(e.target.value)}
            placeholder="여기에 발표 대본을 입력하세요. 빈 줄을 넣으면 문단이 나뉩니다."
            className="flex-1 min-h-[500px] w-full bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-base leading-relaxed text-zinc-100 focus:outline-none focus:border-emerald-500 resize-none font-sans"
          />
        </section>

        {/* 우측: 문단별 / 줄별 세부 시간 인스펙터 */}
        <section className="p-6 flex flex-col gap-4 overflow-y-auto max-h-[calc(100vh-76px)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-zinc-300">
                문단 · 줄별 시간 배분 ({parsed.paragraphs.length}개 문단 /{' '}
                {parsed.flatLines.length}줄)
              </h2>
              <span className="text-xs bg-zinc-800 text-emerald-400 px-2.5 py-0.5 rounded-full font-mono">
                총 {formatSec(parsed.totalCalculatedMs)}
              </span>
            </div>
            <button
              onClick={onResetManualTimes}
              className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200 transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>수동 시간 초기화</span>
            </button>
          </div>

          <div className="space-y-4">
            {parsed.paragraphs.map((para) => (
              <div
                key={para.id}
                className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 space-y-3"
              >
                {/* 문단 헤더 및 문단 단위 시간 입력 */}
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                    문단 {para.index + 1} (슬라이드 #{para.index + 1})
                  </span>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-zinc-400">문단 시간(초):</span>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      placeholder={(para.totalDurationMs / 1000).toFixed(1)}
                      value={
                        para.manualDurationMs !== undefined
                          ? para.manualDurationMs / 1000
                          : ''
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        onSetParagraphTime(
                          para.index,
                          val === '' ? undefined : Math.max(0.5, Number(val))
                        );
                      }}
                      className="w-16 bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-right font-mono text-zinc-100 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* 문단 내 개별 줄 목록 및 줄 단위 시간 입력 */}
                <div className="space-y-2">
                  {para.lines.map((line) => (
                    <div
                      key={line.id}
                      className="flex items-center justify-between gap-3 bg-zinc-950/60 px-3 py-2 rounded-lg border border-zinc-800/70"
                    >
                      <p className="text-sm text-zinc-200 flex-1 break-keep">{line.text}</p>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <input
                          type="number"
                          min={0.5}
                          step={0.5}
                          placeholder={(line.durationMs / 1000).toFixed(1)}
                          value={
                            line.manualDurationMs !== undefined
                              ? line.manualDurationMs / 1000
                              : ''
                          }
                          onChange={(e) => {
                            const val = e.target.value;
                            onSetLineTime(
                              line.id,
                              val === '' ? undefined : Math.max(0.5, Number(val))
                            );
                          }}
                          className={`w-16 border rounded px-1.5 py-0.5 text-right text-xs font-mono focus:outline-none ${
                            line.manualDurationMs !== undefined
                              ? 'bg-sky-950/50 border-sky-500/60 text-sky-300'
                              : 'bg-zinc-900 border-zinc-800 text-zinc-400'
                          }`}
                        />
                        <span className="text-xs text-zinc-500">초</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}