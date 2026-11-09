import { useEffect, useRef, useState } from 'react';
import { Mic, Square } from 'lucide-react';

interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult:
    | ((event: {
        results: ArrayLike<{ isFinal: boolean; [key: number]: { transcript: string } }>;
        resultIndex: number;
      }) => void)
    | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
type SpeechWindow = Window & {
  SpeechRecognition?: new () => Recognition;
  webkitSpeechRecognition?: new () => Recognition;
};

export function Dictation({
  append,
  disabled = false,
  label = 'Dictate',
  onListening,
}: {
  append: (text: string) => void;
  disabled?: boolean;
  label?: string;
  onListening?: (value: boolean) => void;
}) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [message, setMessage] = useState('');
  const recognition = useRef<Recognition | null>(null);
  const appendRef = useRef(append);
  const listeningRef = useRef(onListening);
  appendRef.current = append;
  listeningRef.current = onListening;
  const supported =
    typeof window !== 'undefined' &&
    Boolean(
      (window as SpeechWindow).SpeechRecognition ||
      (window as SpeechWindow).webkitSpeechRecognition,
    );
  useEffect(
    () => () => {
      const current = recognition.current;
      if (current) {
        current.onresult = current.onerror = current.onend = current.onstart = null;
        current.abort();
      }
      listeningRef.current?.(false);
    },
    [],
  );
  const start = () => {
    const Constructor =
      (window as SpeechWindow).SpeechRecognition ||
      (window as SpeechWindow).webkitSpeechRecognition;
    if (!Constructor) {
      setMessage(
        'Dictation is not supported in this browser. Use your system dictation or type your message.',
      );
      return;
    }
    setMessage('');
    setInterim('');
    const current = new Constructor();
    recognition.current = current;
    current.lang = navigator.language || 'en-US';
    current.continuous = true;
    current.interimResults = true;
    current.onstart = () => {
      setMessage('');
      setListening(true);
      listeningRef.current?.(true);
    };
    current.onresult = (event) => {
      let preview = '';
      const completed: string[] = [];
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) completed.push(result[0].transcript.trim());
        else preview += result[0].transcript;
      }
      if (completed.length) appendRef.current(completed.filter(Boolean).join(' '));
      setInterim(preview);
    };
    current.onerror = (event) => {
      const errors: Record<string, string> = {
        'not-allowed':
          'Microphone access was denied. Allow it in your browser settings, or use system dictation.',
        'service-not-allowed':
          'The browser dictation service is unavailable. Use system dictation or type your answer.',
        'audio-capture': 'No microphone is available. Check your input device and try again.',
        'no-speech': 'No speech was detected. Try again when you are ready.',
        network:
          'The browser transcription service could not connect. Your typed text is preserved.',
      };
      if (event.error !== 'aborted')
        setMessage(
          errors[event.error] || 'Dictation stopped. Your text is preserved; you can try again.',
        );
    };
    current.onend = () => {
      recognition.current = null;
      setListening(false);
      setInterim('');
      listeningRef.current?.(false);
    };
    setListening(true);
    setMessage('Waiting for browser microphone access…');
    listeningRef.current?.(true);
    try {
      current.start();
    } catch {
      recognition.current = null;
      setListening(false);
      listeningRef.current?.(false);
      setMessage('Dictation could not start. Use system dictation or try again.');
    }
  };
  return (
    <div className="dictation-control">
      <button
        type="button"
        className={listening ? 'dictation-button listening' : 'dictation-button'}
        disabled={disabled && !listening}
        aria-pressed={listening}
        title={
          supported
            ? 'Browser dictation. Audio may be processed by your browser’s speech service. Review the text before sending.'
            : 'Dictation unavailable in this browser; use system dictation or type.'
        }
        onClick={() => (listening ? recognition.current?.stop() : start())}
      >
        {listening ? <Square size={14} /> : <Mic size={15} />}{' '}
        {listening ? 'Stop dictation' : supported ? label : 'Dictation unavailable'}
      </button>
      {(listening || message) && (
        <span className="dictation-status" role="status">
          {message ||
            interim ||
            'Listening… Text will appear in your draft. Nothing is sent automatically.'}
        </span>
      )}
    </div>
  );
}
