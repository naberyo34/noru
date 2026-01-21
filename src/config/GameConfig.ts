/**
 * ゲーム全体の設定値
 * 調整が必要な値をここに集約
 */

import { JudgmentType } from '../core/ChartData';

/**
 * 画面解像度
 */
export const SCREEN = {
  WIDTH: 320,
  HEIGHT: 240,
  MAX_SCALE: 2,
} as const;

/**
 * ゲームプレイ設定
 */
export const GAMEPLAY = {
  // レーン設定
  LANE_WIDTH: 32,
  LANE_Y_CENTER: 140,
  
  // ノート設定
  NOTE_SIZE: 24,
  NOTE_SPEED: 160, // ピクセル/秒
  NOTE_SPAWN_Y: 0,
  
  // 判定設定
  JUDGMENT_LINE_Y: 200,
  
  // 計算値
  get NOTE_TRAVEL_TIME() {
    return (this.JUDGMENT_LINE_Y - this.NOTE_SPAWN_Y) / this.NOTE_SPEED * 1000;
  },
} as const;

/**
 * 判定色設定（16進数カラーコード）
 */
export const JUDGMENT_COLORS = {
  [JudgmentType.PERFECT]: 0xffff00,
  [JudgmentType.GREAT]: 0x00ff00,
  [JudgmentType.GOOD]: 0x00ffff,
  [JudgmentType.BAD]: 0xff8800,
  [JudgmentType.MISS]: 0xff0000,
} as const;

/**
 * 判定色設定（CSS文字列）
 */
export const JUDGMENT_COLORS_CSS = {
  [JudgmentType.PERFECT]: '#ffff00',
  [JudgmentType.GREAT]: '#00ff00',
  [JudgmentType.GOOD]: '#00ffff',
  [JudgmentType.BAD]: '#ff8800',
  [JudgmentType.MISS]: '#ff0000',
} as const;

/**
 * レーンノート色設定
 */
export const LANE_NOTE_COLORS = [
  0xff0000, // Lane 0: 赤
  0xff8800, // Lane 1: オレンジ
  0xffff00, // Lane 2: 黄
  0x00ff00, // Lane 3: 緑
  0x00ffff, // Lane 4: シアン
  0x0088ff, // Lane 5: 青
  0x0000ff, // Lane 6: 濃青
  0xff00ff, // Lane 7: マゼンタ
] as const;

/**
 * エフェクト設定
 */
export const EFFECTS = {
  // ヒットエフェクト
  HIT_GLOW_RADIUS: 12,
  HIT_GLOW_DURATION: 200,
  HIT_PARTICLE_COUNT: 4,
  HIT_PARTICLE_DISTANCE: 20,
  HIT_PARTICLE_DURATION: 300,
  
  // 判定テキスト
  JUDGMENT_TEXT_Y: 168,
  JUDGMENT_TEXT_DURATION: 500,
  
  // カウントダウン
  COUNTDOWN_DURATION: 600,
  COUNTDOWN_START_DURATION: 500,
} as const;

/**
 * UI設定
 */
export const UI = {
  // フォントサイズ
  FONT_TITLE: '11px',
  FONT_ARTIST: '7px',
  FONT_SCORE: '8px',
  FONT_JUDGMENT: '14px',
  FONT_COUNTDOWN: '29px',
  FONT_COUNTDOWN_START: '19px',
  FONT_LANE_KEY: '10px',
  
  // 配置
  SCORE_X: 4,
  SCORE_Y: 4,
  ACCURACY_OFFSET: 4,
  TITLE_Y: 10,
  ARTIST_Y: 22,
  LANE_KEY_Y_OFFSET: 28,
} as const;

/**
 * アニメーション設定
 */
export const ANIMATION = {
  FADE_IN_DURATION: 500,
  FADE_OUT_DURATION: 500,
  FADE_OUT_TO_GAME: 300,
  LANE_HIGHLIGHT_DURATION: 150,
} as const;
