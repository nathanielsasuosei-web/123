#!/usr/bin/env python3
"""Generates the demo catalogue media (short beats + cover art).

Everything here is synthesised from scratch — no samples, no third-party audio —
so the demo content is safe to ship in the repository.

    python3 scripts/generate-demo-media.py

Writes:
    public/demo/beats/<slug>.mp3    short loops (mono, 96 kbps)
    public/demo/covers/<slug>.svg   abstract cover art
"""
from __future__ import annotations

import math
import os
import wave
from dataclasses import dataclass, field

import lameenc
import numpy as np

SR = 32000
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BEAT_DIR = os.path.join(ROOT, "public", "demo", "beats")
COVER_DIR = os.path.join(ROOT, "public", "demo", "covers")

# Semitone offsets for the scales used below.
MINOR = [0, 2, 3, 5, 7, 8, 10]
MAJOR = [0, 2, 4, 5, 7, 9, 11]
PENTATONIC_MINOR = [0, 3, 5, 7, 10]
PENTATONIC_MAJOR = [0, 2, 4, 7, 9]


@dataclass
class Beat:
    slug: str
    title: str
    genre: str
    bpm: int
    root_midi: int
    scale: str
    style: str
    bars: int = 4
    swing: float = 0.0
    seed: int = 7
    keys: list = field(default_factory=list)


BEATS = [
    Beat("accra-nights", "Accra Nights", "Afrobeats", 102, 54, "minor", "afrobeats", swing=0.06, seed=11),
    Beat("trotro-anthem", "Trotro Anthem", "Afro-fusion", 110, 57, "minor", "afrobeats", swing=0.04, seed=23),
    Beat("harmattan", "Harmattan", "Trap", 140, 49, "minor", "trap", swing=0.0, seed=31),
    Beat("highlife-sunset", "Highlife Sunset", "Highlife", 118, 55, "major", "highlife", swing=0.08, seed=41),
    Beat("midnight-in-osu", "Midnight In Osu", "R&B", 88, 52, "minor", "rnb", swing=0.12, seed=53),
    Beat("kpanlogo-drums", "Kpanlogo Drums", "Afro percussion", 96, 50, "minor", "percussion", swing=0.05, seed=67),
]


def midi_to_hz(midi: float) -> float:
    return 440.0 * (2.0 ** ((midi - 69) / 12.0))


def note(scale: str, root_midi: int, degree: int, octave: int = 0) -> float:
    table = MAJOR if scale == "major" else MINOR
    index = degree % len(table)
    shift = 12 * (degree // len(table)) + 12 * octave
    return midi_to_hz(root_midi + table[index] + shift)


def env(length: int, attack: float, decay: float) -> np.ndarray:
    t = np.arange(length) / SR
    a = np.clip(t / max(attack, 1e-4), 0.0, 1.0)
    d = np.exp(-t / max(decay, 1e-4))
    return a * d


def kick(duration: float = 0.42) -> np.ndarray:
    n = int(duration * SR)
    t = np.arange(n) / SR
    freq = 128.0 * np.exp(-t * 26.0) + 46.0
    phase = np.cumsum(2 * np.pi * freq / SR)
    body = np.sin(phase) * np.exp(-t * 7.5)
    click = np.random.default_rng(1).normal(0, 1, n) * np.exp(-t * 180) * 0.35
    return np.tanh((body + click) * 1.4) * 0.95


def snare(duration: float = 0.3) -> np.ndarray:
    n = int(duration * SR)
    t = np.arange(n) / SR
    noise = np.random.default_rng(2).normal(0, 1, n)
    noise = np.diff(np.concatenate([[0.0], noise]))  # brighten
    tone = np.sin(2 * np.pi * 190 * t) * 0.5
    return (noise * 0.55 + tone) * np.exp(-t * 26) * 0.8


def hat(duration: float = 0.07, tone: float = 1.0) -> np.ndarray:
    n = int(duration * SR)
    t = np.arange(n) / SR
    noise = np.random.default_rng(3).normal(0, 1, n)
    noise = np.diff(np.concatenate([[0.0, 0.0], noise]))[:n]
    return noise * np.exp(-t * 95) * 0.32 * tone


def shaker(duration: float = 0.14) -> np.ndarray:
    n = int(duration * SR)
    t = np.arange(n) / SR
    noise = np.random.default_rng(4).normal(0, 1, n)
    noise = np.convolve(noise, np.array([1.0, -0.7]), mode="same")
    return noise * (np.exp(-t * 40) - np.exp(-t * 12)) * 0.30


def tom(midi: float, duration: float = 0.35) -> np.ndarray:
    n = int(duration * SR)
    t = np.arange(n) / SR
    freq = midi_to_hz(midi) * (1 + 0.5 * np.exp(-t * 18))
    phase = np.cumsum(2 * np.pi * freq / SR)
    return np.sin(phase) * np.exp(-t * 9) * 0.55


def bass_note(freq: float, duration: float, decay: float = 0.32) -> np.ndarray:
    n = int(duration * SR)
    t = np.arange(n) / SR
    wave_sound = np.sin(2 * np.pi * freq * t) + 0.25 * np.sin(4 * np.pi * freq * t)
    return np.tanh(wave_sound * 1.6) * env(n, 0.006, decay) * 0.55


def pluck(freq: float, duration: float) -> np.ndarray:
    n = int(duration * SR)
    t = np.arange(n) / SR
    partials = [1.0, 0.5, 0.32, 0.2, 0.12]
    sound = sum(a * np.sin(2 * np.pi * freq * (i + 1) * t) for i, a in enumerate(partials))
    return sound * env(n, 0.004, 0.22) * 0.22


def pad(freqs: list[float], duration: float) -> np.ndarray:
    n = int(duration * SR)
    t = np.arange(n) / SR
    sound = np.zeros(n)
    for freq in freqs:
        detune = 1.0 + 0.0015
        sound += np.sin(2 * np.pi * freq * t) + 0.6 * np.sin(2 * np.pi * freq * detune * t)
    sound /= max(len(freqs), 1)
    return sound * (np.clip(t / 0.35, 0, 1) * np.exp(-t * 0.55)) * 0.20


def soften_highs(samples: np.ndarray, cutoff: float = 8500.0) -> np.ndarray:
    """One-pole low-pass applied in the frequency domain, to take the edge off the hats."""
    spectrum = np.fft.rfft(samples)
    freqs = np.fft.rfftfreq(len(samples), 1.0 / SR)
    return np.fft.irfft(spectrum / np.sqrt(1.0 + (freqs / cutoff) ** 2), n=len(samples))


def add(buffer: np.ndarray, sound: np.ndarray, at_seconds: float, gain: float = 1.0) -> None:
    start = int(at_seconds * SR)
    end = min(start + len(sound), len(buffer))
    if start >= len(buffer) or end <= start:
        return
    buffer[start:end] += sound[: end - start] * gain


PERCUSSION_GRID = {
    # step -> instruments, 16 steps per bar
    "afrobeats": {
        "kick": [0, 3, 6, 10, 12],
        "snare": [4, 12],
        "hat": [2, 6, 10, 14],
        "shaker": [1, 3, 5, 7, 9, 11, 13, 15],
    },
    "trap": {
        "kick": [0, 6, 10],
        "snare": [8],
        "hat": [i for i in range(16)],
        "shaker": [],
    },
    "highlife": {
        "kick": [0, 8],
        "snare": [4, 12],
        "hat": [0, 2, 4, 6, 8, 10, 12, 14],
        "shaker": [3, 7, 11, 15],
    },
    "rnb": {
        "kick": [0, 7],
        "snare": [4, 12],
        "hat": [2, 6, 10, 14],
        "shaker": [1, 5, 9, 13],
    },
    "percussion": {
        "kick": [0, 3, 6, 9, 12],
        "snare": [4, 12],
        "hat": [1, 2, 5, 6, 9, 10, 13, 14],
        "shaker": [i for i in range(0, 16, 2)],
    },
}

BASS_PATTERNS = {
    "afrobeats": [0, None, 0, 2, None, 4, None, 3],
    "trap": [0, None, None, 0, None, 5, None, None],
    "highlife": [0, 2, 4, 2, 0, 4, 2, 4],
    "rnb": [0, None, 2, None, 3, None, 4, None],
    "percussion": [0, None, 0, None, 3, None, 3, None],
}


def build_beat(beat: Beat) -> np.ndarray:
    rng = np.random.default_rng(beat.seed)
    seconds_per_beat = 60.0 / beat.bpm
    bar_seconds = seconds_per_beat * 4
    total = beat.bars * bar_seconds
    buffer = np.zeros(int(total * SR) + SR // 2)

    grid = PERCUSSION_GRID[beat.style]
    kick_sound = kick()
    snare_sound = snare()
    hat_sound = hat()
    shaker_sound = shaker()
    percussive = beat.style == "percussion"

    for bar in range(beat.bars):
        bar_start = bar * bar_seconds
        intensity = 0.75 if bar == 0 else (1.0 if bar < beat.bars - 1 else 1.05)
        for instrument, steps in grid.items():
            for step in steps:
                swing = beat.swing * seconds_per_beat * 0.5 if step % 2 else 0.0
                at = bar_start + (step / 4.0) * seconds_per_beat + swing
                if instrument == "kick":
                    add(buffer, kick_sound, at, 0.95 * intensity)
                elif instrument == "snare":
                    add(buffer, snare_sound, at, 0.55 * intensity)
                elif instrument == "hat":
                    accent = 1.0 if step % 4 == 0 else 0.7
                    add(buffer, hat_sound, at, 0.65 * accent * intensity)
                elif instrument == "shaker":
                    add(buffer, shaker_sound, at, 0.5 * intensity)

    # Bass line.
    pattern = BASS_PATTERNS[beat.style]
    for bar in range(beat.bars):
        for index, degree in enumerate(pattern):
            if degree is None:
                continue
            at = bar * bar_seconds + index * (bar_seconds / len(pattern))
            freq = note(beat.scale, beat.root_midi - 12, degree)
            add(buffer, bass_note(freq, seconds_per_beat * 0.9), at, 0.9)

    # Chords from bar 2 onwards.
    chord_degrees = [0, 5, 3, 4]
    for bar in range(beat.bars):
        if bar == 0 and beat.style not in ("rnb",):
            continue
        degree = chord_degrees[bar % len(chord_degrees)]
        freqs = [note(beat.scale, beat.root_midi, degree + offset) for offset in (0, 2, 4)]
        add(buffer, pad(freqs, bar_seconds), bar * bar_seconds, 0.8)

    # Melodic plucks / percussion flourishes.
    pentatonic = PENTATONIC_MAJOR if beat.scale == "major" else PENTATONIC_MINOR
    if beat.style in ("afrobeats", "highlife"):
        for bar in range(beat.bars):
            for _ in range(6):
                step = int(rng.integers(0, 16))
                degree = int(rng.choice(pentatonic))
                at = bar * bar_seconds + (step / 4.0) * seconds_per_beat
                add(buffer, pluck(note(beat.scale, beat.root_midi, degree, octave=1), 0.5), at, 0.75)
    if percussive:
        for bar in range(beat.bars):
            for step in (5, 11, 13, 15):
                at = bar * bar_seconds + (step / 4.0) * seconds_per_beat
                degree = int(rng.choice(pentatonic))
                add(buffer, tom(beat.root_midi + 12 + degree, 0.4), at, 0.8)

    # Master: gentle high shelf, soft clip, head/tail fades, normalise.
    mix = soften_highs(np.tanh(buffer * 1.15))
    fade = int(0.03 * SR)
    mix[:fade] *= np.linspace(0, 1, fade)
    mix[-fade:] *= np.linspace(1, 0, fade)
    peak = float(np.max(np.abs(mix))) or 1.0
    mix = mix / peak * 0.92
    return mix.astype(np.float32)


def write_mp3(path: str, samples: np.ndarray) -> None:
    pcm = np.clip(samples, -1.0, 1.0)
    pcm = (pcm * 32767).astype("<i2").tobytes()
    encoder = lameenc.Encoder()
    encoder.set_bit_rate(96)
    encoder.set_in_sample_rate(SR)
    encoder.set_channels(1)
    encoder.set_quality(5)
    encoder.silence()
    data = encoder.encode(pcm)
    data += encoder.flush()
    with open(path, "wb") as handle:
        handle.write(bytes(data))


COVER_PALETTES = [
    ("#ff5d8f", "#7c5cff", "#12030f"),
    ("#39c5ff", "#7c5cff", "#04101c"),
    ("#ffd166", "#ff5d8f", "#1a0b02"),
    ("#36d399", "#39c5ff", "#02140f"),
    ("#c084fc", "#ff5d8f", "#150318"),
    ("#ff8f4d", "#ffd166", "#180a03"),
]


def write_cover(path: str, beat: Beat, index: int) -> None:
    c1, c2, bg = COVER_PALETTES[index % len(COVER_PALETTES)]
    rng = np.random.default_rng(beat.seed)
    bars = ""
    x = 90
    for _ in range(22):
        height = float(rng.integers(80, 460))
        width = 26
        y = 640 - height
        bars += f'<rect x="{x}" y="{y:.0f}" width="{width}" height="{height:.0f}" rx="13" fill="url(#bar)" opacity="0.85"/>'
        x += width + 16
    rings = ""
    for ring in range(3):
        rings += (
            f'<circle cx="600" cy="430" r="{150 + ring * 120}" fill="none" '
            f'stroke="{c1}" stroke-width="2" opacity="{0.35 - ring * 0.09:.2f}"/>'
        )
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 1200" width="1200" height="1200" role="img" aria-label="Cover art for {beat.title}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="{bg}"/>
      <stop offset="100%" stop-color="#0b0b12"/>
    </linearGradient>
    <linearGradient id="mark" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="{c1}"/>
      <stop offset="100%" stop-color="{c2}"/>
    </linearGradient>
    <linearGradient id="bar" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0%" stop-color="{c2}" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="{c1}"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="1200" fill="url(#bg)"/>
  <g opacity="0.9">{rings}</g>
  <g transform="translate(0,120)">{bars}</g>
  <rect x="90" y="760" width="1020" height="2" fill="{c1}" opacity="0.25"/>
  <text x="90" y="900" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif" font-size="96" font-weight="800" fill="#f2f2f7" letter-spacing="-2">{beat.title}</text>
  <text x="90" y="972" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif" font-size="42" font-weight="600" fill="{c1}">{beat.genre.upper()} · {beat.bpm} BPM</text>
  <g transform="translate(90,1030)">
    <rect width="112" height="112" rx="30" fill="url(#mark)"/>
    <text x="56" y="76" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif" font-size="58" font-weight="800" fill="#ffffff">12</text>
  </g>
</svg>
"""
    with open(path, "w", encoding="utf-8") as handle:
        handle.write(svg)


def main() -> None:
    os.makedirs(BEAT_DIR, exist_ok=True)
    os.makedirs(COVER_DIR, exist_ok=True)
    for index, beat in enumerate(BEATS):
        samples = build_beat(beat)
        mp3_path = os.path.join(BEAT_DIR, f"{beat.slug}.mp3")
        write_mp3(mp3_path, samples)
        write_cover(os.path.join(COVER_DIR, f"{beat.slug}.svg"), beat, index)
        seconds = len(samples) / SR
        print(f"{beat.slug:20s} {beat.genre:16s} {beat.bpm:3d} BPM  {seconds:4.1f}s  {os.path.getsize(mp3_path) / 1024:6.1f} KB")


if __name__ == "__main__":
    main()
