/**
 * JudgmentSystem
 * ノート判定ロジック
 * View非依存のコアロジック
 */

import {
  JudgmentType,
  JudgmentWindow,
  DEFAULT_JUDGMENT_WINDOW,
  ActiveNote,
} from './ChartData';

export interface JudgmentResult {
  judgment: JudgmentType;
  timingError: number; // タイミング誤差（ミリ秒）、早い場合は負、遅い場合は正
  note: ActiveNote;
}

export class JudgmentSystem {
  private judgmentWindow: JudgmentWindow;

  constructor(judgmentWindow: JudgmentWindow = DEFAULT_JUDGMENT_WINDOW) {
    this.judgmentWindow = judgmentWindow;
  }

  /**
   * キー入力時の判定を行う
   * @param currentTime 現在の時刻（ミリ秒）
   * @param lane 押されたレーン番号
   * @param activeNotes 判定可能なノートのリスト
   * @returns 判定結果、該当ノートがない場合はnull
   */
  judge(
    currentTime: number,
    lane: number,
    activeNotes: ActiveNote[]
  ): JudgmentResult | null {
    // 該当レーンの未判定ノートを取得
    const laneNotes = activeNotes.filter(
      (note) => note.lane === lane && !note.judged
    );

    if (laneNotes.length === 0) {
      return null;
    }

    // 最も近いノートを探す
    let closestNote: ActiveNote | null = null;
    let minTimeDiff = Infinity;

    for (const note of laneNotes) {
      const timeDiff = Math.abs(currentTime - note.timing);
      if (timeDiff < minTimeDiff) {
        minTimeDiff = timeDiff;
        closestNote = note;
      }
    }

    if (!closestNote) {
      return null;
    }

    // タイミング誤差（早い場合は負、遅い場合は正）
    const timingError = currentTime - closestNote.timing;
    const absError = Math.abs(timingError);

    // 判定ウィンドウに基づいて判定
    let judgment: JudgmentType;

    if (absError <= this.judgmentWindow.perfect) {
      judgment = JudgmentType.PERFECT;
    } else if (absError <= this.judgmentWindow.great) {
      judgment = JudgmentType.GREAT;
    } else if (absError <= this.judgmentWindow.good) {
      judgment = JudgmentType.GOOD;
    } else if (absError <= this.judgmentWindow.bad) {
      judgment = JudgmentType.BAD;
    } else {
      // 判定ウィンドウ外
      return null;
    }

    // ノートに判定を記録
    closestNote.judged = true;
    closestNote.judgmentType = judgment;

    return {
      judgment,
      timingError,
      note: closestNote,
    };
  }

  /**
   * ノートがMiss判定ラインを通過したかチェック
   * @param currentTime 現在の時刻（ミリ秒）
   * @param note チェックするノート
   * @returns Miss判定すべき場合はtrue
   */
  shouldMiss(currentTime: number, note: ActiveNote): boolean {
    if (note.judged) {
      return false;
    }

    // 判定ウィンドウ（Bad）を過ぎたらMiss
    const timeDiff = currentTime - note.timing;
    return timeDiff > this.judgmentWindow.bad;
  }

  /**
   * Miss判定を行う
   * @param note Miss判定するノート
   * @returns 判定結果
   */
  miss(note: ActiveNote): JudgmentResult {
    note.judged = true;
    note.judgmentType = JudgmentType.MISS;

    return {
      judgment: JudgmentType.MISS,
      timingError: 0, // Missの場合はタイミング誤差は記録しない
      note,
    };
  }

  /**
   * 判定ウィンドウを設定
   */
  setJudgmentWindow(window: JudgmentWindow): void {
    this.judgmentWindow = window;
  }

  /**
   * 判定ウィンドウを取得
   */
  getJudgmentWindow(): JudgmentWindow {
    return { ...this.judgmentWindow };
  }
}
