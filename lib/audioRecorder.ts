"use client";

export type RecorderStatus =
  | "idle"
  | "recording"
  | "processing"
  | "speaking"
  | "error";

type AudioRecorderOptions = {
  onStatus?: (status: RecorderStatus) => void;
  onTranscript?: (text: string) => void;
  onError?: (message: string) => void;
};

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private chunks: Blob[] = [];
  private options: AudioRecorderOptions;

  constructor(options: AudioRecorderOptions = {}) {
    this.options = options;
  }

  async start(): Promise<void> {
    if (this.mediaRecorder?.state === "recording") {
      return;
    }

    try {
      // Ask the browser for microphone access.
      this.stream =
        await navigator.mediaDevices.getUserMedia({
          audio: true,
        });

      this.chunks = [];

      // Prefer WebM/Opus.
      const mimeType =
        "audio/webm;codecs=opus";

      if (
        !MediaRecorder.isTypeSupported(
          mimeType,
        )
      ) {
        this.mediaRecorder =
          new MediaRecorder(this.stream);
      } else {
        this.mediaRecorder =
          new MediaRecorder(
            this.stream,
            {
              mimeType,
            },
          );
      }

      this.mediaRecorder.ondataavailable =
        (event: BlobEvent) => {
          if (event.data.size > 0) {
            this.chunks.push(
              event.data,
            );
          }
        };

      this.mediaRecorder.onstart = () => {
        this.options.onStatus?.(
          "recording",
        );
      };

      this.mediaRecorder.onstop =
        async () => {
          await this.processRecording();
        };

      this.mediaRecorder.onerror =
        () => {
          this.options.onStatus?.(
            "error",
          );

          this.options.onError?.(
            "AUDIO RECORDING FAILED",
          );

          this.cleanup();
        };

      this.mediaRecorder.start();
    } catch (error) {
      console.error(
        "Microphone error:",
        error,
      );

      this.options.onStatus?.(
        "error",
      );

      if (
        error instanceof DOMException &&
        error.name === "NotAllowedError"
      ) {
        this.options.onError?.(
          "MICROPHONE ACCESS DENIED",
        );
      } else if (
        error instanceof DOMException &&
        error.name === "NotFoundError"
      ) {
        this.options.onError?.(
          "NO MICROPHONE FOUND",
        );
      } else {
        this.options.onError?.(
          "MICROPHONE INITIALIZATION FAILED",
        );
      }

      this.cleanup();
    }
  }

  stop(): void {
    if (
      !this.mediaRecorder ||
      this.mediaRecorder.state !==
        "recording"
    ) {
      return;
    }

    this.mediaRecorder.stop();
  }

  private async processRecording(): Promise<void> {
    if (this.chunks.length === 0) {
      this.options.onError?.(
        "NO AUDIO RECORDED",
      );

      this.options.onStatus?.(
        "error",
      );

      this.cleanup();

      return;
    }

    this.options.onStatus?.(
      "processing",
    );

    try {
      const audioBlob = new Blob(
        this.chunks,
        {
          type:
            this.mediaRecorder?.mimeType ||
            "audio/webm",
        },
      );

      const formData = new FormData();

      formData.append(
        "audio",
        audioBlob,
        "ultron-voice.webm",
      );

      const response = await fetch(
        "/api/transcribe",
        {
          method: "POST",
          body: formData,
        },
      );

      if (!response.ok) {
        throw new Error(
          "Transcription request failed",
        );
      }

      const data = await response.json();

      if (
        !data.text ||
        typeof data.text !== "string"
      ) {
        throw new Error(
          "No transcription returned",
        );
      }

      this.options.onTranscript?.(
        data.text.trim(),
      );

      this.options.onStatus?.(
        "idle",
      );
    } catch (error) {
      console.error(
        "Transcription error:",
        error,
      );

      this.options.onStatus?.(
        "error",
      );

      this.options.onError?.(
        "SPEECH TRANSCRIPTION FAILED",
      );
    } finally {
      this.cleanup();
    }
  }

  private cleanup(): void {
    if (this.stream) {
      this.stream
        .getTracks()
        .forEach((track) => {
          track.stop();
        });
    }

    this.stream = null;
    this.mediaRecorder = null;
    this.chunks = [];
  }

  destroy(): void {
    if (this.mediaRecorder) {
      if (
        this.mediaRecorder.state ===
        "recording"
      ) {
        this.mediaRecorder.stop();
      }
    }

    this.cleanup();
  }

  get isRecording(): boolean {
    return (
      this.mediaRecorder?.state ===
      "recording"
    );
  }
}