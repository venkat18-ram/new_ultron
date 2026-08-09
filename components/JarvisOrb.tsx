"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createOrbScene, type OrbSceneApi } from "@/lib/orbScene";
import { HandTracker, type TrackerStatus } from "@/lib/handTracker";
import {
  AudioRecorder,
  type RecorderStatus,
} from "@/lib/audioRecorder";

type CameraState = "off" | "starting" | "on" | "error";

const MODE_LABEL: Record<TrackerStatus["mode"], string> = {
  idle: "STANDBY",
  spin: "SPIN",
  zoom: "ZOOM",
};

export default function JarvisOrb() {
  // ==========================================
  // REFERENCES
  // ==========================================

  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);

  const sceneRef = useRef<OrbSceneApi | null>(null);
  const trackerRef = useRef<HandTracker | null>(null);

  // VOICE REF
const recorderRef =
  useRef<AudioRecorder | null>(null);
  // ==========================================
  // CAMERA STATE
  // ==========================================

  const [camera, setCamera] =
    useState<CameraState>("off");

  const [status, setStatus] = useState<{
    hands: number;
    mode: TrackerStatus["mode"];
  }>({
    hands: 0,
    mode: "idle",
  });

  const [error, setError] =
    useState<string | null>(null);

  // ==========================================
  // VOICE STATE
  // ==========================================

 const [voiceStatus, setVoiceStatus] =
  useState<RecorderStatus>("idle");

  const [transcript, setTranscript] =
    useState("");

  const [voiceError, setVoiceError] =
    useState<string | null>(null);

  // ==========================================
  // CREATE ORB SCENE
  // ==========================================

  useEffect(() => {
    const container = containerRef.current;

    if (!container) return;

    const scene = createOrbScene(container);

    sceneRef.current = scene;

    return () => {
      trackerRef.current?.stop();
      trackerRef.current = null;

      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  // ==========================================
  // STOP HAND GESTURES
  // ==========================================

  const stopGestures = useCallback(() => {
    trackerRef.current?.stop();
    trackerRef.current = null;

    setCamera("off");

    setStatus({
      hands: 0,
      mode: "idle",
    });
  }, []);

  // ==========================================
  // START HAND GESTURES
  // ==========================================

  const startGestures = useCallback(async () => {
    const video = videoRef.current;
    const overlay = overlayRef.current;

    if (!video || !overlay || trackerRef.current) {
      return;
    }

    setCamera("starting");
    setError(null);

    const tracker = new HandTracker(
      video,
      overlay,
      {
        onRotate: (dt, dp) => {
          sceneRef.current?.rotateBy(dt, dp);
        },

        onZoom: (factor) => {
          sceneRef.current?.zoomBy(factor);
        },

        onStatus: setStatus,
      },
    );

    trackerRef.current = tracker;

    try {
      await tracker.start();

      setCamera("on");
    } catch (err) {
      trackerRef.current = null;

      tracker.stop();

      setCamera("error");

      setError(
        err instanceof DOMException &&
          err.name === "NotAllowedError"
          ? "CAMERA ACCESS DENIED"
          : "TRACKING INIT FAILED",
      );
    }
  }, []);

  // ==========================================
  // TOGGLE HAND GESTURES
  // ==========================================

  const toggleGestures = useCallback(() => {
    if (trackerRef.current) {
      stopGestures();
    } else {
      void startGestures();
    }
  }, [startGestures, stopGestures]);

  // ==========================================
  // VOICE ASSISTANT
  // ==========================================

  // ==========================================
// ULTRON VOICE OUTPUT
// ==========================================

const speakResponse = useCallback(
  (text: string) => {
    if (typeof window === "undefined") {
      return;
    }

    if (!("speechSynthesis" in window)) {
      setVoiceError(
        "SPEECH OUTPUT NOT SUPPORTED",
      );
      setVoiceStatus("error");
      return;
    }

    window.speechSynthesis.cancel();

    const utterance =
      new SpeechSynthesisUtterance(text);

    utterance.lang = "en-US";
    utterance.rate = 0.95;
    utterance.pitch = 0.85;
    utterance.volume = 1;

    utterance.onstart = () => {
      setVoiceStatus("speaking");
    };

    utterance.onend = () => {
      setVoiceStatus("idle");
    };

    utterance.onerror = () => {
      setVoiceError(
        "VOICE OUTPUT FAILED",
      );
      setVoiceStatus("error");
    };

    window.speechSynthesis.speak(
      utterance,
    );
  },
  [],
);


// ==========================================
// AUDIO RECORDER
// ==========================================

useEffect(() => {
  const recorder = new AudioRecorder({
    
    // -----------------------------
    // Recorder status
    // -----------------------------

    onStatus: (status: RecorderStatus) => {
      setVoiceStatus(status);
    },

    // -----------------------------
    // USER SPOKE SOMETHING
    // -----------------------------

    onTranscript: async (text: string) => {
      console.log("USER:", text);

      setTranscript(text);
      setVoiceError(null);
      setVoiceStatus("processing");

      try {
        const response = await fetch(
          "/api/assistant",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              message: text,
            }),
          },
        );

        if (!response.ok) {
          throw new Error(
            "Assistant request failed",
          );
        }

        const data =
          await response.json();

        const reply =
          typeof data.reply === "string"
            ? data.reply.trim()
            : "";

        console.log(
          "ULTRON:",
          reply,
        );

        if (!reply) {
          throw new Error(
            "Assistant returned no reply",
          );
        }

        // Make Ultron speak
        speakResponse(reply);

      } catch (error) {
        console.error(
          "Assistant error:",
          error,
        );

        setVoiceError(
          "AI RESPONSE FAILED",
        );

        setVoiceStatus("error");
      }
    },

    // -----------------------------
    // VOICE ERROR
    // -----------------------------

    onError: (message: string) => {
      setVoiceError(message);
      setVoiceStatus("error");
    },
  });

  recorderRef.current = recorder;

  // Cleanup
  return () => {
    recorder.destroy();
    recorderRef.current = null;
  };
}, [speakResponse]);


// ==========================================
// START VOICE
// ==========================================

const startVoice = useCallback(
  async () => {
    setVoiceError(null);
    setTranscript("");

    await recorderRef.current?.start();
  },
  [],
);


// ==========================================
// STOP VOICE
// ==========================================

const stopVoice = useCallback(() => {
  recorderRef.current?.stop();

  window.speechSynthesis?.cancel();

  setVoiceStatus("idle");
}, []);


// ==========================================
// TOGGLE VOICE
// ==========================================

const toggleVoice = useCallback(() => {
  if (voiceStatus === "recording") {
    stopVoice();
    return;
  }

  if (
    voiceStatus === "idle" ||
    voiceStatus === "error"
  ) {
    void startVoice();
  }
}, [
  voiceStatus,
  startVoice,
  stopVoice,
]);

  // ==========================================
  // KEYBOARD CONTROLS
  // ==========================================

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case "+":
        case "=":
          sceneRef.current?.zoomIn();
          break;

        case "-":
        case "_":
          sceneRef.current?.zoomOut();
          break;

        case "r":
        case "R":
          sceneRef.current?.resetView();
          break;

        case "g":
        case "G":
          toggleGestures();
          break;

        case "v":
        case "V":
          toggleVoice();
          break;
      }
    };

    window.addEventListener(
      "keydown",
      onKey,
    );

    return () => {
      window.removeEventListener(
        "keydown",
        onKey,
      );
    };
  }, [
    toggleGestures,
    toggleVoice,
  ]);

  // ==========================================
  // CAMERA STATUS
  // ==========================================

  const cameraOn = camera === "on";

  // ==========================================
  // UI
  // ==========================================

  return (
    <>
      <div className="overlay-vignette" />

      <div className="overlay-grain" />

      <div className="overlay-scanlines" />

      {/* ================================= */}
      {/* TITLE */}
      {/* ================================= */}

      <div className="hud hud-title">
        U.L.T.R.O.N.
      </div>

      {/* ================================= */}
      {/* CONTROLS HELP */}
      {/* ================================= */}

      <div className="hud hud-hint">
        <div>
          <span className="key">
            DRAG
          </span>{" "}
          spin&nbsp;&nbsp;

          <span className="key">
            SCROLL
          </span>{" "}
          zoom
        </div>

        {cameraOn ? (
          <div>
            <span className="key">
              PINCH + MOVE
            </span>{" "}
            spin&nbsp;&nbsp;

            <span className="key">
              PINCH BOTH HANDS ± SPREAD
            </span>{" "}
            zoom
          </div>
        ) : (
          <div>
            <span className="key">
              G
            </span>{" "}
            hand gestures&nbsp;&nbsp;

            <span className="key">
              V
            </span>{" "}
            voice&nbsp;&nbsp;

            <span className="key">
              R
            </span>{" "}
            reset&nbsp;&nbsp;

            <span className="key">
              +/−
            </span>{" "}
            zoom
          </div>
        )}
      </div>

      {/* ================================= */}
      {/* CONTROLS */}
      {/* ================================= */}

      <div className="hud hud-controls">

        {/* CAMERA PANEL */}

        <div
          className={`camera-panel${
            cameraOn ? " visible" : ""
          }`}
        >
          <video
            ref={videoRef}
            muted
            playsInline
            className="camera-video"
          />

          <canvas
            ref={overlayRef}
            width={208}
            height={156}
            className="camera-overlay"
          />

          <div className="camera-status">
            {status.hands > 0
              ? `${status.hands} HAND${
                  status.hands > 1
                    ? "S"
                    : ""
                } · ${
                  MODE_LABEL[
                    status.mode
                  ]
                }`
              : "SHOW HANDS"}
          </div>
        </div>

        {/* CAMERA ERROR */}

        {error && (
          <div className="hud-error">
            {error}
          </div>
        )}

        {/* GESTURES BUTTON */}

        <div className="hud-row">
          <button
            type="button"
            className="hud-btn"
            aria-pressed={cameraOn}
            onClick={toggleGestures}
            disabled={
              camera === "starting"
            }
          >
            {camera === "starting"
              ? "INITIALIZING…"
              : cameraOn
                ? "GESTURES ON"
                : "GESTURES OFF"}
          </button>
        </div>

        {/* ZOOM / RESET */}

        <div className="hud-row">
          <button
            type="button"
            className="hud-btn"
            onClick={() =>
              sceneRef.current?.zoomIn()
            }
            aria-label="Zoom in"
          >
            +
          </button>

          <button
            type="button"
            className="hud-btn"
            onClick={() =>
              sceneRef.current?.zoomOut()
            }
            aria-label="Zoom out"
          >
            −
          </button>

          <button
            type="button"
            className="hud-btn"
            onClick={() =>
              sceneRef.current?.resetView()
            }
          >
            RESET
          </button>
        </div>

        {/* ================================= */}
        {/* VOICE BUTTON */}
        {/* ================================= */}

        <div className="hud-row">
        <button
  type="button"
  className={`hud-btn ${
    voiceStatus === "recording"
      ? "active"
      : ""
  }`}
  onClick={toggleVoice}
  disabled={
    voiceStatus === "processing" ||
    voiceStatus === "speaking"
  }
>
  {voiceStatus === "recording"
    ? "VOICE RECORDING..."
    : voiceStatus === "processing"
      ? "TRANSCRIBING..."
      : voiceStatus === "speaking"
        ? "ULTRON SPEAKING..."
        : voiceStatus === "error"
          ? "VOICE RETRY"
          : "VOICE ASSIST"}
</button>
        </div>

        {/* ================================= */}
        {/* TRANSCRIPT */}
        {/* ================================= */}

        {transcript && (
          <div className="voice-transcript">
            <span>YOU:</span>{" "}
            {transcript}
          </div>
        )}

        {/* ================================= */}
        {/* VOICE ERROR */}
        {/* ================================= */}

        {voiceError && (
          <div className="hud-error">
            {voiceError}
          </div>
        )}
      </div>

      {/* ================================= */}
      {/* ORB CONTAINER */}
      {/* ================================= */}

      <div
        ref={containerRef}
        className="orb-container"
      />
    </>
  );
}