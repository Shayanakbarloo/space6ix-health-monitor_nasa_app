// Speak a question instead of typing it, with the browser's own speech recognition
// (Chrome, Edge and Safari). Nothing is recorded or stored by the app: the browser turns
// speech into text, and the text is asked like a typed question.

import { useEffect, useRef, useState } from 'react'

interface Alternative {
  transcript: string
}
interface Result {
  isFinal: boolean
  0: Alternative
}
interface ResultEvent {
  resultIndex: number
  results: { length: number; [i: number]: Result }
}
interface Recognition {
  lang: string
  interimResults: boolean
  continuous: boolean
  maxAlternatives: number
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((e: ResultEvent) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}
type RecognitionClass = new () => Recognition

function recognitionClass(): RecognitionClass | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as { SpeechRecognition?: RecognitionClass; webkitSpeechRecognition?: RecognitionClass }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

/** What went wrong, in words for the person using it. */
export function speechError(code: string): string {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'The microphone is blocked. Allow it for this site in the browser, or type the question.'
    case 'audio-capture':
      return 'No microphone was found. Type the question instead.'
    case 'network':
      return 'Speaking a question needs an internet connection in this browser. Type it instead: typed questions work offline.'
    case 'no-speech':
      return 'Nothing was heard. Tap the microphone and speak again.'
    case 'unsupported':
      return 'Speaking a question works in Chrome, Edge and Safari. Type it here instead.'
    default:
      return 'The microphone did not work. Type the question instead.'
  }
}

/**
 * Dictation: `start` listens, the words appear in `heard` while the person speaks, and
 * `onDone` gets the full question when they stop.
 */
export function useDictation(onDone: (text: string) => void) {
  const [listening, setListening] = useState(false)
  const [heard, setHeard] = useState('')
  const [error, setError] = useState<string | null>(null)
  const rec = useRef<Recognition | null>(null)
  const done = useRef(onDone)
  done.current = onDone

  useEffect(() => () => rec.current?.abort(), [])

  const start = () => {
    const Rec = recognitionClass()
    setError(null)
    if (!Rec) return setError(speechError('unsupported'))
    rec.current?.abort()
    const r = new Rec()
    r.lang = 'en-US'
    r.interimResults = true
    r.continuous = false
    r.maxAlternatives = 1
    let final = ''
    r.onresult = (e) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const text = e.results[i][0].transcript
        if (e.results[i].isFinal) final += text
        else interim += text
      }
      setHeard((final + interim).trim())
    }
    r.onerror = (e) => {
      if (e.error !== 'aborted') setError(speechError(e.error))
    }
    r.onend = () => {
      setListening(false)
      rec.current = null
      const text = final.trim()
      setHeard('')
      if (text) done.current(text)
    }
    rec.current = r
    try {
      r.start()
      setListening(true)
    } catch {
      setError(speechError('other'))
    }
  }

  /** Stop listening; what was heard so far is asked. */
  const stop = () => rec.current?.stop()

  return { listening, heard, error, start, stop, supported: recognitionClass() !== null }
}
