import { useCallback, useEffect, useRef, useState } from 'react'
import type { MicPermission } from '../types'

export type FollowStatus =
  | 'idle'
  | 'requesting'
  | 'recording'
  | 'listening'
  | 'fallback'

export type FollowSource = 'voice' | 'rhythm' | 'silent'

export interface VoiceClip {
  blob: Blob
  url: string
  duration: number
  createdAt: number
}

export interface FollowOutcome {
  source: FollowSource
  duration: number
  peakEnergy: number
  clip?: VoiceClip
}

interface UseMicRecorderOptions {
  onPermission?: (permission: MicPermission) => void
  onComplete?: (outcome: FollowOutcome) => void
}

type CaptureMode = 'recorder' | 'analyser' | 'fallback' | null

const MAX_RECORDING_MS = 5000
const VOICE_THRESHOLD = 0.022

/**
 * Microphone use is deliberately narrow: RMS volume and rhythm only.
 * No speech recognition, scoring, upload, or persistent storage is involved.
 */
export function useMicRecorder({
  onPermission,
  onComplete,
}: UseMicRecorderOptions = {}) {
  const [permission, setPermission] = useState<MicPermission>('unknown')
  const [status, setStatus] = useState<FollowStatus>('idle')
  const [energy, setEnergy] = useState(0)
  const [voiceDetected, setVoiceDetected] = useState(false)
  const [lastOutcome, setLastOutcome] = useState<FollowSource | null>(null)
  const permissionRef = useRef<MicPermission>('unknown')
  const holdingRef = useRef(false)
  const captureModeRef = useRef<CaptureMode>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const contextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const rafRef = useRef<number | null>(null)
  const timeoutRef = useRef<number | null>(null)
  const startedAtRef = useRef(0)
  const peakEnergyRef = useRef(0)
  const hadVoiceRef = useRef(false)
  const onPermissionRef = useRef(onPermission)
  const onCompleteRef = useRef(onComplete)

  useEffect(() => {
    onPermissionRef.current = onPermission
    onCompleteRef.current = onComplete
  }, [onComplete, onPermission])

  const updatePermission = useCallback((next: MicPermission) => {
    permissionRef.current = next
    setPermission(next)
    onPermissionRef.current?.(next)
  }, [])

  const cleanupResources = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current)
    rafRef.current = null
    timeoutRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    analyserRef.current = null
    if (contextRef.current && contextRef.current.state !== 'closed') {
      void contextRef.current.close()
    }
    contextRef.current = null
    setEnergy(0)
    setVoiceDetected(false)
  }, [])

  const cancelCapture = useCallback(() => {
    holdingRef.current = false
    captureModeRef.current = null
    const recorder = recorderRef.current
    recorderRef.current = null
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null
      try {
        recorder.stop()
      } catch {
        // The recorder may already be stopping.
      }
    }
    chunksRef.current = []
    cleanupResources()
    setStatus('idle')
  }, [cleanupResources])

  const finish = useCallback(
    (source: FollowSource, duration: number, clip?: VoiceClip) => {
      captureModeRef.current = null
      setLastOutcome(source)
      setStatus('idle')
      onCompleteRef.current?.({
        source,
        duration,
        peakEnergy: peakEnergyRef.current,
        clip,
      })
    },
    [],
  )

  const stopHold = useCallback(() => {
    if (!holdingRef.current && captureModeRef.current === null) return
    holdingRef.current = false
    const mode = captureModeRef.current
    captureModeRef.current = null
    const duration = Math.min(
      MAX_RECORDING_MS,
      Math.max(0, performance.now() - startedAtRef.current),
    )
    const recorder = recorderRef.current

    if (mode === 'recorder' && recorder && recorder.state !== 'inactive') {
      recorder.onstop = () => {
        const type = recorder.mimeType || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type })
        chunksRef.current = []
        recorderRef.current = null
        if (hadVoiceRef.current) {
          const clip =
            blob.size > 0
              ? {
                  blob,
                  url: URL.createObjectURL(blob),
                  duration,
                  createdAt: Date.now(),
                }
              : undefined
          cleanupResources()
          finish('voice', duration, clip)
          return
        }
        cleanupResources()
        finish('silent', duration)
      }
      recorder.stop()
      return
    }

    if (mode === 'fallback') {
      cleanupResources()
      finish('rhythm', duration)
      return
    }

    if (mode === 'analyser') {
      cleanupResources()
      finish(hadVoiceRef.current ? 'voice' : 'silent', duration)
      return
    }

    cleanupResources()
    setStatus('idle')
  }, [cleanupResources, finish])

  const startAnalyser = useCallback((stream: MediaStream) => {
    const AudioContextClass =
      window.AudioContext ||
      (
        window as typeof window & {
          webkitAudioContext?: typeof AudioContext
        }
      ).webkitAudioContext
    if (!AudioContextClass) return

    const context = new AudioContextClass()
    const source = context.createMediaStreamSource(stream)
    const analyser = context.createAnalyser()
    analyser.fftSize = 512
    analyser.smoothingTimeConstant = 0.72
    source.connect(analyser)
    contextRef.current = context
    analyserRef.current = analyser

    const data = new Uint8Array(analyser.fftSize)
    const tick = () => {
      if (!analyserRef.current) return
      analyserRef.current.getByteTimeDomainData(data)
      let sum = 0
      for (const sample of data) {
        const value = (sample - 128) / 128
        sum += value * value
      }
      const rms = Math.sqrt(sum / data.length)
      if (rms > VOICE_THRESHOLD) {
        hadVoiceRef.current = true
        const normalized = Math.min(1, rms * 4.5)
        peakEnergyRef.current = Math.max(peakEnergyRef.current, normalized)
        setVoiceDetected(true)
        setEnergy(normalized)
      } else {
        setEnergy(0)
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    tick()
  }, [])

  const startFallback = useCallback(() => {
    if (!holdingRef.current) return
    captureModeRef.current = 'fallback'
    startedAtRef.current = performance.now()
    hadVoiceRef.current = false
    peakEnergyRef.current = 0
    setStatus('fallback')
    setVoiceDetected(false)
    const started = performance.now()
    const tick = () => {
      if (!holdingRef.current) return
      const elapsed = (performance.now() - started) / 1000
      const rhythm = 0.32 + Math.abs(Math.sin(elapsed * 3.1)) * 0.55
      setEnergy(rhythm)
      rafRef.current = requestAnimationFrame(tick)
    }
    tick()
    timeoutRef.current = window.setTimeout(stopHold, MAX_RECORDING_MS)
  }, [stopHold])

  const startHold = useCallback(async () => {
    if (holdingRef.current) return
    holdingRef.current = true
    captureModeRef.current = null
    hadVoiceRef.current = false
    peakEnergyRef.current = 0
    setLastOutcome(null)
    setStatus('requesting')
    setVoiceDetected(false)

    if (permissionRef.current === 'denied') {
      startFallback()
      return
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      updatePermission('unsupported')
      startFallback()
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      if (!holdingRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        setStatus('idle')
        return
      }

      streamRef.current = stream
      updatePermission('granted')
      startedAtRef.current = performance.now()
      startAnalyser(stream)

      if ('MediaRecorder' in window) {
        const recorder = new MediaRecorder(stream)
        recorderRef.current = recorder
        captureModeRef.current = 'recorder'
        chunksRef.current = []
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunksRef.current.push(event.data)
        }
        recorder.start()
        setStatus('recording')
      } else {
        captureModeRef.current = 'analyser'
        setStatus('listening')
      }

      timeoutRef.current = window.setTimeout(stopHold, MAX_RECORDING_MS)
    } catch (error) {
      const denied =
        error instanceof DOMException &&
        (error.name === 'NotAllowedError' || error.name === 'SecurityError')
      updatePermission(denied ? 'denied' : 'unsupported')
      startFallback()
    }
  }, [startAnalyser, startFallback, stopHold, updatePermission])

  useEffect(() => {
    const cancelIfActive = () => {
      if (holdingRef.current || captureModeRef.current !== null) cancelCapture()
    }
    const handleVisibility = () => {
      if (document.hidden) cancelIfActive()
    }
    window.addEventListener('blur', cancelIfActive)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.removeEventListener('blur', cancelIfActive)
      document.removeEventListener('visibilitychange', handleVisibility)
      cancelCapture()
    }
  }, [cancelCapture])

  return {
    permission,
    status,
    energy,
    voiceDetected,
    lastOutcome,
    startHold,
    stopHold,
    cancelHold: cancelCapture,
    isActive:
      status === 'recording' || status === 'listening' || status === 'fallback',
  }
}