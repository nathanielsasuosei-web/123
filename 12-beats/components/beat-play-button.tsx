"use client";

import { useEffect, useRef, useState } from "react";

/** Only one preview plays at a time across the whole page. */
let activeAudio: HTMLAudioElement | null = null;
let activePause: (() => void) | null = null;

export function BeatPlayButton({ src, title, size = "md" }: { src: string; title: string; size?: "md" | "lg" }) {
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!src) return;
    const audio = new Audio(src);
    audio.preload = "none";
    audioRef.current = audio;
    const onEnded = () => setPlaying(false);
    const onError = () => {
      setPlaying(false);
      setFailed(true);
    };
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    return () => {
      audio.pause();
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      if (activeAudio === audio) {
        activeAudio = null;
        activePause = null;
      }
    };
  }, [src]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio || failed) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }
    if (activeAudio && activeAudio !== audio) {
      activeAudio.pause();
      activePause?.();
    }
    activeAudio = audio;
    activePause = () => setPlaying(false);
    audio
      .play()
      .then(() => setPlaying(true))
      .catch(() => setFailed(true));
  };

  const dimension = size === "lg" ? "h-14 w-14" : "h-11 w-11";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={failed ? `${title} preview unavailable` : playing ? `Pause ${title}` : `Preview ${title}`}
      title={failed ? "Preview unavailable" : playing ? "Pause preview" : "Preview this beat"}
      className={`${dimension} grid cursor-pointer place-items-center rounded-full border border-white/20 bg-ink/70 text-body backdrop-blur transition hover:border-accent hover:text-accent ${
        playing ? "border-accent text-accent" : ""
      }`}
    >
      {failed ? (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 8v5m0 3.5h.01" strokeLinecap="round" />
          <circle cx="12" cy="12" r="9" />
        </svg>
      ) : playing ? (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
          <rect x="6" y="5" width="4" height="14" rx="1.2" />
          <rect x="14" y="5" width="4" height="14" rx="1.2" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="ml-0.5 h-5 w-5" fill="currentColor">
          <path d="M8 5.5v13a1 1 0 0 0 1.5.87l10-6.5a1 1 0 0 0 0-1.74l-10-6.5A1 1 0 0 0 8 5.5Z" />
        </svg>
      )}
    </button>
  );
}
