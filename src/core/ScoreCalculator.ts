/**
 * ScoreCalculator
 * スコア計算とコンボ管理
 * View非依存のコアロジック
 */

import { JudgmentType, type PlayResult } from './ChartData';

/**
 * 判定ごとの基本スコア配分
 */
const JUDGMENT_SCORES = {
  [JudgmentType.PERFECT]: 100,
  [JudgmentType.GREAT]: 80,
  [JudgmentType.GOOD]: 60,
  [JudgmentType.BAD]: 30,
  [JudgmentType.MISS]: 0,
};

/**
 * 判定ごとの正確度（Accuracy計算用）
 */
const JUDGMENT_ACCURACY = {
  [JudgmentType.PERFECT]: 1.0,
  [JudgmentType.GREAT]: 0.9,
  [JudgmentType.GOOD]: 0.7,
  [JudgmentType.BAD]: 0.4,
  [JudgmentType.MISS]: 0.0,
};

export class ScoreCalculator {
  private currentScore: number = 0;
  private currentCombo: number = 0;
  private maxCombo: number = 0;
  private totalNotes: number = 0;
  private judgmentCounts: {
    [JudgmentType.PERFECT]: number;
    [JudgmentType.GREAT]: number;
    [JudgmentType.GOOD]: number;
    [JudgmentType.BAD]: number;
    [JudgmentType.MISS]: number;
  };

  constructor(totalNotes: number) {
    this.totalNotes = totalNotes;
    this.judgmentCounts = {
      [JudgmentType.PERFECT]: 0,
      [JudgmentType.GREAT]: 0,
      [JudgmentType.GOOD]: 0,
      [JudgmentType.BAD]: 0,
      [JudgmentType.MISS]: 0,
    };
  }

  /**
   * 判定結果からスコアを加算
   * @param judgment 判定結果
   */
  addJudgment(judgment: JudgmentType): void {
    // 判定カウントを増やす
    this.judgmentCounts[judgment]++;

    // 基本スコアを加算
    const baseScore = JUDGMENT_SCORES[judgment];

    // コンボボーナスを計算（コンボが続くほどスコアが増える）
    const comboMultiplier = 1 + Math.floor(this.currentCombo / 10) * 0.1;
    const finalScore = Math.floor(baseScore * comboMultiplier);

    this.currentScore += finalScore;

    // コンボ管理
    if (judgment === JudgmentType.MISS || judgment === JudgmentType.BAD) {
      // MissまたはBadでコンボが途切れる
      this.currentCombo = 0;
    } else {
      // それ以外はコンボ継続
      this.currentCombo++;
      this.maxCombo = Math.max(this.maxCombo, this.currentCombo);
    }
  }

  /**
   * 現在のスコアを取得
   */
  getScore(): number {
    return this.currentScore;
  }

  /**
   * 現在のコンボを取得
   */
  getCurrentCombo(): number {
    return this.currentCombo;
  }

  /**
   * 最大コンボを取得
   */
  getMaxCombo(): number {
    return this.maxCombo;
  }

  /**
   * 正確度（Accuracy）を計算
   * @returns 正確度（%）
   */
  getAccuracy(): number {
    if (this.totalNotes === 0) {
      return 0;
    }

    let totalAccuracy = 0;
    for (const [judgment, count] of Object.entries(this.judgmentCounts)) {
      totalAccuracy += JUDGMENT_ACCURACY[judgment as JudgmentType] * count;
    }

    return (totalAccuracy / this.totalNotes) * 100;
  }

  /**
   * 判定カウントを取得
   */
  getJudgmentCounts() {
    return { ...this.judgmentCounts };
  }

  /**
   * 最終結果を取得
   */
  getResult(): PlayResult {
    return {
      score: this.currentScore,
      accuracy: this.getAccuracy(),
      maxCombo: this.maxCombo,
      judgmentCounts: { ...this.judgmentCounts },
    };
  }

  /**
   * スコアをリセット
   */
  reset(): void {
    this.currentScore = 0;
    this.currentCombo = 0;
    this.maxCombo = 0;
    this.judgmentCounts = {
      [JudgmentType.PERFECT]: 0,
      [JudgmentType.GREAT]: 0,
      [JudgmentType.GOOD]: 0,
      [JudgmentType.BAD]: 0,
      [JudgmentType.MISS]: 0,
    };
  }
}
