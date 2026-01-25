import { describe, expect, it } from 'vitest';
import {
  type ActiveNote,
  DEFAULT_JUDGMENT_WINDOW,
  JudgmentType,
  LongNoteState,
} from '../ChartData';
import { JudgmentSystem } from '../JudgmentSystem';

const createNote = (overrides: Partial<ActiveNote>): ActiveNote => ({
  id: overrides.id ?? 'note-1',
  lane: overrides.lane ?? 0,
  timing: overrides.timing ?? 1000,
  judged: overrides.judged ?? false,
  endTiming: overrides.endTiming,
  longNoteState: overrides.longNoteState,
  startJudgment: overrides.startJudgment,
  endJudgment: overrides.endJudgment,
  judgmentType: overrides.judgmentType,
});

describe('JudgmentSystem', () => {
  it('通常ノートがPerfect範囲内で判定される', () => {
    const system = new JudgmentSystem();
    const note = createNote({ timing: 1000, lane: 2 });

    const result = system.judge(1030, 2, [note]);

    expect(result?.judgment).toBe(JudgmentType.PERFECT);
    expect(note.judged).toBe(true);
  });

  it('レーンが一致しない場合はnullを返す', () => {
    const system = new JudgmentSystem();
    const note = createNote({ timing: 1000, lane: 1 });

    const result = system.judge(1000, 2, [note]);

    expect(result).toBeNull();
    expect(note.judged).toBe(false);
  });

  it('Perfect範囲外ならGreatになる', () => {
    const system = new JudgmentSystem();
    const note = createNote({ timing: 1000, lane: 0 });

    const result = system.judge(1031, 0, [note]);

    expect(result?.judgment).toBe(JudgmentType.GREAT);
  });

  it('ロングノート開始と終了を判定する', () => {
    const system = new JudgmentSystem();
    const note = createNote({ timing: 1000, endTiming: 1400, lane: 3 });

    const start = system.judgeStart(1000, 3, [note]);
    expect(start?.judgment).toBe(JudgmentType.PERFECT);
    expect(note.longNoteState).toBe(LongNoteState.HOLDING);

    const end = system.judgeEnd(1400, 3, [note]);
    expect(end?.judgment).toBe(JudgmentType.PERFECT);
    expect(note.endJudgment).toBe(JudgmentType.PERFECT);
    expect(note.judged).toBe(true);
  });

  it('ロングノート終了が遅いとMISSになる', () => {
    const system = new JudgmentSystem();
    const note = createNote({
      timing: 1000,
      endTiming: 1400,
      lane: 1,
      longNoteState: LongNoteState.HOLDING,
    });

    const end = system.judgeEnd(1600, 1, [note]);

    expect(end?.judgment).toBe(JudgmentType.MISS);
    expect(note.endJudgment).toBe(JudgmentType.MISS);
  });

  it('判定ウィンドウ境界で正しい結果になる', () => {
    const system = new JudgmentSystem();
    const { perfect, great, good, bad } = DEFAULT_JUDGMENT_WINDOW;
    const baseTiming = 1000;

    const note1 = createNote({ timing: baseTiming, lane: 0 });
    expect(system.judge(baseTiming + perfect, 0, [note1])?.judgment).toBe(JudgmentType.PERFECT);

    const note2 = createNote({ timing: baseTiming, lane: 0 });
    expect(system.judge(baseTiming + great, 0, [note2])?.judgment).toBe(JudgmentType.GREAT);

    const note3 = createNote({ timing: baseTiming, lane: 0 });
    expect(system.judge(baseTiming + good, 0, [note3])?.judgment).toBe(JudgmentType.GOOD);

    const note4 = createNote({ timing: baseTiming, lane: 0 });
    expect(system.judge(baseTiming + bad, 0, [note4])?.judgment).toBe(JudgmentType.BAD);
  });

  it('Miss判定はbadを超えた時のみ発生する', () => {
    const system = new JudgmentSystem();
    const { bad } = DEFAULT_JUDGMENT_WINDOW;
    const baseTiming = 1000;
    const note = createNote({ timing: baseTiming, lane: 2 });

    expect(system.shouldMiss(baseTiming + bad, note)).toBe(false);
    expect(system.shouldMiss(baseTiming + bad + 1, note)).toBe(true);
  });

  it('ロングノート終了のMiss判定境界が正しい', () => {
    const system = new JudgmentSystem();
    const { bad } = DEFAULT_JUDGMENT_WINDOW;
    const endTiming = 1500;
    const note = createNote({
      timing: 1000,
      endTiming,
      lane: 2,
      longNoteState: LongNoteState.HOLDING,
    });

    expect(system.shouldMissEnd(endTiming + bad, note)).toBe(false);
    expect(system.shouldMissEnd(endTiming + bad + 1, note)).toBe(true);
  });

  it('ロングノートの途中離しで状態が更新される', () => {
    const system = new JudgmentSystem();
    const note = createNote({
      timing: 1000,
      endTiming: 1400,
      lane: 3,
      longNoteState: LongNoteState.HOLDING,
    });

    const result = system.releaseEarly(note);

    expect(result.judgment).toBe(JudgmentType.MISS);
    expect(note.longNoteState).toBe(LongNoteState.RELEASED_EARLY);
    expect(note.endJudgment).toBe(JudgmentType.MISS);
    expect(note.judged).toBe(true);
  });
});
