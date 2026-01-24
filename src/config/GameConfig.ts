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
    return ((this.JUDGMENT_LINE_Y - this.NOTE_SPAWN_Y) / this.NOTE_SPEED) * 1000;
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

  // レーンハイライト（キー押下時のフィードバック）
  LANE_HIGHLIGHT_COLOR: 0xffffff, // 白色
  LANE_HIGHLIGHT_ALPHA: 0.2, // 薄く
  AUTO_HIGHLIGHT_DURATION: 100,

  // ロングノート長押しエフェクト
  LONG_NOTE_HOLD_RADIUS: 15,
  LONG_NOTE_HOLD_PULSE_DURATION: 300,

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
  FONT_ACCURACY: '8px',
  FONT_SONG_INFO: '8px',
  FONT_JUDGMENT: '14px',
  FONT_COUNTDOWN: '48px',
  FONT_COUNTDOWN_START: '48px',
  FONT_LANE_KEY: '10px',
  FONT_LOADING: '20px',
  FONT_ERROR: '16px',
  TEXT_PRIMARY: '#ffffff',
  HI_SPEED_X_OFFSET: 10,
  HI_SPEED_COLOR: '#888888',
  AUTO_LABEL_Y: 8,
  AUTO_LABEL_FONT: '10px',
  AUTO_LABEL_COLOR: '#ffff00',
  AUTO_LABEL_FONT_STYLE: 'bold',

  // 配置
  SCORE_X: 10,
  SCORE_Y: 10,
  ACCURACY_OFFSET: 15,
  TITLE_Y: 10,
  ARTIST_Y: 22,
  SONG_INFO_Y: 10,
  LANE_KEY_Y_OFFSET: 28,
} as const;

/**
 * ハイスピード設定
 */
export const HI_SPEED = {
  DEFAULT: 1.0,
  MIN: 0.1,
  MAX: 2.0,
  STEP: 0.1,
} as const;

/**
 * アニメーション設定
 */
export const ANIMATION = {
  FADE_IN_DURATION: 500,
  FADE_OUT_DURATION: 500,
  FADE_OUT_TO_GAME: 300,
  LANE_HIGHLIGHT_DURATION: 150,
  LANE_HIGHLIGHT_FADE_OUT: 120, // レーンハイライトのフェードアウト時間
} as const;

/**
 * タイトル画面UI設定
 */
export const TITLE_SCREEN = {
  BACKGROUND_COLOR: 0x0a0a1e,
  TITLE_FONT: '38px',
  TITLE_COLOR: '#ffffff',
  TITLE_OFFSET_Y: -32,
  SUBTITLE_FONT: '13px',
  SUBTITLE_COLOR: '#888888',
  SUBTITLE_OFFSET_Y: 8,
  START_PROMPT_FONT: '10px',
  START_PROMPT_COLOR: '#ffffff',
  START_PROMPT_OFFSET_Y: 48,
  START_PROMPT_BLINK_DURATION: 1000,
  START_PROMPT_MIN_ALPHA: 0.3,
  VERSION_FONT: '6px',
  VERSION_COLOR: '#444444',
  VERSION_OFFSET: 8,
} as const;

/**
 * 楽曲選択画面UI設定
 */
export const SONG_SELECT_UI = {
  BACKGROUND_COLOR: 0x1a1a2e,
  TITLE_Y: 16,
  TITLE_FONT: '14px',
  TITLE_COLOR: '#ffffff',
  INFO_BASE_OFFSET_Y: -24,
  SONG_TITLE_FONT: '19px',
  SONG_TITLE_COLOR: '#ffffff',
  ARTIST_OFFSET_Y: 24,
  ARTIST_FONT: '10px',
  ARTIST_COLOR: '#cccccc',
  BPM_OFFSET_Y: 40,
  BPM_FONT: '8px',
  BPM_COLOR: '#888888',
  DIFFICULTY_OFFSET_Y: 64,
  DIFFICULTY_FONT: '13px',
  STAR_OFFSET_Y: 80,
  STAR_FONT: '10px',
  STAR_COLOR: '#ffff00',
  INDEX_OFFSET_Y: 100,
  INDEX_FONT: '7px',
  INDEX_COLOR: '#666666',
  HINT1_OFFSET_Y: 40,
  HINT1_FONT: '6px',
  HINT1_COLOR: '#888888',
  HINT2_OFFSET_Y: 28,
  HINT2_FONT: '7px',
  HINT2_COLOR: '#ffffff',
  HINT3_OFFSET_Y: 16,
  HINT3_FONT: '6px',
  HINT3_COLOR: '#888888',
  DIFFICULTY_COLORS: {
    EASY: '#00ff00',
    NORMAL: '#00ffff',
    HARD: '#ffff00',
    EXPERT: '#ff8800',
    MASTER: '#ff0000',
  },
} as const;

/**
 * リザルト画面UI設定
 */
export const RESULT_UI = {
  BACKGROUND_COLOR: 0x000000,
  BACKGROUND_ALPHA: 0.95,
  TITLE_Y: 32,
  TITLE_FONT: '19px',
  TITLE_COLOR: '#ffffff',
  SONG_TITLE_Y: 52,
  SONG_TITLE_FONT: '10px',
  SONG_TITLE_COLOR: '#cccccc',
  SONG_ARTIST_Y: 64,
  SONG_ARTIST_FONT: '7px',
  SONG_ARTIST_COLOR: '#888888',
  SCORE_Y: 88,
  SCORE_FONT: '14px',
  SCORE_COLOR: '#ffffff',
  ACCURACY_Y: 108,
  ACCURACY_FONT: '11px',
  MAX_COMBO_Y: 126,
  MAX_COMBO_FONT: '10px',
  MAX_COMBO_COLOR: '#ffff00',
  JUDGMENT_TITLE_Y: 140,
  JUDGMENT_TITLE_FONT: '8px',
  JUDGMENT_TITLE_COLOR: '#888888',
  JUDGMENT_START_OFFSET: 12,
  JUDGMENT_ROW_GAP: 12,
  JUDGMENT_LABEL_X_OFFSET: -40,
  JUDGMENT_VALUE_X_OFFSET: 40,
  JUDGMENT_LABEL_FONT: '7px',
  JUDGMENT_VALUE_FONT: '7px',
  JUDGMENT_VALUE_COLOR: '#ffffff',
  HINT1_OFFSET_Y: 24,
  HINT1_FONT: '7px',
  HINT1_COLOR: '#ffffff',
  HINT2_OFFSET_Y: 12,
  HINT2_FONT: '6px',
  HINT2_COLOR: '#888888',
  ACCURACY_THRESHOLDS: {
    PERFECT: 95,
    GREAT: 90,
    GOOD: 80,
    BAD: 70,
  },
} as const;
