/**
 * Small drum + bass + pad synthesizer used only for the demo catalogue.
 * Produces real 16-bit WAV files, so no third-party audio is needed.
 */
const SR = 22050;

function wav(samples) {
  const dataLen = samples.length * 2;
  const buf = Buffer.alloc(44 + dataLen);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + dataLen, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(dataLen, 40);
  for (let i = 0; i < samples.length; i++) {
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i])) * 32767), 44 + i * 2);
  }
  return buf;
}

const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

export function renderWav({ bpm, bars, root, seed, progression, kick }) {
  const stepSec = 60 / bpm / 4;
  const out = new Float32Array(Math.floor(bars * 16 * stepSec * SR) + SR);
  let s = seed >>> 0 || 1;
  const noise = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return (s / 4294967296) * 2 - 1;
  };
  const add = (start, len, fn) => {
    for (let i = start; i < Math.min(out.length, start + len); i++) out[i] += fn(i - start);
  };

  let hatPrev = 0;
  for (let step = 0; step < bars * 16; step++) {
    const start = Math.floor(step * stepSec * SR);
    const inBar = step % 16;
    const chord = progression[Math.floor(step / 16) % progression.length];

    if (kick.includes(inBar)) {
      add(start, 0.4 * SR, (i) => {
        const t = i / SR;
        return Math.sin(2 * Math.PI * (48 * t + (110 / 25) * (1 - Math.exp(-25 * t)))) * Math.exp(-t * 9) * 0.85;
      });
    }
    if (inBar === 4 || inBar === 12) {
      add(start, 0.25 * SR, (i) => noise() * Math.exp((-i / SR) * 22) * 0.32);
    }
    add(start, 0.07 * SR, (i) => {
      const n = noise();
      const hp = n - hatPrev;
      hatPrev = n;
      return hp * Math.exp((-i / SR) * 70) * (inBar % 4 === 2 ? 0.17 : 0.11);
    });
    if (inBar % 2 === 0) {
      const f = hz(root + chord[0]);
      add(start, 0.3 * SR, (i) => {
        const t = i / SR;
        return (Math.sin(2 * Math.PI * f * t) + 0.25 * Math.sin(4 * Math.PI * f * t)) * Math.exp(-t * 6) * 0.3;
      });
    }
  }

  for (let bar = 0; bar < bars; bar++) {
    const chord = progression[bar % progression.length];
    const start = Math.floor(bar * 16 * stepSec * SR);
    const len = Math.floor(16 * stepSec * SR);
    for (const offset of chord) {
      const f = hz(root + 12 + offset);
      add(start, len, (i) => {
        const env = Math.min(1, i / (0.05 * SR)) * Math.min(1, (len - i) / (0.2 * SR));
        return Math.sin(2 * Math.PI * f * (i / SR)) * env * 0.05;
      });
    }
  }

  let peak = 0;
  for (const v of out) peak = Math.max(peak, Math.abs(v));
  const gain = peak ? 0.85 / peak : 1;
  return wav(out.map((v) => v * gain));
}
