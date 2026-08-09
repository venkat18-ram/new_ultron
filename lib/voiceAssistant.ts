"use client";

export type VoiceStatus =
  | "idle"
  | "listening"
  | "processing"
  | "speaking"
  | "error";

type VoiceAssistantOptions = {
  language?: string;
  onStatus?: (status: VoiceStatus) => void;
  onTranscript?: (text: string) => void;
  onError?: (message: string) => void;
};

type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

export class VoiceAssistant {
  private recognition: SpeechRecognitionInstance | null = null;
  private options: VoiceAssistantOptions;
  private listening = false;
  private starting = false;

  constructor(options: VoiceAssistantOptions = {}) {
    this.options = {
      language: "en-US",
      ...options,
    };

    if (typeof window === "undefined") return;

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      this.options.onError?.(
        "Speech recognition is not supported in this browser.",
      );
      return;
    }

    this.recognition =new (
      SpeechRecognition as SpeechRecognitionConstructor
    )();

    this.recognition.lang = this.options.language!;
    this.recognition.continuous = false;
    this.recognition.interimResults = false;
    this.recognition.maxAlternatives = 1;

    this.recognition.onstart = () => {
  this.starting = false;
  this.listening = true;

  console.log(
    "ULTRON VOICE: LISTENING",
  );

  this.options.onStatus?.("listening");
};

    this.recognition.onresult = (event: any) => {
      const transcript =
        event.results?.[0]?.[0]?.transcript?.trim() || "";

      if (transcript) {
        this.options.onTranscript?.(transcript);
      }
    };

   this.recognition.onerror = (event: any) => {
  // IMPORTANT:
  // Reset both states whenever recognition fails.
  this.starting = false;
  this.listening = false;

  let message = "VOICE INPUT ERROR";
  switch (event?.error) {
    case "not-allowed":
      message = "MICROPHONE ACCESS DENIED";
      break;

    case "no-speech":
      message = "NO SPEECH DETECTED";
      break;

    case "audio-capture":
      message = "NO MICROPHONE FOUND";
      break;

    case "network":
      message =
        "VOICE SERVICE NETWORK ERROR";
      break;

    case "aborted":
      message = "VOICE INPUT STOPPED";
      break;

    default:
      message =
        `VOICE INPUT ERROR: ${
          event?.error ?? "UNKNOWN"
        }`;
      break;
  }

  this.options.onError?.(message);
  this.options.onStatus?.("error");
};

    this.recognition.onend = () => {
  this.starting = false;
  this.listening = false;

  console.log(
    "ULTRON VOICE: LISTENING ENDED",
  );

  this.options.onStatus?.("idle");
};
  }

  start(): void {
  if (!this.recognition) {
    this.options.onError?.(
      "Speech recognition is not supported in this browser.",
    );
    return;
  }

  // Already listening or currently starting.
  if (this.listening || this.starting) {
    console.log(
      "Voice recognition is already active.",
    );
    return;
  }

  this.starting = true;

  try {
    this.recognition.start();
  } catch (error: any) {
    this.starting = false;

    // Browser throws this when start() is called
    // while recognition is already active.
    if (error?.name === "InvalidStateError") {
      console.warn(
        "Speech recognition is already running.",
      );

      this.listening = true;
      return;
    }

    console.error(
      "Voice start error:",
      error,
    );

    this.options.onError?.(
      "VOICE START FAILED",
    );

    this.options.onStatus?.("error");
  }
}

  stop(): void {
  if (!this.recognition) {
    return;
  }

  this.starting = false;

  if (!this.listening) {
    return;
  }

  try {
    this.recognition.stop();
  } catch (error) {
    console.warn(
      "Voice stop error:",
      error,
    );
  }

  this.listening = false;

  this.options.onStatus?.("idle");
}

  destroy(): void {
  this.starting = false;
  this.listening = false;

  if (this.recognition) {
    try {
      this.recognition.abort();
    } catch (error) {
      console.warn(
        "Voice destroy error:",
        error,
      );
    }
  }

  this.recognition = null;

  if (typeof window !== "undefined") {
    window.speechSynthesis?.cancel();
  }
}

  speak(text: string) {
    if (typeof window === "undefined") return;
    if (!("speechSynthesis" in window)) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);

    utterance.lang = this.options.language || "en-US";
    utterance.rate = 0.95;
    utterance.pitch = 0.85;
    utterance.volume = 1;

    utterance.onstart = () => {
      this.options.onStatus?.("speaking");
    };

    utterance.onend = () => {
      this.options.onStatus?.("idle");
    };

    utterance.onerror = () => {
      this.options.onStatus?.("error");
    };

    window.speechSynthesis.speak(utterance);
  }

  stopSpeaking() {
    if (typeof window === "undefined") return;

    window.speechSynthesis?.cancel();
    this.options.onStatus?.("idle");
  }

  get isListening() {
    return this.listening;
  }
}