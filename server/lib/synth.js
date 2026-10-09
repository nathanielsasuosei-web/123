/**
 * Tiny drum-and-bass style beat synthesizer used to create the demo catalogue.
 * It writes real 16-bit WAV files, so no third-party audio is needed.
 */

const SAMPLE_RATE = 22050;

export function makeWav(samples, sampleRate = SAMPLE_RATE) {
  const dataLength = samples.length * 2;
  const buf = Buffer.alloc(44 + dataLength);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataLength, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataLength, 40);
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
  }
  return buf;
}

const midiToFreq = (m) => 440 * 2 ** ((m - 69) / 12);

/**
 * Renders `bars` bars of a beat.
 * @param {object} o
 * @param {number} o.bpm
 * @param {number} o.bars
 * @param {number} o.root   MIDI note of the tonic (e.g. 36 = C2)
 * @param {number} o.seed   changes the noise pattern
 * @param {number[][]} o.progression  chord offsets (semitones) per bar, 4 bars long
 * @param {number[]} o.kickSteps     16th-note steps where the kick hits
 */
export function renderBeat({ bpm, bars, root, seed, progression, kickSteps, snareSteps = [4, 12] }) {
  const sr = SAMPLE_RATE;
  const stepSec = 60 / bpm / 4;
  const total = Math.floor(bars * 16 * stepSec * sr) + sr; // +1s tail
  const out = new Float32Array(total);

  let state = seed >>> 0 || 1;
  const noise = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return (state / 4294967296) * 2 - 1;
  };

  const addTone = (startSample, length, sample) => {
    const end = Math.min(total, startSample + length);
    for (let i = startSample; i < end; i++) out[i] += sample(i - startSample);
  };

  let hatPrev = 0;
  for (let step = 0; step < bars * 16; step++) {
    const start = Math.floor(step * stepSec * sr);
    const stepInBar = step % 16;
    const bar = Math.floor(step / 16);
    const chord = progression[bar % progression.length];

    if (kickSteps.includes(stepInBar)) {
      addTone(start, Math.floor(0.4 * sr), (i) => {
        const t = i / sr;
        const phase = 2 * Math.PI * (48 * t + (110 / 25) * (1 - Math.exp(-25 * t)));
        return Math.sin(phase) * Math.exp(-t * 9) * 0.85;
      });
    }

    if (snareSteps.includes(stepInBar)) {
      addTone(start, Math.floor(0.25 * sr), (i) => {
        const t = i / sr;
        return noise() * Math.exp(-t * 22) * 0.32;
      });
    }

    // Hi-hats on every 16th, slightly louder on the off-beats.
    addTone(start, Math.floor(0.07 * sr), (i) => {
      const t = i / sr;
      const n = noise();
      const hp = n - hatPrev;
      hatPrev = n;
      return hp * Math.exp(-t * 70) * (stepInBar % 4 === 2 ? 0.17 : 0.11);
    });

    // Bass on every 8th note, following the chord root.
    if (stepInBar % 2 === 0) {
      const note = root + chord[0];
      const freq = midiToFreq(note);
      addTone(start, Math.floor(0.3 * sr), (i) => {
        const t = i / sr;
        const s = Math.sin(2 * Math.PI * freq * t) + 0.25 * Math.sin(4 * Math.PI * freq * t);
        return s * Math.exp(-t * 6) * 0.3;
      });
    }
  }

  // Pad chords, one per bar, with a soft attack and release.
  for (let bar = 0; bar < bars; bar++) {
    const chord = progression[bar % progression.length];
    const start = Math.floor(bar * 16 * stepSec * sr);
    const length = Math.floor(16 * stepSec * sr);
    for (const offset of chord) {
      const freq = midiToFreq(root + 12 + offset);
      addTone(start, length, (i) => {
        const env = Math.min(1, i / (0.05 * sr)) * Math.min(1, (length - i) / (0.2 * sr));
        return Math.sin(2 * Math.PI * freq * (i / sr)) * env * 0.05;
      });
    }
  }

  // Normalise to a comfortable peak level.
  let peak = 0;
  for (let i = 0; i < out.length; i++) peak = Math.max(peak, Math.abs(out[i]));
  const gain = peak ? 0.85 / peak : 1;
  for (let i = 0; i < out.length; i++) out[i] *= gain;
  return out;
}

export function renderWav(options) {
  return makeWav(renderBeat(options));
}

export { SAMPLE_RATE };
