import { midiToFreq } from "./theory.mjs";

function noiseBuffer(ctx) {
  const length = Math.floor(ctx.sampleRate * 0.08);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < length; index += 1) {
    const envelope = 1 - index / length;
    data[index] = (Math.random() * 2 - 1) * envelope * envelope;
  }
  return buffer;
}

export function createEngine() {
  let ctx = null;
  let master = null;
  let volume = null;
  let buffer = null;
  let level = 1;

  function ac() {
    if (!ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      ctx = new AudioCtx();
      master = ctx.createGain();
      master.gain.value = 1;
      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.value = -14;
      compressor.knee.value = 12;
      compressor.ratio.value = 3;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.18;
      volume = ctx.createGain();
      volume.gain.value = level;
      master.connect(compressor);
      compressor.connect(volume);
      volume.connect(ctx.destination);
      buffer = noiseBuffer(ctx);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  function pluck(midi, when, { velocity = 0.22, duration = 2.15 } = {}) {
    const context = ac();
    const freq = midiToFreq(midi);
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(Math.min(2800, freq * 7), when);
    filter.frequency.exponentialRampToValueAtTime(Math.max(280, freq * 2.2), when + 0.45);
    filter.Q.value = 0.6;
    filter.connect(master);

    const amp = context.createGain();
    amp.gain.setValueAtTime(0.0001, when);
    amp.gain.exponentialRampToValueAtTime(velocity, when + 0.012);
    amp.gain.exponentialRampToValueAtTime(velocity * 0.42, when + 0.16);
    amp.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    amp.connect(filter);

    const partials = [1, 2, 3, 4, 6];
    const weights = [1, 0.52, 0.26, 0.14, 0.06];
    partials.forEach((partial, index) => {
      const osc = context.createOscillator();
      osc.type = "sine";
      const inharmonic = 1 + partial * partial * 0.00035;
      osc.frequency.value = freq * partial * inharmonic * (1 + (Math.random() - 0.5) * 0.0015);
      const gain = context.createGain();
      gain.gain.value = weights[index];
      osc.connect(gain);
      gain.connect(amp);
      osc.start(when);
      osc.stop(when + duration + 0.05);
    });

    const click = context.createBufferSource();
    click.buffer = buffer;
    const clickGain = context.createGain();
    clickGain.gain.value = velocity * 0.55;
    const band = context.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = Math.min(2400, freq * 3.5);
    band.Q.value = 0.7;
    click.connect(band);
    band.connect(clickGain);
    clickGain.connect(master);
    click.start(when);
    click.stop(when + 0.08);
  }

  function piano(midi, when, { velocity = 0.72, duration = 1.85 } = {}) {
    const context = ac();
    const freq = midiToFreq(midi);
    const amp = context.createGain();
    const decay = duration * (midi > 72 ? 0.72 : 1);
    amp.gain.setValueAtTime(0.0001, when);
    amp.gain.exponentialRampToValueAtTime(velocity, when + 0.008);
    amp.gain.exponentialRampToValueAtTime(velocity * 0.45, when + 0.09);
    amp.gain.exponentialRampToValueAtTime(0.0001, when + decay);
    const bright = context.createBiquadFilter();
    bright.type = "lowpass";
    bright.frequency.value = Math.min(4200, freq * 8);
    amp.connect(bright);
    bright.connect(master);

    [1, 2, 3, 4].forEach((partial, index) => {
      const osc = context.createOscillator();
      osc.type = index === 0 ? "triangle" : "sine";
      osc.frequency.value = freq * partial;
      const gain = context.createGain();
      gain.gain.value = [0.85, 0.28, 0.12, 0.05][index];
      osc.connect(gain);
      gain.connect(amp);
      osc.start(when);
      osc.stop(when + decay + 0.05);
    });
  }

  return {
    resume: ac,
    setVolume(amount) {
      level = Math.min(1, Math.max(0, amount));
      if (!volume) return;
      volume.gain.setTargetAtTime(level, ac().currentTime, 0.02);
    },
    now() {
      return ac().currentTime;
    },
    guitar(midis, when, { gap = 0.03 } = {}) {
      midis.forEach((midi, index) => {
        if (midi == null) return;
        const velocity = 0.16 + (index / Math.max(1, midis.length - 1)) * 0.07;
        pluck(midi, when + index * gap, { velocity, duration: gap > 0.12 ? 1.7 : 2.3 });
      });
    },
    piano(midi, when) {
      piano(midi, when);
    },
    pianoChord(midis, when, gap = 0.018) {
      midis.forEach((midi, index) => {
        if (midi == null) return;
        piano(midi, when + index * gap, { velocity: 0.55 });
      });
    },
  };
}
