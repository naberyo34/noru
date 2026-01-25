import { describe, expect, it } from 'vitest';
import {
  type ActiveNote,
  getKeyFromLane,
  getLaneFromKey,
  isLongNote,
  isLongNoteEndJudged,
  isLongNoteHolding,
  isLongNoteStartJudged,
  LongNoteState,
  type NoteData,
} from '../ChartData';

describe('ChartData helpers', () => {
  it('キーとレーンの相互変換ができる', () => {
    expect(getLaneFromKey('a')).toBe(0);
    expect(getLaneFromKey('A')).toBe(0);
    expect(getLaneFromKey('Semicolon')).toBe(6);
    expect(getLaneFromKey(';')).toBe(6);
    expect(getLaneFromKey(':')).toBe(6);
    expect(getLaneFromKey('Quote')).toBe(7);
    expect(getLaneFromKey("'")).toBe(7);
    expect(getLaneFromKey('"')).toBe(7);
    expect(getLaneFromKey('unknown')).toBeNull();

    expect(getKeyFromLane(0)).toBe('a');
    expect(getKeyFromLane(7)).toBe("'");
    expect(getKeyFromLane(99)).toBeNull();
  });

  it('ロングノート判定が正しい', () => {
    const shortNote: NoteData = { lane: 0, timing: 1000 };
    const longNote: NoteData = { lane: 0, timing: 1000, endTiming: 1200 };

    expect(isLongNote(shortNote)).toBe(false);
    expect(isLongNote(longNote)).toBe(true);
  });

  it('ロングノート状態ヘルパーが正しく動作する', () => {
    const baseNote: ActiveNote = {
      id: 'note-1',
      lane: 0,
      timing: 1000,
      endTiming: 1400,
      judged: false,
    };

    const holdingNote: ActiveNote = {
      ...baseNote,
      longNoteState: LongNoteState.HOLDING,
    };
    expect(isLongNoteStartJudged(holdingNote)).toBe(true);
    expect(isLongNoteHolding(holdingNote)).toBe(true);
    expect(isLongNoteEndJudged(holdingNote)).toBe(false);

    const completedNote: ActiveNote = {
      ...baseNote,
      longNoteState: LongNoteState.COMPLETED,
    };
    expect(isLongNoteStartJudged(completedNote)).toBe(true);
    expect(isLongNoteEndJudged(completedNote)).toBe(true);

    const startMissedNote: ActiveNote = {
      ...baseNote,
      longNoteState: LongNoteState.START_MISSED,
    };
    expect(isLongNoteStartJudged(startMissedNote)).toBe(true);
    expect(isLongNoteEndJudged(startMissedNote)).toBe(false);

    const releasedEarlyNote: ActiveNote = {
      ...baseNote,
      longNoteState: LongNoteState.RELEASED_EARLY,
    };
    expect(isLongNoteStartJudged(releasedEarlyNote)).toBe(true);
    expect(isLongNoteEndJudged(releasedEarlyNote)).toBe(true);
  });
});
