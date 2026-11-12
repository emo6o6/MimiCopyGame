import { createEngine } from "./audio.mjs";
import {
  CHORD_TYPES,
  NOTE_SHARPS,
  SOLFEGE,
  chordPitchClasses,
  chordSymbol,
  chordTitle,
  chordType,
  fretsToMidi,
  judge,
  nearestMidi,
  positionLabel,
  toneRows,
  voicingsFor,
} from "./theory.mjs";

const KEY_START = 40;
const KEY_END = 76;
const WHITE_WIDTH = 42;
const STORAGE_KEY = "chord-ear-v1";

const DIFFICULTY_HINT = {
  easy: "一音ずつ鳴ったあと、コードが鳴る。種類と音名が見える。弦も1本ずつ聴ける。",
  normal: "コードが鳴る。音名は見える。一音ずつ聴くこともできる。",
  hard: "コードが鳴るだけ。音名は隠れる。鳴っている高さから探す。",
};

const INPUT_HINT = {
  play: "音を出して探す。合うと思ったら「この音を入れる」。",
  pick: "押した鍵が答えに入る。同じ音をもう一度押すと外れる。",
};

const KEY_MAP = {
  KeyA: 0,
  KeyW: 1,
  KeyS: 2,
  KeyE: 3,
  KeyD: 4,
  KeyF: 5,
  KeyT: 6,
  KeyG: 7,
  KeyY: 8,
  KeyH: 9,
  KeyU: 10,
  KeyJ: 11,
  KeyK: 12,
  KeyO: 13,
  KeyL: 14,
  KeyP: 15,
};

const state = {
  mode: "root",
  difficulty: "easy",
  inputMode: "play",
  types: new Set(["major", "minor", "sus4"]),
  keyBase: 60,
  question: null,
  phase: "idle",
  gradedMode: null,
  picks: [],
  lastMidi: null,
  feedback: null,
  lastQuestionKey: "",
  stats: { correct: 0, total: 0, streak: 0, best: 0, history: [] },
};

const engine = createEngine();
const keyNodes = new Map();
let waveTimer = 0;
let glissId = null;
let resultStamp = "";

const $ = (id) => document.getElementById(id);

function num(value) {
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : 0;
}

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!data || typeof data !== "object") return;
    if (data.mode === "root" || data.mode === "tones") state.mode = data.mode;
    if (data.difficulty === "easy" || data.difficulty === "normal" || data.difficulty === "hard") {
      state.difficulty = data.difficulty;
    }
    if (data.inputMode === "play" || data.inputMode === "pick") state.inputMode = data.inputMode;
    if (Number.isInteger(data.keyBase)) state.keyBase = Math.min(72, Math.max(36, data.keyBase));
    if (Array.isArray(data.types)) {
      const ids = data.types.filter((id) => CHORD_TYPES.some((type) => type.id === id));
      if (ids.length) state.types = new Set(ids);
    }
    const stats = data.stats && typeof data.stats === "object" ? data.stats : {};
    state.stats = {
      correct: num(stats.correct),
      total: num(stats.total),
      streak: num(stats.streak),
      best: num(stats.best),
      history: Array.isArray(stats.history) ? stats.history.filter((item) => typeof item === "boolean").slice(-12) : [],
    };
  } catch {
    /* keep defaults when storage is blocked */
  }
}

function save() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        mode: state.mode,
        difficulty: state.difficulty,
        inputMode: state.inputMode,
        keyBase: state.keyBase,
        types: [...state.types],
        stats: state.stats,
      }),
    );
  } catch {
    /* practice still works without storage */
  }
}

function esc(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function pitchName(midi) {
  const pc = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${SOLFEGE[pc]}  ${NOTE_SHARPS[pc]}${octave}`;
}

function namesHidden() {
  return state.difficulty === "hard" && state.phase !== "answered";
}

function choice(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function makeQuestion() {
  const bag = [];
  for (const typeId of state.types) {
    for (let rootPc = 0; rootPc < 12; rootPc += 1) {
      for (const voicing of voicingsFor(typeId, rootPc)) {
        bag.push({ typeId, rootPc, form: voicing.form, frets: voicing.frets });
      }
    }
  }
  if (!bag.length) return null;
  let pick = choice(bag);
  const keyOf = (question) => `${question.typeId}:${question.rootPc}:${question.form}:${question.frets.join(",")}`;
  let guard = 0;
  while (bag.length > 1 && keyOf(pick) === state.lastQuestionKey && guard < 8) {
    pick = choice(bag);
    guard += 1;
  }
  state.lastQuestionKey = keyOf(pick);
  return pick;
}

function playGuitar(midis, when, gap) {
  engine.guitar(midis, when, { gap });
}

function askedMode() {
  return state.phase === "answered" && state.gradedMode ? state.gradedMode : state.mode;
}

function playCurrent({ style = "auto" } = {}) {
  if (!state.question) return 0;
  const midis = fretsToMidi(state.question.frets);
  const now = engine.now() + 0.04;
  const difficulty = state.difficulty;
  if (style === "arp" || (style === "auto" && difficulty === "easy")) {
    const notes = midis.filter((midi) => midi != null);
    playGuitar(notes, now, 0.46);
    if (style === "auto" && difficulty === "easy") {
      playGuitar(midis, now + notes.length * 0.46 + 0.18, 0.028);
      return notes.length * 0.46 + 1.4;
    }
    return notes.length * 0.46 + 0.4;
  }
  playGuitar(midis, now, 0.028);
  return 1.2;
}

function flash(ms) {
  const wave = $("wave");
  wave.classList.add("is-sounding");
  window.clearTimeout(waveTimer);
  waveTimer = window.setTimeout(() => wave.classList.remove("is-sounding"), ms * 1000);
}

function startOrReplay() {
  engine.resume();
  if (state.phase === "idle" || !state.question) beginQuestion();
  else flash(playCurrent());
}

function beginQuestion() {
  const question = makeQuestion();
  if (!question) return;
  state.question = question;
  state.phase = "question";
  state.gradedMode = null;
  state.picks = [];
  state.lastMidi = null;
  state.feedback = null;
  resultStamp = "";
  flash(playCurrent());
  render();
}

function skip() {
  if (state.phase !== "question") return;
  beginQuestion();
}

function nextQuestion() {
  beginQuestion();
}

function setPick(midi) {
  if (state.phase !== "question") return;
  const pc = ((midi % 12) + 12) % 12;
  const index = state.picks.findIndex((pick) => pick.pc === pc);
  if (state.mode === "root") {
    if (state.picks[0]?.midi === midi) state.picks = [];
    else state.picks = [{ midi, pc }];
    return;
  }
  if (index >= 0 && state.picks[index].midi === midi) state.picks.splice(index, 1);
  else if (index >= 0) state.picks[index] = { midi, pc };
  else state.picks.push({ midi, pc });
}

function handleMidi(midi, { pick = false } = {}) {
  engine.resume();
  engine.piano(midi, engine.now());
  state.lastMidi = midi;
  if (pick && state.phase === "question") setPick(midi);
  render();
}

function takeLast() {
  if (state.lastMidi == null || state.phase !== "question") return;
  setPick(state.lastMidi);
  render();
}

function submit() {
  if (state.phase !== "question" || !state.question || state.picks.length === 0) return;
  state.gradedMode = state.mode;
  state.feedback = judge(
    state.question,
    state.picks.map((pick) => pick.pc),
    state.gradedMode,
  );
  state.phase = "answered";
  state.stats.total += 1;
  if (state.feedback.correct) {
    state.stats.correct += 1;
    state.stats.streak += 1;
    state.stats.best = Math.max(state.stats.best, state.stats.streak);
  } else {
    state.stats.streak = 0;
  }
  state.stats.history = [...state.stats.history, state.feedback.correct].slice(-12);
  save();
  render();
}

function compare() {
  if (!state.question || state.picks.length === 0) return;
  engine.resume();
  const now = engine.now() + 0.05;
  if (askedMode() === "root") {
    const guess = state.picks[0].midi;
    const correct = nearestMidi(state.question.rootPc, guess);
    engine.piano(guess, now);
    engine.piano(correct, now + 0.72);
    engine.piano(guess, now + 1.5);
    engine.piano(correct, now + 2.22);
    flash(2.6);
    return;
  }
  const guesses = [...state.picks].map((pick) => pick.midi).sort((a, b) => a - b);
  const center = guesses[Math.floor(guesses.length / 2)] ?? 60;
  const corrects = chordPitchClasses(state.question.rootPc, state.question.typeId)
    .map((pc) => nearestMidi(pc, center))
    .sort((a, b) => a - b);
  engine.pianoChord(guesses, now, 0.14);
  engine.pianoChord(corrects, now + guesses.length * 0.14 + 0.45, 0.14);
  flash(guesses.length * 0.14 + corrects.length * 0.14 + 1);
}

function playAnswerSlow() {
  if (!state.question) return;
  engine.resume();
  const rows = toneRows(state.question.rootPc, state.question.typeId);
  const now = engine.now() + 0.05;
  rows.forEach((row, index) => {
    engine.piano(nearestMidi(row.pc, 64), now + index * 0.42);
  });
  engine.guitar(fretsToMidi(state.question.frets), now + rows.length * 0.42 + 0.25, { gap: 0.028 });
  flash(rows.length * 0.42 + 1.5);
}

function fretboardSvg(frets) {
  const positives = frets.filter((fret) => fret > 0);
  const max = positives.length ? Math.max(...positives) : 1;
  const min = positives.length ? Math.min(...positives) : 1;
  const nut = frets.some((fret) => fret === 0) || min <= 1;
  const firstFret = nut ? 1 : min;
  const count = Math.max(4, max - firstFret + 1);
  const fretH = 34;
  const top = 34;
  const left = nut ? 26 : 42;
  const stringGap = 28;
  const width = left + stringGap * 5 + 18;
  const height = top + count * fretH + 14;
  const parts = [
    `<svg class="neck" viewBox="0 0 ${width} ${height}" role="img" aria-label="正解コードの押さえ方。左が6弦">`,
    `<rect width="${width}" height="${height}" rx="8" fill="#5c3a24"/>`,
  ];
  for (let index = 0; index <= count; index += 1) {
    const y = top + index * fretH;
    const thick = index === 0 && nut;
    parts.push(
      `<line x1="${left}" y1="${y}" x2="${left + stringGap * 5}" y2="${y}" stroke="${thick ? "#f4ecdf" : "#c8ad8d"}" stroke-width="${thick ? 4 : 1.5}"/>`,
    );
  }
  for (let string = 0; string < 6; string += 1) {
    const x = left + string * stringGap;
    parts.push(
      `<line x1="${x}" y1="${top}" x2="${x}" y2="${top + count * fretH}" stroke="#f3e6d4" stroke-width="${(1.1 + (5 - string) * 0.22).toFixed(2)}"/>`,
    );
  }
  for (let fret = firstFret; fret < firstFret + count; fret += 1) {
    if (![3, 5, 7, 9, 12].includes(fret)) continue;
    const y = top + (fret - firstFret + 0.5) * fretH;
    if (fret === 12) {
      parts.push(`<circle cx="${left + stringGap * 1.5}" cy="${y}" r="3" fill="#e7d3b8"/>`);
      parts.push(`<circle cx="${left + stringGap * 3.5}" cy="${y}" r="3" fill="#e7d3b8"/>`);
    } else {
      parts.push(`<circle cx="${left + stringGap * 2.5}" cy="${y}" r="3" fill="#e7d3b8"/>`);
    }
  }
  frets.forEach((fret, string) => {
    const x = left + string * stringGap;
    if (fret === null) {
      parts.push(`<text x="${x}" y="20" text-anchor="middle" font-size="14" fill="#f0c2b4">×</text>`);
      return;
    }
    if (fret === 0) {
      parts.push(`<circle cx="${x}" cy="14" r="6" fill="none" stroke="#f4ecdf" stroke-width="1.6"/>`);
      return;
    }
    const y = top + (fret - firstFret + 0.5) * fretH;
    parts.push(`<circle cx="${x}" cy="${y}" r="8" fill="#f6f0e4"/>`);
  });
  if (!nut) {
    parts.push(`<text x="10" y="${top + 18}" font-size="13" fill="#f4ecdf">${firstFret}</text>`);
  }
  parts.push("</svg>");
  return parts.join("");
}

function rulerMarkup(delta, caption) {
  if (typeof delta !== "number") return "";
  const cells = [];
  for (let step = -6; step <= 6; step += 1) {
    const classes = ["tick"];
    if (step === 0) classes.push("zero");
    if (step === delta) classes.push("mark", delta === 0 ? "good" : "bad-mark");
    const label = step > 0 ? `+${step}` : String(step);
    cells.push(`<div class="${classes.join(" ")}">${label}</div>`);
  }
  return `<div class="ruler" role="img" aria-label="ずれは${delta}半音">${cells.join("")}</div><p class="ruler-caption">${esc(caption)}</p>`;
}

function resultMarkup() {
  const question = state.question;
  const feedback = state.feedback;
  const type = chordType(question.typeId);
  const symbol = chordSymbol(question.rootPc, question.typeId);
  const title = chordTitle(question.rootPc, question.typeId);
  const place = positionLabel(question.form, question.frets);
  let caption = "0 が正解のルート。右へ行くほど、選んだ音が高い。";
  if (askedMode() === "tones" && feedback.title.startsWith("全体が")) {
    caption = "0 が正解のコードの高さ。右へ行くほど、選んだコード全体が高い。";
  } else if (askedMode() === "tones") {
    caption = "0 がいちばん近い構成音。右へ行くほど、ずれた音が高い。";
  }
  const lines = feedback.lines
    .map((line) => `<li class="${esc(line.state)}"><span>${esc(line.label)}</span><span>${esc(line.value)}</span></li>`)
    .join("");
  const spell = toneRows(question.rootPc, question.typeId)
    .map((row) => `<li><span>${esc(row.note)}</span><span>${esc(row.degreeLabel)}</span></li>`)
    .join("");
  return `
    <div class="result-grid">
      <div>
        <p class="verdict ${feedback.correct ? "good" : "bad"}">${esc(feedback.title)}</p>
        <p class="subtitle">${esc(feedback.correct ? "正解" : "不正解")} · ${esc(feedback.subtitle)}</p>
        <p class="detail">${esc(feedback.detail)}</p>
        ${rulerMarkup(feedback.delta, caption)}
        ${lines ? `<ul class="tone-list">${lines}</ul>` : `<ol class="spell">${spell}</ol>`}
        <p class="symbol">${esc(symbol || type.label)}</p>
        <p class="chord-meta">${esc(title)} · ${esc(place)}</p>
        <div class="result-actions">
          <button type="button" class="ghost" id="compare">自分の音と正解を聴く</button>
          <button type="button" class="ghost" id="slow">正解をゆっくり聴く</button>
        </div>
      </div>
      <div class="diagram">
        ${fretboardSvg(question.frets)}
        <p class="diagram-caption">左が6弦。×は弾かない弦、丸抜きは開放。</p>
      </div>
    </div>`;
}

function renderTypes() {
  const box = $("types");
  if (box.childElementCount === 0) {
    for (const type of CHORD_TYPES) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "chip";
      button.dataset.type = type.id;
      button.textContent = type.label;
      button.addEventListener("click", () => toggleType(type.id, button));
      box.append(button);
    }
  }
  for (const button of box.querySelectorAll(".chip")) {
    button.setAttribute("aria-pressed", String(state.types.has(button.dataset.type)));
  }
}

function toggleType(id, button) {
  if (state.types.has(id)) {
    if (state.types.size === 1) {
      button.classList.remove("shake");
      void button.offsetWidth;
      button.classList.add("shake");
      return;
    }
    state.types.delete(id);
  } else {
    state.types.add(id);
  }
  save();
  renderTypes();
}

function renderSegments() {
  for (const button of document.querySelectorAll("[data-mode]")) {
    button.setAttribute("aria-pressed", String(button.dataset.mode === state.mode));
  }
  for (const button of document.querySelectorAll("[data-difficulty]")) {
    button.setAttribute("aria-pressed", String(button.dataset.difficulty === state.difficulty));
  }
  for (const button of document.querySelectorAll("[data-input]")) {
    button.setAttribute("aria-pressed", String(button.dataset.input === state.inputMode));
  }
  $("difficulty-hint").textContent = DIFFICULTY_HINT[state.difficulty];
  $("input-hint").textContent = INPUT_HINT[state.inputMode];
}

function renderStats() {
  const { correct, total, streak, best } = state.stats;
  $("stats").textContent = total
    ? `${correct}/${total} 正解（${Math.round((correct / total) * 100)}%） · 連続 ${streak} · ベスト ${best}`
    : "まだ 0 問";
  const history = $("history");
  history.replaceChildren();
  if (!state.stats.history.length) {
    history.hidden = true;
    return;
  }
  history.hidden = false;
  for (const ok of state.stats.history) {
    const dot = document.createElement("span");
    dot.className = ok ? "dot ok" : "dot";
    dot.title = ok ? "正解" : "不正解";
    history.append(dot);
  }
}

function renderPrompt() {
  const prompt = $("prompt");
  if (state.phase === "idle" || !state.question) {
    prompt.textContent = "出るコードを選んだら、コードを聴く。";
    return;
  }
  const type = chordType(state.question.typeId);
  const task = state.mode === "root" ? "ルートの高さを鍵盤で探す。" : "鳴っている構成音を全部選ぶ。";
  if (state.phase === "answered") {
    prompt.textContent = "答えを出した。鍵盤で聞き比べられる。";
    return;
  }
  if (state.difficulty === "easy") {
    const count = state.mode === "tones" ? ` ${type.intervals.length}音。` : "";
    prompt.textContent = `${type.label}。${task}${count}`;
    return;
  }
  if (state.difficulty === "hard") {
    prompt.textContent = state.mode === "root"
      ? "コードが鳴った。ルートの高さを、音名を見ずに探す。"
      : "コードが鳴った。構成音の高さを、音名を見ずに全部探す。";
    return;
  }
  prompt.textContent = task;
}

function renderHeard() {
  const node = $("heard");
  if (state.lastMidi == null) {
    node.textContent = "まだ鳴っていない";
    return;
  }
  node.textContent = namesHidden() ? "鍵盤が光っている" : pitchName(state.lastMidi);
}

function renderPicks() {
  const box = $("picks");
  box.replaceChildren();
  if (!state.picks.length) {
    const empty = document.createElement("span");
    empty.className = "pick-empty";
    empty.textContent = state.mode === "root" ? "ルートは未選択" : "構成音は未選択";
    box.append(empty);
    return;
  }
  const reveal = !namesHidden();
  const ordered = [...state.picks].sort((a, b) => a.midi - b.midi);
  for (const pick of ordered) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "pick";
    button.textContent = reveal ? pitchName(pick.midi) : "選択中";
    button.disabled = state.phase === "answered";
    button.addEventListener("click", () => {
      state.picks = state.picks.filter((item) => item.pc !== pick.pc);
      render();
    });
    box.append(button);
  }
}

function renderTake() {
  const button = $("take");
  if (state.phase !== "question" || state.lastMidi == null) {
    button.disabled = true;
    button.textContent = state.phase === "answered" ? "答えは確定済み" : "この音を入れる";
    return;
  }
  button.disabled = false;
  const pc = ((state.lastMidi % 12) + 12) % 12;
  const current = state.picks.find((pick) => pick.pc === pc);
  const sameKey = current?.midi === state.lastMidi;
  if (state.mode === "root") {
    if (sameKey) button.textContent = "ルートを外す";
    else if (current) button.textContent = "この高さにする";
    else button.textContent = "この音をルートにする";
    return;
  }
  if (sameKey) button.textContent = "この音を外す";
  else if (current) button.textContent = "この高さにする";
  else button.textContent = "この音を追加";
}

function renderActions() {
  $("play-label").textContent = state.phase === "idle" ? "コードを聴く" : "もう一度聴く";
  $("submit").hidden = state.phase === "answered";
  $("submit").disabled = state.phase !== "question" || state.picks.length === 0;
  $("next").hidden = state.phase !== "answered";
  $("skip").hidden = state.phase !== "question";
  const canIsolate = state.phase !== "idle" && state.difficulty !== "hard";
  $("arp").hidden = !canIsolate;
}

function renderStrings() {
  const box = $("strings");
  const show = state.phase !== "idle" && state.difficulty !== "hard" && state.question;
  box.hidden = !show;
  box.replaceChildren();
  if (!show) return;
  const label = document.createElement("span");
  label.className = "strings-label";
  label.textContent = "低い弦から";
  box.append(label);
  const midis = fretsToMidi(state.question.frets);
  midis.forEach((midi, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "string-btn";
    const stringNo = 6 - index;
    if (midi == null) {
      button.textContent = "×";
      button.disabled = true;
      button.setAttribute("aria-label", `${stringNo}弦は弾かない`);
    } else {
      button.textContent = String(stringNo);
      button.setAttribute("aria-label", `${stringNo}弦だけ聴く`);
      button.addEventListener("click", () => {
        engine.resume();
        engine.guitar([midi], engine.now() + 0.02, { gap: 0 });
        flash(1.2);
      });
    }
    box.append(button);
  });
}

function renderKeys() {
  const reveal = namesHidden() ? "no" : "yes";
  $("piano").dataset.reveal = reveal;
  const targets = new Set();
  let rootPc = null;
  if (state.phase === "answered" && state.question) {
    rootPc = ((state.question.rootPc % 12) + 12) % 12;
    const pcs = askedMode() === "root"
      ? [rootPc]
      : chordPitchClasses(state.question.rootPc, state.question.typeId);
    pcs.forEach((pc) => targets.add(pc));
  }
  const selected = new Set(state.picks.map((pick) => pick.pc));
  for (const [midi, button] of keyNodes) {
    const pc = midi % 12;
    button.classList.toggle("is-selected", selected.has(pc));
    button.classList.toggle("is-last", state.lastMidi === midi);
    button.classList.toggle("is-target", targets.has(pc));
    button.classList.toggle("is-root", state.phase === "answered" && pc === rootPc);
    button.setAttribute("aria-pressed", String(selected.has(pc)));
  }
}

function renderOctave() {
  const octave = Math.floor(state.keyBase / 12) - 1;
  $("octave-label").textContent = `パソコン鍵盤のドは C${octave}`;
}

function renderResult() {
  const box = $("result");
  if (state.phase !== "answered" || !state.feedback || !state.question) {
    box.hidden = true;
    box.replaceChildren();
    resultStamp = "";
    return;
  }
  const stamp = `${state.feedback.title}|${state.feedback.detail}|${state.question.rootPc}|${askedMode()}`;
  if (stamp === resultStamp) return;
  resultStamp = stamp;
  box.hidden = false;
  box.innerHTML = resultMarkup();
  $("compare").addEventListener("click", compare);
  $("slow").addEventListener("click", playAnswerSlow);
}

function render() {
  renderTypes();
  renderSegments();
  renderStats();
  renderPrompt();
  renderHeard();
  renderPicks();
  renderTake();
  renderActions();
  renderStrings();
  renderKeys();
  renderOctave();
  renderResult();
}

function buildPiano() {
  const piano = $("piano");
  let whiteCount = 0;
  for (let midi = KEY_START; midi <= KEY_END; midi += 1) {
    const pc = midi % 12;
    const black = [1, 3, 6, 8, 10].includes(pc);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `key ${black ? "black" : "white"}`;
    button.dataset.midi = String(midi);
    const octave = Math.floor(midi / 12) - 1;
    const name = NOTE_SHARPS[pc];
    button.setAttribute("aria-label", `${name}${octave}`);
    button.innerHTML = `<span class="key-name">${esc(name)}${pc === 0 ? `<span class="octave">${octave}</span>` : ""}</span>`;
    if (black) button.style.left = `${whiteCount * WHITE_WIDTH - 13}px`;
    else whiteCount += 1;
    piano.append(button);
    keyNodes.set(midi, button);
  }

  piano.addEventListener("pointerdown", (event) => {
    const key = event.target.closest(".key");
    if (!key) return;
    piano.setPointerCapture(event.pointerId);
    glissId = event.pointerId;
    handleMidi(Number(key.dataset.midi), { pick: state.inputMode === "pick" });
  });
  piano.addEventListener("pointermove", (event) => {
    if (event.pointerId !== glissId) return;
    const element = document.elementFromPoint(event.clientX, event.clientY);
    const key = element && element.closest ? element.closest(".key") : null;
    if (!key) return;
    const midi = Number(key.dataset.midi);
    if (midi === state.lastMidi) return;
    handleMidi(midi, { pick: false });
  });
  const end = (event) => {
    if (event.pointerId === glissId) glissId = null;
  };
  piano.addEventListener("pointerup", end);
  piano.addEventListener("pointercancel", end);
  piano.addEventListener("contextmenu", (event) => event.preventDefault());
}

function shiftOctave(step) {
  state.keyBase = Math.min(72, Math.max(36, state.keyBase + step * 12));
  save();
  renderOctave();
}

function bind() {
  $("play").addEventListener("click", startOrReplay);
  $("arp").addEventListener("click", () => {
    if (!state.question) return;
    engine.resume();
    flash(playCurrent({ style: "arp" }));
  });
  $("take").addEventListener("click", takeLast);
  $("submit").addEventListener("click", submit);
  $("next").addEventListener("click", nextQuestion);
  $("skip").addEventListener("click", skip);
  $("oct-down").addEventListener("click", () => shiftOctave(-1));
  $("oct-up").addEventListener("click", () => shiftOctave(1));
  $("reset").addEventListener("click", () => {
    state.stats = { correct: 0, total: 0, streak: 0, best: 0, history: [] };
    save();
    renderStats();
  });

  for (const button of document.querySelectorAll("[data-mode]")) {
    button.addEventListener("click", () => {
      if (state.mode === button.dataset.mode) return;
      state.mode = button.dataset.mode;
      if (state.phase === "question") state.picks = [];
      save();
      render();
    });
  }
  for (const button of document.querySelectorAll("[data-difficulty]")) {
    button.addEventListener("click", () => {
      state.difficulty = button.dataset.difficulty;
      save();
      render();
    });
  }
  for (const button of document.querySelectorAll("[data-input]")) {
    button.addEventListener("click", () => {
      state.inputMode = button.dataset.input;
      save();
      render();
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.repeat) return;
    if (event.code === "ArrowLeft") {
      event.preventDefault();
      shiftOctave(-1);
      return;
    }
    if (event.code === "ArrowRight") {
      event.preventDefault();
      shiftOctave(1);
      return;
    }
    if (Object.prototype.hasOwnProperty.call(KEY_MAP, event.code)) {
      event.preventDefault();
      handleMidi(state.keyBase + KEY_MAP[event.code], { pick: state.inputMode === "pick" });
      return;
    }
    if (event.target.closest("button")) return;
    if (event.code === "Space") {
      event.preventDefault();
      startOrReplay();
    } else if (event.code === "Enter") {
      event.preventDefault();
      submit();
    }
  });
}

load();
buildPiano();
bind();
render();
