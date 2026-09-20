import { useCallback, useEffect, useRef, useState } from 'react'

// Browser speech recognition only. No key, no endpoint, and nothing leaves the page that the
// browser would not already send, so dictation adds no new data path to the product.
type Recognition = {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0?: { transcript?: string } }> }) => void) | null
  onerror: ((event: { error?: string }) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}

type RecognitionConstructor = new () => Recognition

function constructorFor(): RecognitionConstructor | null {
  if (typeof window === 'undefined') return null
  const scope = window as unknown as { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor }
  return scope.SpeechRecognition ?? scope.webkitSpeechRecognition ?? null
}

const messages: Record<string, string> = {
  'not-allowed': 'Microphone access was blocked. Allow it in the browser to dictate.',
  'service-not-allowed': 'Microphone access was blocked. Allow it in the browser to dictate.',
  'no-speech': 'Nothing was heard. Try again a little closer to the microphone.',
  'audio-capture': 'No microphone was found.',
  network: 'Speech recognition could not reach the browser service.',
}

export function useDictation(onTranscript: (text: string) => void) {
  const [supported] = useState(() => constructorFor() !== null)
  const [listening, setListening] = useState(false)
  const [error, setError] = useState('')
  const recognition = useRef<Recognition | null>(null)
  const settled = useRef('')
  const generation = useRef(0)
  const emit = useRef(onTranscript)
  useEffect(() => { emit.current = onTranscript }, [onTranscript])

  const stop = useCallback(() => {
    recognition.current?.stop()
  }, [])

  // Sending takes ownership of the transcript. Detaching the handlers before abort() is what stops a
  // late final result from writing the spoken question back into an already cleared composer.
  const cancel = useCallback(() => {
    generation.current += 1
    const current = recognition.current
    settled.current = ''
    if (!current) return
    recognition.current = null
    current.onresult = null
    current.onerror = null
    current.onend = null
    setListening(false)
    setError('')
    current.abort()
  }, [])

  const start = useCallback(() => {
    const Constructor = constructorFor()
    if (!Constructor || recognition.current) return
    setError('')
    settled.current = ''
    const currentGeneration = ++generation.current
    const current = new Constructor()
    current.lang = 'en-US'
    // Continuous dictation with live partials, so a long question can be spoken in one go.
    current.continuous = true
    current.interimResults = true
    current.maxAlternatives = 1
    current.onresult = (event) => {
      if (currentGeneration !== generation.current || recognition.current !== current) return
      let pending = ''
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index]
        const text = result?.[0]?.transcript ?? ''
        if (result?.isFinal) settled.current = `${settled.current} ${text}`.trim()
        else pending += text
      }
      emit.current(`${settled.current} ${pending}`.trim())
    }
    current.onerror = (event) => {
      if (currentGeneration !== generation.current) return
      const code = event.error ?? ''
      // A silent stretch is normal in continuous mode and must not look like a failure.
      if (code === 'aborted' || code === 'no-speech') return
      setError(messages[code] ?? 'Dictation stopped unexpectedly.')
    }
    current.onend = () => {
      if (currentGeneration !== generation.current) return
      recognition.current = null
      setListening(false)
    }
    try {
      current.start()
      recognition.current = current
      setListening(true)
    } catch {
      setError('Dictation could not start.')
    }
  }, [])

  const toggle = useCallback(() => { if (listening) stop(); else start() }, [listening, start, stop])

  useEffect(() => () => { recognition.current?.abort(); recognition.current = null }, [])

  return { supported, listening, error, start, stop, cancel, toggle }
}
