import { useState, useEffect, useRef, useCallback } from 'react';

interface UseSnapControlProps {
  isActive: boolean;
  isSnapEnabled: boolean;
  sensitivity?: number; // 1(둔감) ~ 10(민감), 기본값 6
  onSnapDetected: () => void;
}

export function useSnapControl({
  isActive,
  isSnapEnabled,
  sensitivity = 6,
  onSnapDetected,
}: UseSnapControlProps) {
  const [isListeningSnap, setIsListeningSnap] = useState(false);
  const [snapError, setSnapError] = useState<string | null>(null);
  const [lastSnapTime, setLastSnapTime] = useState<number | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const lastTriggerRef = useRef<number>(0);
  const onSnapRef = useRef(onSnapDetected);

  useEffect(() => {
    onSnapRef.current = onSnapDetected;
  }, [onSnapDetected]);

  const cleanup = useCallback(() => {
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    setIsListeningSnap(false);
  }, []);

  useEffect(() => {
    if (!isActive || !isSnapEnabled) {
      cleanup();
      setSnapError(null);
      return;
    }

    let cancelled = false;

    const startAudioDetection = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: false,
            noiseSuppression: false, // 핑거 스냅 같은 짧은 파열음이 노이즈 캔슬링에 지워지지 않도록 해제
            autoGainControl: false,
          },
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        const AudioContextClass =
          window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const audioCtx = new AudioContextClass();
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();

        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.15; // 빠른 순간 반응성 확보
        source.connect(analyser);

        audioCtxRef.current = audioCtx;
        streamRef.current = stream;
        setIsListeningSnap(true);
        setSnapError(null);

        const freqData = new Uint8Array(analyser.frequencyBinCount);
        const sampleRate = audioCtx.sampleRate;
        const binSizeHz = sampleRate / analyser.fftSize;

        // 손가락 튕기기 핵심 공명 대역 (약 1800Hz ~ 6500Hz) 인덱스 계산
        const lowBin = Math.floor(1800 / binSizeHz);
        const highBin = Math.min(freqData.length - 1, Math.ceil(6500 / binSizeHz));

        // 배경 소음 이동 평균(EMA) 및 피크 추적 변수
        let baselineHighEnergy = 20;
        let peakHighEnergy = 0;
        let peakTimestamp = 0;

        // 민감도(1~10)에 따른 임계 배수 및 최소 에너지 설정
        const ratioThreshold = Math.max(2.2, 4.8 - sensitivity * 0.25);
        const minAbsEnergy = Math.max(45, 135 - sensitivity * 8);

        const analyzeFrame = () => {
          if (cancelled) return;

          analyser.getByteFrequencyData(freqData);

          // 1. 저음역(목소리 기본음 150~600Hz)과 고음역(핑거 스냅 1800~6500Hz) 에너지 평균 계산
          let lowVoiceSum = 0;
          let lowCount = 0;
          for (let i = 2; i < lowBin; i++) {
            lowVoiceSum += freqData[i];
            lowCount++;
          }
          const lowVoiceEnergy = lowCount > 0 ? lowVoiceSum / lowCount : 0;

          let highSum = 0;
          let highCount = 0;
          for (let i = lowBin; i <= highBin; i++) {
            highSum += freqData[i];
            highCount++;
          }
          const highEnergy = highCount > 0 ? highSum / highCount : 0;

          const now = performance.now();

          // 2. 급격한 고주파 스파이크 포착 (고음 에너지가 배경 소음 대비 급등 + 저음 말소리보다 고음 비중이 높음)
          const isSharpSpike =
            highEnergy > minAbsEnergy &&
            highEnergy > baselineHighEnergy * ratioThreshold &&
            highEnergy > lowVoiceEnergy * 0.85;

          if (isSharpSpike && highEnergy > peakHighEnergy) {
            peakHighEnergy = highEnergy;
            peakTimestamp = now;
          }

          // 3. 피크 발생 후 40~160ms 내에 에너지가 급격히 감쇠하는지 검증 (지속적인 박수·말소리 배제)
          if (peakTimestamp > 0 && now - peakTimestamp >= 45) {
            if (highEnergy < peakHighEnergy * 0.65 && now - lastTriggerRef.current > 900) {
              lastTriggerRef.current = now;
              setLastSnapTime(Date.now());
              onSnapRef.current();
            }
            // 피크 상태 초기화
            peakHighEnergy = 0;
            peakTimestamp = 0;
          }

          // 평상시 배경 소음 기준선 완만하게 업데이트
          if (!isSharpSpike) {
            baselineHighEnergy = baselineHighEnergy * 0.94 + highEnergy * 0.06;
          }

          rafIdRef.current = requestAnimationFrame(analyzeFrame);
        };

        rafIdRef.current = requestAnimationFrame(analyzeFrame);
      } catch {
        if (!cancelled) {
          setSnapError('마이크 접근 권한이 필요합니다.');
          setIsListeningSnap(false);
        }
      }
    };

    startAudioDetection();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [isActive, isSnapEnabled, sensitivity, cleanup]);

  return {
    isListeningSnap,
    snapError,
    lastSnapTime,
  };
}