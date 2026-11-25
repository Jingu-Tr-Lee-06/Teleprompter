import { useState, useEffect, useRef, useCallback } from 'react';
import { ScriptLine } from '@/types/script';

interface UseVoiceControlProps {
  isActive: boolean;          // 프롬프터 화면 활성화 여부
  isVoiceEnabled: boolean;    // 음성 제어 모드 ON/OFF
  flatLines: ScriptLine[];
  currentIndex: number;
  onAdvanceNextLine: () => void;
}

// 특수문자 및 공백 정리
function normalizeKorean(str: string): string {
  return str
    .replace(/[^\w\sㄱ-ㅎㅏ-ㅣ가-힣]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// 현재 문장의 끝부분(마지막 1~2어절 또는 끝 4글자)이 음성 인식 결과에 포함되었는지 검사
function isSentenceFinished(targetSentence: string, spokenTranscript: string): boolean {
  const cleanTarget = normalizeKorean(targetSentence);
  const cleanSpoken = normalizeKorean(spokenTranscript);

  if (!cleanTarget || !cleanSpoken) return false;

  const targetWords = cleanTarget.split(' ').filter((w) => w.length > 0);
  if (targetWords.length === 0) return false;

  // 1. 매우 짧은 문장(1~2어절)인 경우 마지막 어절 포함 여부 확인
  if (targetWords.length <= 2) {
    const lastWord = targetWords[targetWords.length - 1];
    // 조사를 제외한 핵심 어간(앞 2글자 이상) 매칭으로 인식률 보완
    const stem = lastWord.length >= 3 ? lastWord.slice(0, -1) : lastWord;
    return cleanSpoken.includes(stem);
  }

  // 2. 일반 문장(3어절 이상)인 경우 마지막 2어절 조합 또는 끝 4글자 매칭
  const lastTwoWords = targetWords.slice(-2).join(' ');
  const lastTwoCompact = targetWords.slice(-2).join('');
  const spokenCompact = cleanSpoken.replace(/\s+/g, '');

  // 마지막 단어의 어미 변형(예: "~습니다" vs "~해요")을 감안해 끝에서 1글자 제외한 핵심부 비교
  const tailStem =
    lastTwoCompact.length >= 5 ? lastTwoCompact.slice(0, -1) : lastTwoCompact;

  return (
    cleanSpoken.includes(lastTwoWords) ||
    spokenCompact.includes(lastTwoCompact) ||
    (tailStem.length >= 3 && spokenCompact.includes(tailStem))
  );
}

export function useVoiceControl({
  isActive,
  isVoiceEnabled,
  flatLines,
  currentIndex,
  onAdvanceNextLine,
}: UseVoiceControlProps) {
  const [isSupported, setIsSupported] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [lastHeardText, setLastHeardText] = useState('');
  const [voiceError, setVoiceError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const lastTriggerTimeRef = useRef<number>(0);
  const currentIndexRef = useRef<number>(currentIndex);
  const flatLinesRef = useRef<ScriptLine[]>(flatLines);
  const isEnabledRef = useRef<boolean>(isActive && isVoiceEnabled);
  const onAdvanceRef = useRef(onAdvanceNextLine);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    flatLinesRef.current = flatLines;
  }, [flatLines]);

  useEffect(() => {
    isEnabledRef.current = isActive && isVoiceEnabled;
  }, [isActive, isVoiceEnabled]);

  useEffect(() => {
    onAdvanceRef.current = onAdvanceNextLine;
  }, [onAdvanceNextLine]);

  // 문장이 바뀔 때마다 직전 문장의 잔여 인식 텍스트 초기화
  useEffect(() => {
    setLastHeardText('');
  }, [currentIndex]);

  const stopRecognition = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch {
        // 무시
      }
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  useEffect(() => {
    if (!isActive || !isVoiceEnabled) {
      stopRecognition();
      setVoiceError(null);
      return;
    }

    const SpeechRecognitionAPI =
      typeof window !== 'undefined'
        ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        : null;

    if (!SpeechRecognitionAPI) {
      setIsSupported(false);
      setVoiceError('이 브라우저는 음성 인식을 지원하지 않습니다. (Chrome / 삼성 인터넷 권장)');
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = 'ko-KR';
    recognition.continuous = true;
    recognition.interimResults = true; // 말이 끝나기 전 중간 인식 결과로 즉각 반응

    recognition.onstart = () => {
      setIsListening(true);
      setVoiceError(null);
    };

    recognition.onresult = (event: any) => {
      let currentTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        currentTranscript += event.results[i][0].transcript;
      }

      const trimmed = currentTranscript.trim();
      if (!trimmed) return;
      setLastHeardText(trimmed);

      const now = Date.now();
      // 연속 중복 넘김 방지 (1.2초 쿨다운)
      if (now - lastTriggerTimeRef.current < 1200) return;

      const idx = currentIndexRef.current;
      const lines = flatLinesRef.current;
      const activeLine = lines[idx];

      if (activeLine && idx < lines.length - 1) {
        if (isSentenceFinished(activeLine.text, trimmed)) {
          lastTriggerTimeRef.current = now;
          onAdvanceRef.current();
        }
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'not-allowed') {
        setVoiceError('마이크 권한이 차단되었습니다. 브라우저 설정에서 마이크를 허용해 주세요.');
        setIsListening(false);
      } else if (event.error === 'no-speech') {
        // 침묵으로 인한 일시 중단 — onend에서 자동 재시작됨
      } else {
        setVoiceError(`음성 인식 상태: ${event.error}`);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      // 음성 모드가 여전히 켜져 있다면 끊김 없이 재시작
      if (isEnabledRef.current) {
        setTimeout(() => {
          if (isEnabledRef.current) {
            try {
              recognition.start();
            } catch {
              // 이미 시작된 경우 무시
            }
          }
        }, 250);
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      // 무시
    }

    return () => {
      stopRecognition();
    };
  }, [isActive, isVoiceEnabled, stopRecognition]);

  return {
    isSupported,
    isListening,
    lastHeardText,
    voiceError,
  };
}