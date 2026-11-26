'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { PrompterConfig } from '@/types/script';
import { parseAndCalculateScript } from '@/utils/timeParser';
import { ScriptEditor } from '@/components/editor/ScriptEditor';
import { PrompterView } from '@/components/prompter/PrompterView';

const STORAGE_KEY = 'jh_teleprompter_state_v1';

const DEFAULT_SCRIPT = `{25s}
안녕하세요, 오늘 발표를 맡은 발표자입니다.
첫 번째 인트로 문단은 25초 동안 여유 있게 진행되도록 설정되어 있습니다.

이 문단은 별도 시간을 지정하지 않았습니다.
전체 발표 시간에서 다른 문단 시간을 뺀 나머지 시간이 글자 수 비율대로 자동 배분됩니다.

{30s}
핵심 내용을 강조할 때는 줄 끝에 시간을 직접 지정할 수 있습니다. [8s]
이렇게 특정 문장만 천천히 또박또박 읽도록 제어할 수 있습니다. [10s]
발표용 무선 포인터의 다음/이전 버튼을 누르면 슬라이드처럼 문단 단위로 이동할 수도 있습니다.`;

const DEFAULT_CONFIG: PrompterConfig = {
  totalTargetDurationSec: 90,
  fontSizePx: 52,
  lineHeight: 1.6,
  controlMode: 'slide',
  isMirrored: false,
};

export default function HomePage() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isPrompterOpen, setIsPrompterOpen] = useState(false);

  const [rawText, setRawText] = useState<string>(DEFAULT_SCRIPT);
  const [config, setConfig] = useState<PrompterConfig>(DEFAULT_CONFIG);
  const [paragraphTimes, setParagraphTimes] = useState<Record<number, number>>({});
  const [lineTimes, setLineTimes] = useState<Record<string, number>>({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        if (typeof data.rawText === 'string') setRawText(data.rawText);
        if (data.config) setConfig((prev) => ({ ...prev, ...data.config }));
        if (data.paragraphTimes) setParagraphTimes(data.paragraphTimes);
        if (data.lineTimes) setLineTimes(data.lineTimes);
      }
    } catch {
      // 저장 데이터 손상 시 기본값 유지
    } finally {
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!isLoaded) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          rawText,
          config,
          paragraphTimes,
          lineTimes,
        })
      );
    } catch {
      // 용량 초과 등 예외 무시
    }
  }, [isLoaded, rawText, config, paragraphTimes, lineTimes]);

  const parsedScript = useMemo(() => {
    return parseAndCalculateScript(rawText, config.totalTargetDurationSec, {
      paragraphTimes,
      lineTimes,
    });
  }, [rawText, config.totalTargetDurationSec, paragraphTimes, lineTimes]);

  const handleUpdateConfig = (partial: Partial<PrompterConfig>) => {
    setConfig((prev) => ({ ...prev, ...partial }));
  };

  const handleSetParagraphTime = (paragraphIndex: number, sec: number | undefined) => {
    setParagraphTimes((prev) => {
      const next = { ...prev };
      if (sec === undefined) {
        delete next[paragraphIndex];
      } else {
        next[paragraphIndex] = Math.round(sec * 1000);
      }
      return next;
    });
  };

  const handleSetLineTime = (lineId: string, sec: number | undefined) => {
    setLineTimes((prev) => {
      const next = { ...prev };
      if (sec === undefined) {
        delete next[lineId];
      } else {
        next[lineId] = Math.round(sec * 1000);
      }
      return next;
    });
  };

  const handleResetManualTimes = () => {
    setParagraphTimes({});
    setLineTimes({});
  };

  const handleStartPrompter = async () => {
    setIsPrompterOpen(true);
    try {
      if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // 전체화면 거부 시 일반 뷰포트 전체화면으로 동작
    }
  };

  const handleExitPrompter = async () => {
    setIsPrompterOpen(false);
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {
      // 무시
    }
  };

  if (!isLoaded) {
    return <div className="min-h-screen bg-zinc-950" />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950">
      {isPrompterOpen ? (
        <PrompterView
          parsed={parsedScript}
          config={config}
          onUpdateConfig={handleUpdateConfig}
          onExit={handleExitPrompter}
        />
      ) : (
        <>
          <div className="flex-1">
            <ScriptEditor
              rawText={rawText}
              onChangeRawText={setRawText}
              parsed={parsedScript}
              config={config}
              onUpdateConfig={handleUpdateConfig}
              onSetParagraphTime={handleSetParagraphTime}
              onSetLineTime={handleSetLineTime}
              onResetManualTimes={handleResetManualTimes}
              onStartPrompter={handleStartPrompter}
            />
          </div>

          <footer className="border-t border-zinc-900 bg-zinc-950 py-3 px-6 text-center text-xs text-zinc-500">
            JH&apos;s SW Lab
          </footer>
        </>
      )}
    </div>
  );
}