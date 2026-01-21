/**
 * JudgmentSystem
 * ノート判定ロジック
 * View非依存のコアロジック
 */

import {
  type ActiveNote,
  DEFAULT_JUDGMENT_WINDOW,
  isLongNote,
  isLongNoteEndJudged,
  isLongNoteHolding,
  isLongNoteStartJudged,
  JudgmentType,
  type JudgmentWindow,
  LongNoteState,
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

  private getJudgmentFromError(absError: number): JudgmentType | null {
    if (absError <= this.judgmentWindow.perfect) {
      return JudgmentType.PERFECT;
    }
    if (absError <= this.judgmentWindow.great) {
      return JudgmentType.GREAT;
    }
    if (absError <= this.judgmentWindow.good) {
      return JudgmentType.GOOD;
    }
    if (absError <= this.judgmentWindow.bad) {
      return JudgmentType.BAD;
    }
    return null;
  }

  private findClosestNote(currentTime: number, notes: ActiveNote[]): ActiveNote | null {
    let closestNote: ActiveNote | null = null;
    let minTimeDiff = Infinity;

    for (const note of notes) {
      const timeDiff = Math.abs(currentTime - note.timing);
      if (timeDiff < minTimeDiff) {
        minTimeDiff = timeDiff;
        closestNote = note;
      }
    }

    return closestNote;
  }

  /**
   * キー入力時の判定を行う
   * @param currentTime 現在の時刻（ミリ秒）
   * @param lane 押されたレーン番号
   * @param activeNotes 判定可能なノートのリスト
   * @returns 判定結果、該当ノートがない場合はnull
   */
  judge(currentTime: number, lane: number, activeNotes: ActiveNote[]): JudgmentResult | null {
    // 該当レーンの未判定ノートを取得
    const laneNotes = activeNotes.filter((note) => note.lane === lane && !note.judged);

    if (laneNotes.length === 0) {
      return null;
    }

    // 最も近いノートを探す
    const closestNote = this.findClosestNote(currentTime, laneNotes);

    if (!closestNote) {
      return null;
    }

    // タイミング誤差（早い場合は負、遅い場合は正）
    const timingError = currentTime - closestNote.timing;
    const absError = Math.abs(timingError);

    // 判定ウィンドウに基づいて判定
    const judgment = this.getJudgmentFromError(absError);
    if (!judgment) {
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

    // ロングノートで開始判定が済んでいる場合は、開始タイミングのMissチェックをしない
    if (isLongNote(note) && isLongNoteStartJudged(note)) {
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

    // ロングノートの開始ミスの場合は状態を設定
    if (isLongNote(note)) {
      note.longNoteState = LongNoteState.START_MISSED;
    }

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

  /**
   * ロングノート開始判定
   * @param currentTime 現在の時刻（ミリ秒）
   * @param lane 押されたレーン番号
   * @param activeNotes 判定可能なノートのリスト
   * @returns 判定結果、該当ノートがない場合はnull
   */
  judgeStart(currentTime: number, lane: number, activeNotes: ActiveNote[]): JudgmentResult | null {
    // 該当レーンの未判定ロングノートを取得
    const longNotes = activeNotes.filter(
      (note) => note.lane === lane && !isLongNoteStartJudged(note) && isLongNote(note)
    );

    if (longNotes.length === 0) {
      return null;
    }

    // 最も近いノートを探す
    const closestNote = this.findClosestNote(currentTime, longNotes);

    if (!closestNote) {
      return null;
    }

    // タイミング誤差
    const timingError = currentTime - closestNote.timing;
    const absError = Math.abs(timingError);

    // 判定ウィンドウに基づいて判定
    const judgment = this.getJudgmentFromError(absError);
    if (!judgment) {
      return null;
    }

    // ロングノート状態を更新
    closestNote.longNoteState = LongNoteState.HOLDING;
    closestNote.startJudgment = judgment;

    return {
      judgment,
      timingError,
      note: closestNote,
    };
  }

  /**
   * ロングノート終了判定
   * @param currentTime 現在の時刻（ミリ秒）
   * @param lane 離されたレーン番号
   * @param activeNotes 判定可能なノートのリスト
   * @returns 判定結果、該当ノートがない場合はnull
   */
  judgeEnd(currentTime: number, lane: number, activeNotes: ActiveNote[]): JudgmentResult | null {
    // holding状態のノートを取得
    const holdingNote = activeNotes.find((note) => note.lane === lane && isLongNoteHolding(note));

    if (!holdingNote || !holdingNote.endTiming) {
      return null;
    }

    // タイミング誤差
    const timingError = currentTime - holdingNote.endTiming;
    const absError = Math.abs(timingError);

    // 判定ウィンドウに基づいて判定
    const judgment = this.getJudgmentFromError(absError) ?? JudgmentType.MISS;

    // ロングノート状態を更新
    holdingNote.longNoteState = LongNoteState.COMPLETED;
    holdingNote.endJudgment = judgment;
    holdingNote.judged = true; // 全体として判定完了

    return {
      judgment,
      timingError,
      note: holdingNote,
    };
  }

  /**
   * ロングノート終了タイミングのMissチェック
   * @param currentTime 現在の時刻（ミリ秒）
   * @param note チェックするノート
   * @returns Miss判定すべき場合はtrue
   */
  shouldMissEnd(currentTime: number, note: ActiveNote): boolean {
    if (!isLongNote(note) || isLongNoteEndJudged(note) || !note.endTiming) {
      return false;
    }

    // 開始判定が完了している場合のみチェック
    if (!isLongNoteStartJudged(note)) {
      return false;
    }

    // 判定ウィンドウ（Bad）を過ぎたらMiss
    const timeDiff = currentTime - note.endTiming;
    return timeDiff > this.judgmentWindow.bad;
  }

  /**
   * ロングノート終了のMiss判定を行う
   * @param note Miss判定するノート
   * @returns 判定結果
   */
  missEnd(note: ActiveNote): JudgmentResult {
    note.longNoteState = LongNoteState.COMPLETED;
    note.endJudgment = JudgmentType.MISS;
    note.judged = true;

    return {
      judgment: JudgmentType.MISS,
      timingError: 0,
      note,
    };
  }

  /**
   * 途中でキーを離したロングノートの処理
   * @param note 途中で離したノート
   * @returns 判定結果
   */
  releaseEarly(note: ActiveNote): JudgmentResult {
    note.longNoteState = LongNoteState.RELEASED_EARLY;
    note.endJudgment = JudgmentType.MISS;
    note.judged = true;

    return {
      judgment: JudgmentType.MISS,
      timingError: 0,
      note,
    };
  }
}
