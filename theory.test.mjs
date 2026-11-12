import test from "node:test";
import assert from "node:assert/strict";
import {
  CHORD_TYPES,
  chordPitchClasses,
  describeDelta,
  fretsToMidi,
  judge,
  nearestMidi,
  noteLabel,
  shortestDelta,
  soundingPitchClasses,
  voicingIsValid,
  voicingsFor,
} from "./theory.mjs";

test("famous open shapes are in the library", () => {
  const has = (typeId, rootPc, expected) => {
    const voicings = voicingsFor(typeId, rootPc);
    const key = expected.map((fret) => (fret === null ? "x" : fret)).join(",");
    assert.ok(
      voicings.some((voicing) => voicing.frets.map((fret) => (fret === null ? "x" : fret)).join(",") === key),
      `${typeId} ${rootPc} missing ${key}`,
    );
  };
  has("major", 4, [0, 2, 2, 1, 0, 0]); // E
  has("major", 9, [null, 0, 2, 2, 2, 0]); // A
  has("major", 2, [null, null, 0, 2, 3, 2]); // D
  has("major", 0, [null, 3, 2, 0, 1, 0]); // C
  has("major", 7, [3, 2, 0, 0, 0, 3]); // G
  has("minor", 4, [0, 2, 2, 0, 0, 0]); // Em
  has("minor", 9, [null, 0, 2, 2, 1, 0]); // Am
  has("minor", 2, [null, null, 0, 2, 3, 1]); // Dm
  has("sus4", 4, [0, 2, 2, 2, 0, 0]); // Esus4
  has("sus2", 9, [null, 0, 2, 2, 0, 0]); // Asus2
  has("7", 4, [0, 2, 0, 1, 0, 0]); // E7
  has("7", 7, [3, 2, 0, 0, 0, 1]); // G7
});

test("every chord type has a valid guitar voicing on every root", () => {
  for (const type of CHORD_TYPES) {
    for (let root = 0; root < 12; root += 1) {
      const voicings = voicingsFor(type.id, root);
      assert.ok(voicings.length > 0, `${type.id} root ${root} has no voicing`);
      for (const voicing of voicings) {
        assert.equal(voicingIsValid(voicing.frets, root, type.id), true, `${type.id} ${root} ${voicing.form}`);
        const sounded = soundingPitchClasses(voicing.frets);
        const target = chordPitchClasses(root, type.id).sort((a, b) => a - b);
        assert.deepEqual(sounded, target);
        assert.ok(fretsToMidi(voicing.frets).some((midi) => midi !== null && midi % 12 === root));
      }
    }
  }
});

test("shortest distance folds at the tritone", () => {
  assert.equal(shortestDelta(0, 0), 0);
  assert.equal(shortestDelta(3, 0), 3);
  assert.equal(shortestDelta(0, 3), -3);
  assert.equal(shortestDelta(7, 0), -5);
  assert.equal(shortestDelta(6, 0), 6);
  assert.equal(shortestDelta(9, 0), -3);
});

test("delta copy names the interval and direction", () => {
  assert.match(describeDelta(0).text, /同じ高さ/);
  assert.match(describeDelta(3).text, /3半音高い/);
  assert.match(describeDelta(3).text, /短3度/);
  assert.match(describeDelta(-2).text, /2半音低い/);
  assert.match(describeDelta(-2).text, /長2度/);
  assert.match(describeDelta(6).text, /増4度/);
  assert.match(describeDelta(-4).text, /長3度/);
});

test("root grading accepts the pitch class and measures the miss", () => {
  const correct = judge({ rootPc: 9, typeId: "minor" }, [9], "root");
  assert.equal(correct.correct, true);
  assert.equal(correct.delta, 0);
  assert.match(correct.detail, /ラ/);

  const third = judge({ rootPc: 9, typeId: "major" }, [1], "root");
  assert.equal(third.correct, false);
  assert.equal(third.delta, 4);
  assert.match(third.title, /4半音高い/);
  assert.match(third.detail, /長3度でもある/);

  const fifth = judge({ rootPc: 9, typeId: "major" }, [4], "root");
  assert.equal(fifth.delta, -5);
  assert.match(fifth.title, /5半音低い/);
  assert.match(fifth.detail, /完全5度でもある/);

  const off = judge({ rootPc: 0, typeId: "sus4" }, [1], "root");
  assert.equal(off.delta, 1);
  assert.match(off.title, /1半音高い/);
  assert.doesNotMatch(off.detail, /でもある/);
});

test("octave does not matter for the root", () => {
  const high = judge({ rootPc: 2, typeId: "sus2" }, [2 + 12], "root");
  assert.equal(high.correct, true);
});

test("all chord tones must match as a set", () => {
  const hit = judge({ rootPc: 0, typeId: "major" }, [4, 7, 0], "tones");
  assert.equal(hit.correct, true);

  const missing = judge({ rootPc: 0, typeId: "major" }, [0, 4], "tones");
  assert.equal(missing.correct, false);
  assert.match(missing.title, /1音足りない/);
  assert.ok(missing.lines.some((line) => line.state === "missing" && line.label.startsWith("G")));

  const extra = judge({ rootPc: 0, typeId: "major" }, [0, 4, 7, 5], "tones");
  assert.equal(extra.correct, false);
  assert.equal(extra.delta, 1);
  assert.match(extra.detail, /コードの外/);
  assert.ok(extra.lines.some((line) => line.state === "extra" && /1半音高い/.test(line.value)));
});

test("a transposed chord shape is reported as a whole-step shift", () => {
  const moved = judge({ rootPc: 2, typeId: "minor" }, [4, 7, 11], "tones");
  assert.equal(moved.correct, false);
  assert.equal(moved.delta, 2);
  assert.match(moved.title, /全体が2半音高い/);
  assert.match(moved.subtitle, /並び方は合っている/);
});

test("augmented chords are correct when the same pitch classes are chosen", () => {
  const same = judge({ rootPc: 0, typeId: "aug" }, [4, 8, 0], "tones");
  assert.equal(same.correct, true);
});

test("nearest midi stays on the requested pitch class", () => {
  assert.equal(nearestMidi(9, 60) % 12, 9);
  assert.ok(Math.abs(nearestMidi(9, 60) - 60) <= 6);
});

test("note labels include solfege", () => {
  assert.equal(noteLabel(0), "C（ド）");
  assert.equal(noteLabel(6), "F#（ファ#）");
  assert.equal(noteLabel(-1), "B（シ）");
});
