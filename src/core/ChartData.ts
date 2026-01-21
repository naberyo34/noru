/**
 * 譜面データの型定義
 * View非依存のコアデータ構造
 */

/**
 * 判定結果の種類（5段階）
 */
export enum JudgmentType {
  PERFECT = 'PERFECT',
  GREAT = 'GREAT',
  GOOD = 'GOOD',
  BAD = 'BAD',
  MISS = 'MISS',
}

/**
 * ロングノートの状態
 */
export enum LongNoteState {
  NOT_STARTED = 'NOT_STARTED', // まだ押されていない
  HOLDING = 'HOLDING', // 押している（開始判定成功）
  START_MISSED = 'START_MISSED', // 開始判定ミス
  RELEASED_EARLY = 'RELEASED_EARLY', // 早く離した
  COMPLETED = 'COMPLETED', // 終了判定完了
}

/**
 * 判定ウィンドウ設定（ミリ秒）
 */
export interface JudgmentWindow {
  perfect: number; // ±30ms
  great: number; // ±60ms
  good: number; // ±90ms
  bad: number; // ±120ms
}

/**
 * デフォルト判定ウィンドウ
 */
export const DEFAULT_JUDGMENT_WINDOW: JudgmentWindow = {
  perfect: 30,
  great: 60,
  good: 90,
  bad: 120,
};

/**
 * ノートデータ
 */
export interface NoteData {
  lane: number; // レーン番号 (0-7)
  timing: number; // 開始タイミング（ミリ秒）
  endTiming?: number; // 終了タイミング（ミリ秒）- ロングノートの場合のみ
  id?: string; // ノート識別用ID（オプショナル）
}

/**
 * 譜面メタデータ
 */
export interface ChartMetadata {
  title: string; // 楽曲タイトル
  artist: string; // アーティスト名
  audioFile: string; // .wavファイルパス
  bpm: number; // BPM（初期実装は固定BPM）
  timeSignature: [number, number]; // 拍子 [4, 4] 固定
  offset: number; // 音楽とノートの同期オフセット(ms)
}

/**
 * 譜面データ全体
 */
export interface ChartData {
  metadata: ChartMetadata;
  notes: NoteData[];

  // 将来の拡張用（未実装）
  bpmChanges?: Array<{ timing: number; bpm: number }>;
  activeLanes?: number[]; // 使用レーン指定（4〜8レーン可変）
}

/**
 * ゲームプレイ中のノート状態
 */
export interface ActiveNote extends NoteData {
  id: string; // 必須のID
  judged: boolean; // 判定済みか（通常ノートまたはロングノート全体）
  judgmentType?: JudgmentType; // 判定結果

  // ロングノート用フィールド
  longNoteState?: LongNoteState; // ロングノートの状態
  startJudgment?: JudgmentType; // 開始判定結果
  endJudgment?: JudgmentType; // 終了判定結果
}

/**
 * プレイ結果データ
 */
export interface PlayResult {
  score: number;
  accuracy: number; // 正確度（%）
  maxCombo: number;
  judgmentCounts: {
    [JudgmentType.PERFECT]: number;
    [JudgmentType.GREAT]: number;
    [JudgmentType.GOOD]: number;
    [JudgmentType.BAD]: number;
    [JudgmentType.MISS]: number;
  };
}

/**
 * レーン設定
 */
export const LANE_COUNT = 8;
export const LANE_KEYS = ['a', 's', 'd', 'f', 'k', 'l', ';', "'"] as const;
export type LaneKey = (typeof LANE_KEYS)[number];

// KeyboardEvent.key と KeyboardEvent.code のマッピング
const KEY_TO_LANE_MAP: { [key: string]: number } = {
  a: 0,
  A: 0,
  s: 1,
  S: 1,
  d: 2,
  D: 2,
  f: 3,
  F: 3,
  k: 4,
  K: 4,
  l: 5,
  L: 5,
  ';': 6,
  ':': 6,
  Semicolon: 6,
  "'": 7,
  '"': 7,
  Quote: 7,
};

/**
 * ヘルパー関数: キーからレーン番号を取得
 * KeyboardEvent.key または KeyboardEvent.code を受け取る
 */
export function getLaneFromKey(key: string): number | null {
  return KEY_TO_LANE_MAP[key] ?? null;
}

/**
 * ヘルパー関数: レーン番号からキーを取得
 */
export function getKeyFromLane(lane: number): LaneKey | null {
  return LANE_KEYS[lane] ?? null;
}

/**
 * ヘルパー関数: ロングノートかどうかを判定
 */
export function isLongNote(note: NoteData): boolean {
  return note.endTiming !== undefined && note.endTiming > note.timing;
}

/**
 * ヘルパー関数: ロングノートの開始判定が完了しているか
 */
export function isLongNoteStartJudged(note: ActiveNote): boolean {
  if (!isLongNote(note)) return false;
  return (
    note.longNoteState === LongNoteState.HOLDING ||
    note.longNoteState === LongNoteState.START_MISSED ||
    note.longNoteState === LongNoteState.RELEASED_EARLY ||
    note.longNoteState === LongNoteState.COMPLETED
  );
}

/**
 * ヘルパー関数: ロングノートの終了判定が完了しているか
 */
export function isLongNoteEndJudged(note: ActiveNote): boolean {
  if (!isLongNote(note)) return false;
  return (
    note.longNoteState === LongNoteState.RELEASED_EARLY ||
    note.longNoteState === LongNoteState.COMPLETED
  );
}

/**
 * ヘルパー関数: ロングノートを押している状態か
 */
export function isLongNoteHolding(note: ActiveNote): boolean {
  return note.longNoteState === LongNoteState.HOLDING;
}
