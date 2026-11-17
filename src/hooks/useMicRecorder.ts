import { useCallback, useEffect, useRef, useState } from 'react'
import type { MicPermission } from '../types'

export type FollowStatus =
  | 'idle'
  | 'requesting'
  | 'recording'
  | 'listening'
  | 'fallback'

export interface VoiceClip {
  blob: Blob
  url: string
  duration: number
  createdAt: number
}

interface UseMicRecorderOptions {
  onPermission?: (permission: MicPermission) => void
  onClip?: (clip: VoiceClip) => void
}

const MAX_RECORDING_MS = 5000

/**
 * Microphone use is deliberately narrow: RMS volume and rhythm only.
 * No speech recognition, scoring, upload, or persistent storage is involved.
 */
export function useMicRecorder({
  onPermission,
  onClip,
}: UseMicRecorderOptions = {}) {
  const [permission, setPermission] = useState<MicPermission>('unknown')
  const [status, setStatus] = useState<FollowStatus>('idle')
  const [energy, setEnergy] = useState(0)
  const permissionRef = useRef<MicPermission>('unknown')
  const holdingRef = useRef(false)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const contextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const rafRef = useRef<number | null>(null)
  const timeoutRef = useRef<number | null>(null)
  const startedAtRef = useRef(0)
  const onPermissionRef = useRef(onPermission)
  const onClipRef = useRef(onClip)

  onPermissionRef.current = onPermission
  onClipRef.current = onClip

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
  }, [])

  const stopHold = useCallback(() => {
    holdingRef.current = false
    const recorder = recorderRef.current
    const duration = Math.min(
      MAX_RECORDING_MS,
      Math.max(0, performance.now() - startedAtRef.current),
    )

    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = () => {
        const type = recorder.mimeType || 'audio/webm'
        const blob = new Blob(chunksRef.current, { type })
        chunksRef.current = []
        if (blob.size > 0) {
          onClipRef.current?.({
            blob,
            url: URL.createObjectURL(blob),
            duration,
            createdAt: Date.now(),
          })
        }
        recorderRef.current = null
        cleanupResources()
        setStatus('idle')
      }
      recorder.stop()
      return
    }

    recorderRef.current = null
    cleanupResources()
    setStatus('idle')
  }, [cleanupResources])

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
    analyser.smoothingTimeConstant = 0.78
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
      setEnergy(Math.min(1, rms * 4.5))
      rafRef.current = requestAnimationFrame(tick)
    }
    tick()
  }, [])
  const startFallback = useCallback(() => {
    if (!holdingRef.current) return
    startedAtRef.current = performance.now()
    setStatus('fallback')
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
    setStatus('requesting')

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
        chunksRef.current = []
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunksRef.current.push(event.data)
        }
        recorder.start()
        setStatus('recording')
      } else {
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
    const release = () => {
      if (holdingRef.current) stopHold()
    }
    window.addEventListener('blur', release)
    return () => {
      window.removeEventListener('blur', release)
      if (holdingRef.current) stopHold()
      cleanupResources()
    }
  }, [cleanupResources, stopHold])

  return {
    permission,
    status,
    energy,
    startHold,
    stopHold,
    isActive:
      status === 'recording' || status === 'listening' || status === 'fallback',
  }
}