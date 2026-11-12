/** Music theory, guitar voicings, and answer grading for コード耳. */

export const NOTE_SHARPS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
export const SOLFEGE = ["ド", "ド#", "レ", "レ#", "ミ", "ファ", "ファ#", "ソ", "ソ#", "ラ", "ラ#", "シ"];

/** MIDI of open strings, low E to high E. */
export const OPEN_MIDI = [40, 45, 50, 55, 59, 64];

export const DEGREE_LABEL = {
  0: "ルート",
  2: "長2度",
  3: "短3度",
  4: "長3度",
  5: "完全4度",
  6: "減5度",
  7: "完全5度",
  8: "増5度",
  10: "短7度",
  11: "長7度",
};

export const CHORD_TYPES = [
  { id: "major", label: "メジャー", symbol: "", intervals: [0, 4, 7] },
  { id: "minor", label: "マイナー", symbol: "m", intervals: [0, 3, 7] },
  { id: "sus4", label: "サスフォー", symbol: "sus4", intervals: [0, 5, 7] },
  { id: "sus2", label: "サスツー", symbol: "sus2", intervals: [0, 2, 7] },
  { id: "dim", label: "ディミニッシュ", symbol: "dim", intervals: [0, 3, 6] },
  { id: "aug", label: "オーグメント", symbol: "aug", intervals: [0, 4, 8] },
  { id: "7", label: "セブンス", symbol: "7", intervals: [0, 4, 7, 10] },
  { id: "m7", label: "マイナーセブンス", symbol: "m7", intervals: [0, 3, 7, 10] },
  { id: "maj7", label: "メジャーセブンス", symbol: "maj7", intervals: [0, 4, 7, 11] },
];

const FORM_LABEL = {
  E: "Eフォーム",
  A: "Aフォーム",
  D: "Dフォーム",
  C: "Cフォーム",
  open: "オープンコード",
};

/**
 * Movable shapes. `rel` is the fret added to the root-string position `r`.
 * `minR` keeps negative relatives on the fretboard (C form).
 * Fixed shapes are used only for the named root.
 */
const SHAPES = {
  major: [
    { form: "E", rel: [0, 2, 2, 1, 0, 0], rootString: 0 },
    { form: "A", rel: [null, 0, 2, 2, 2, 0], rootString: 1 },
    { form: "D", rel: [null, null, 0, 2, 3, 2], rootString: 2 },
    { form: "C", rel: [null, 0, -1, -3, -2, -3], rootString: 1, minR: 3 },
    { form: "open", fixed: [3, 2, 0, 0, 0, 3], rootPc: 7 },
  ],
  minor: [
    { form: "E", rel: [0, 2, 2, 0, 0, 0], rootString: 0 },
    { form: "A", rel: [null, 0, 2, 2, 1, 0], rootString: 1 },
    { form: "D", rel: [null, null, 0, 2, 3, 1], rootString: 2 },
  ],
  sus4: [
    { form: "E", rel: [0, 2, 2, 2, 0, 0], rootString: 0 },
    { form: "A", rel: [null, 0, 2, 2, 3, 0], rootString: 1 },
    { form: "D", rel: [null, null, 0, 2, 3, 3], rootString: 2 },
  ],
  sus2: [
    { form: "E", rel: [0, 2, 4, 4, 0, 0], rootString: 0 },
    { form: "A", rel: [null, 0, 2, 2, 0, 0], rootString: 1 },
    { form: "D", rel: [null, null, 0, 2, 3, 0], rootString: 2 },
  ],
  dim: [
    { form: "A", rel: [null, 0, 1, 2, 1, null], rootString: 1 },
    { form: "D", rel: [null, null, 0, 1, 3, 1], rootString: 2 },
  ],
  aug: [
    { form: "E", rel: [0, 3, 2, 1, 1, 0], rootString: 0 },
    { form: "A", rel: [null, 0, 3, 2, 2, 1], rootString: 1 },
    { form: "D", rel: [null, null, 0, 3, 3, 2], rootString: 2 },
  ],
  7: [
    { form: "E", rel: [0, 2, 0, 1, 0, 0], rootString: 0 },
    { form: "A", rel: [null, 0, 2, 0, 2, 0], rootString: 1 },
    { form: "D", rel: [null, null, 0, 2, 1, 2], rootString: 2 },
    { form: "open", fixed: [3, 2, 0, 0, 0, 1], rootPc: 7 },
  ],
  m7: [
    { form: "E", rel: [0, 2, 0, 0, 0, 0], rootString: 0 },
    { form: "A", rel: [null, 0, 2, 0, 1, 0], rootString: 1 },
    { form: "D", rel: [null, null, 0, 2, 1, 1], rootString: 2 },
  ],
  maj7: [
    { form: "E", rel: [0, 2, 1, 1, 0, 0], rootString: 0 },
    { form: "A", rel: [null, 0, 2, 1, 2, 0], rootString: 1 },
    { form: "D", rel: [null, null, 0, 2, 2, 2], rootString: 2 },
  ],
};

const MAX_FRET = 15;

export function chordType(typeId) {
  const found = CHORD_TYPES.find((type) => type.id === typeId);
  if (!found) throw new Error(`unknown chord type ${typeId}`);
  return found;
}

export function noteLabel(pc) {
  const i = ((pc % 12) + 12) % 12;
  return `${NOTE_SHARPS[i]}（${SOLFEGE[i]}）`;
}

export function chordSymbol(rootPc, typeId) {
  return `${NOTE_SHARPS[((rootPc % 12) + 12) % 12]}${chordType(typeId).symbol}`;
}

export function chordTitle(rootPc, typeId) {
  const type = chordType(typeId);
  return `${NOTE_SHARPS[((rootPc % 12) + 12) % 12]} ${type.label}`;
}

export function chordPitchClasses(rootPc, typeId) {
  const root = ((rootPc % 12) + 12) % 12;
  return chordType(typeId).intervals.map((interval) => (root + interval) % 12);
}

export function toneRows(rootPc, typeId) {
  const root = ((rootPc % 12) + 12) % 12;
  return chordType(typeId).intervals.map((interval) => ({
    pc: (root + interval) % 12,
    degree: interval,
    degreeLabel: DEGREE_LABEL[interval] ?? `${interval}半音`,
    note: noteLabel((root + interval) % 12),
  }));
}

export function fretsToMidi(frets) {
  return frets.map((fret, index) => (fret === null ? null : OPEN_MIDI[index] + fret));
}

export function soundingPitchClasses(frets) {
  const set = new Set();
  frets.forEach((fret, index) => {
    if (fret === null) return;
    set.add((OPEN_MIDI[index] + fret) % 12);
  });
  return [...set].sort((a, b) => a - b);
}

export function voicingIsValid(frets, rootPc, typeId) {
  if (!Array.isArray(frets) || frets.length !== 6) return false;
  const sounded = [];
  for (let index = 0; index < 6; index += 1) {
    const fret = frets[index];
    if (fret === null) continue;
    if (!Number.isInteger(fret) || fret < 0 || fret > MAX_FRET) return false;
    sounded.push((OPEN_MIDI[index] + fret) % 12);
  }
  if (sounded.length < 3) return false;
  const target = new Set(chordPitchClasses(rootPc, typeId));
  if (sounded.some((pc) => !target.has(pc))) return false;
  if (![...target].every((pc) => sounded.includes(pc))) return false;
  return true;
}

function pushVoicing(found, seen, voicing) {
  const key = voicing.frets.map((fret) => (fret === null ? "x" : String(fret))).join(",");
  if (seen.has(key)) return;
  seen.add(key);
  found.push(voicing);
}

export function voicingsFor(typeId, rootPc) {
  const root = ((rootPc % 12) + 12) % 12;
  const found = [];
  const seen = new Set();
  for (const shape of SHAPES[typeId] ?? []) {
    if (shape.fixed) {
      if (shape.rootPc !== root) continue;
      pushVoicing(found, seen, { form: shape.form, frets: shape.fixed.slice() });
      continue;
    }
    const openPc = OPEN_MIDI[shape.rootString] % 12;
    const base = (root - openPc + 12) % 12;
    const minR = shape.minR ?? 0;
    for (const position of [base, base + 12]) {
      if (position < minR || position > MAX_FRET) continue;
      const frets = shape.rel.map((rel) => (rel === null ? null : rel + position));
      if (frets.some((fret) => fret !== null && (fret < 0 || fret > MAX_FRET))) continue;
      pushVoicing(found, seen, { form: shape.form, frets });
    }
  }
  return found.filter((voicing) => voicingIsValid(voicing.frets, root, typeId));
}

export function positionLabel(form, frets) {
  if (form === "open") return FORM_LABEL.open;
  const name = FORM_LABEL[form] ?? form;
  const played = frets.filter((fret) => fret !== null);
  const min = Math.min(...played);
  if (min <= 0) return `${name}・開放`;
  return `${name}・${min}フレット`;
}

/** Signed shortest distance of `guess` above `target`, in -6..+6. +6 is the tritone. */
export function shortestDelta(guess, target) {
  let delta = (((guess - target) % 12) + 12) % 12;
  if (delta > 6) delta -= 12;
  return delta;
}

const INTERVAL_UP = {
  1: "短2度",
  2: "長2度",
  3: "短3度",
  4: "長3度",
  5: "完全4度",
  6: "増4度",
};

export function describeDelta(delta) {
  if (delta === 0) {
    return { signed: 0, semitones: 0, text: "同じ高さ", interval: "同度" };
  }
  const semitones = Math.abs(delta);
  const interval = INTERVAL_UP[semitones];
  if (semitones === 6) {
    return { signed: delta, semitones, text: "6半音ずれている（増4度）", interval };
  }
  const direction = delta > 0 ? "高い" : "低い";
  return {
    signed: delta,
    semitones,
    text: `${semitones}半音${direction}（${interval}）`,
    interval,
  };
}

function uniqPcs(pcs) {
  return [...new Set(pcs.map((pc) => ((pc % 12) + 12) % 12))];
}

function judgeRoot(rootPc, type, guessPc) {
  const guess = ((guessPc % 12) + 12) % 12;
  const root = ((rootPc % 12) + 12) % 12;
  const delta = shortestDelta(guess, root);
  const described = describeDelta(delta);
  const up = (guess - root + 12) % 12;
  const inChord = type.intervals.includes(up);
  const symbol = `${NOTE_SHARPS[root]}${type.symbol}`;
  if (delta === 0) {
    return {
      correct: true,
      title: "正解",
      subtitle: `${symbol} のルート`,
      detail: `ルートは ${noteLabel(root)}。`,
      delta: 0,
      lines: [],
    };
  }
  let detail = `選んだ ${noteLabel(guess)} は、正解のルート ${noteLabel(root)} より${described.text}。`;
  if (inChord && up !== 0) {
    detail += ` この音はコードの${DEGREE_LABEL[up]}でもある。`;
  }
  return {
    correct: false,
    title: described.text,
    subtitle: "ルートは別の音",
    detail,
    delta,
    lines: [],
  };
}

function judgeTones(rootPc, type, selectedPcs) {
  const root = ((rootPc % 12) + 12) % 12;
  const target = type.intervals.map((interval) => (root + interval) % 12);
  const guess = uniqPcs(selectedPcs).sort((a, b) => a - b);
  const targetSorted = [...target].sort((a, b) => a - b);
  const symbol = `${NOTE_SHARPS[root]}${type.symbol}`;
  const same =
    guess.length === targetSorted.length && guess.every((pc, index) => pc === targetSorted[index]);
  if (same) {
    return {
      correct: true,
      title: "正解",
      subtitle: `${symbol} の構成音`,
      detail: "鳴っていた構成音がすべて入っている。",
      delta: null,
      lines: target.map((pc) => ({
        label: noteLabel(pc),
        value: DEGREE_LABEL[(pc - root + 12) % 12] ?? "構成音",
        state: "hit",
      })),
    };
  }

  if (guess.length === target.length && guess.length > 0) {
    for (let shift = 1; shift < 12; shift += 1) {
      const moved = target.map((pc) => (pc + shift) % 12).sort((a, b) => a - b);
      if (moved.every((pc, index) => pc === guess[index])) {
        const signed = shift > 6 ? shift - 12 : shift;
        const described = describeDelta(signed);
        return {
          correct: false,
          title: `全体が${described.text}`,
          subtitle: "音の並び方は合っている",
          detail: `構成の形はそのままに、${described.text.replace("ずれている", "離れた位置にある")}。正解は ${symbol}。`,
          delta: signed,
          lines: [],
        };
      }
    }
  }

  const hits = target.filter((pc) => guess.includes(pc));
  const missing = target.filter((pc) => !guess.includes(pc));
  const extras = guess.filter((pc) => !target.includes(pc)).map((pc) => {
    let nearest = target[0];
    let delta = shortestDelta(pc, nearest);
    for (const candidate of target) {
      const next = shortestDelta(pc, candidate);
      if (Math.abs(next) < Math.abs(delta)) {
        nearest = candidate;
        delta = next;
      }
    }
    return { pc, nearest, delta };
  });

  const lines = [
    ...type.intervals.map((interval) => {
      const pc = (root + interval) % 12;
      const hit = guess.includes(pc);
      return {
        label: noteLabel(pc),
        value: hit ? `合っている・${DEGREE_LABEL[interval]}` : `足りない・${DEGREE_LABEL[interval]}`,
        state: hit ? "hit" : "missing",
      };
    }),
    ...extras.map((extra) => {
      const described = describeDelta(extra.delta);
      return {
        label: noteLabel(extra.pc),
        value: `余分。いちばん近い構成音 ${noteLabel(extra.nearest)} まで${described.text}`,
        state: "extra",
      };
    }),
  ];

  let title = "不正解";
  let subtitle = `${target.length}音中${hits.length}音`;
  let delta = null;
  if (extras.length === 0 && missing.length > 0) {
    title = missing.length === 1 ? "1音足りない" : `${missing.length}音足りない`;
    subtitle = "入っている音の高さは合っている";
  } else if (extras.length > 0) {
    const worst = extras.reduce((a, b) => (Math.abs(b.delta) > Math.abs(a.delta) ? b : a));
    const described = describeDelta(worst.delta);
    title = described.text;
    subtitle = extras.length === 1 ? "その音が構成音からずれている" : "いちばん大きくずれた音";
    delta = described.signed;
  }

  const detailParts = [];
  if (hits.length) detailParts.push(`${hits.length}音は合っている。`);
  if (missing.length) detailParts.push(`${missing.length}音足りない。`);
  if (extras.length) detailParts.push(`${extras.length}音はコードの外。`);
  detailParts.push(`正解は ${symbol}。`);

  return {
    correct: false,
    title,
    subtitle,
    detail: detailParts.join(""),
    delta,
    lines,
  };
}

export function judge(question, selectedPcs, mode) {
  const type = chordType(question.typeId);
  const pcs = uniqPcs(selectedPcs);
  if (pcs.length === 0) {
    return {
      correct: false,
      title: "音が選ばれていない",
      subtitle: "",
      detail: "鍵盤で音を探してから答える。",
      delta: null,
      lines: [],
    };
  }
  if (mode === "tones") return judgeTones(question.rootPc, type, pcs);
  return judgeRoot(question.rootPc, type, pcs[0]);
}

export function midiToFreq(midi) {
  return 440 * 2 ** ((midi - 69) / 12);
}

export function nearestMidi(pc, around) {
  const target = ((pc % 12) + 12) % 12;
  let best = target + 48;
  let bestDistance = Infinity;
  for (let midi = 36; midi <= 90; midi += 1) {
    if (midi % 12 !== target) continue;
    const distance = Math.abs(midi - around);
    if (distance < bestDistance) {
      best = midi;
      bestDistance = distance;
    }
  }
  return best;
}
