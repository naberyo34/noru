import { describe, expect, it } from 'vitest';
import { JudgmentType, type NoteData } from '../ChartData';
import { ScoreCalculator } from '../ScoreCalculator';

describe('ScoreCalculator', () => {
  it('ロングノートは2回分として数える', () => {
    const notes: NoteData[] = [
      { lane: 0, timing: 1000 },
      { lane: 1, timing: 1200, endTiming: 1600 },
    ];
    const calculator = new ScoreCalculator(notes);

    calculator.addJudgment(JudgmentType.PERFECT);
    calculator.addJudgment(JudgmentType.GREAT);
    calculator.addJudgment(JudgmentType.MISS);

    expect(calculator.getAccuracy()).toBeCloseTo(((1.0 + 0.9 + 0.0) / 3) * 100, 5);
  });

  it('BADとMISSでコンボがリセットされる', () => {
    const calculator = new ScoreCalculator([{ lane: 0, timing: 1000 }]);

    calculator.addJudgment(JudgmentType.PERFECT);
    calculator.addJudgment(JudgmentType.GREAT);
    expect(calculator.getCurrentCombo()).toBe(2);

    calculator.addJudgment(JudgmentType.BAD);
    expect(calculator.getCurrentCombo()).toBe(0);

    calculator.addJudgment(JudgmentType.PERFECT);
    calculator.addJudgment(JudgmentType.MISS);
    expect(calculator.getCurrentCombo()).toBe(0);
  });

  it('コンボ倍率の境界でスコアが加算される', () => {
    const calculator = new ScoreCalculator([{ lane: 0, timing: 1000 }]);

    for (let i = 0; i < 9; i++) {
      calculator.addJudgment(JudgmentType.PERFECT);
    }
    expect(calculator.getCurrentCombo()).toBe(9);

    calculator.addJudgment(JudgmentType.PERFECT);
    const scoreAfter10 = calculator.getScore();
    expect(scoreAfter10).toBe(1000);

    calculator.addJudgment(JudgmentType.PERFECT);
    expect(calculator.getScore()).toBe(1110);
  });

  it('resetでスコアと判定が初期化される', () => {
    const calculator = new ScoreCalculator([{ lane: 0, timing: 1000 }]);

    calculator.addJudgment(JudgmentType.GREAT);
    calculator.addJudgment(JudgmentType.MISS);
    calculator.reset();

    expect(calculator.getScore()).toBe(0);
    expect(calculator.getCurrentCombo()).toBe(0);
    expect(calculator.getMaxCombo()).toBe(0);
    expect(calculator.getAccuracy()).toBe(0);
  });
});
