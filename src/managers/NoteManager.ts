/**
 * NoteManager
 * ノートの生成・更新・削除を管理するマネージャー
 */

import type Phaser from 'phaser';
import { GAMEPLAY, LANE_NOTE_COLORS } from '../config/GameConfig';
import {
  type ActiveNote,
  type ChartData,
  DEFAULT_JUDGMENT_WINDOW,
  isLongNote,
  isLongNoteEndJudged,
  isLongNoteHolding,
  LANE_COUNT,
  LongNoteState,
} from '../core/ChartData';

export class NoteManager {
  private scene: Phaser.Scene;
  private chartData: ChartData;
  private activeNotes: ActiveNote[] = [];
  private noteSprites: Map<string, Phaser.GameObjects.Rectangle> = new Map();
  private noteIndex: number = 0;
  private lanePositions: number[];

  constructor(scene: Phaser.Scene, chartData: ChartData, lanePositions: number[]) {
    this.scene = scene;
    this.chartData = chartData;
    this.lanePositions = lanePositions;
  }

  /**
   * ノートを生成
   */
  spawnNotes(currentTime: number): void {
    // ノートが判定ラインに到達する時間分だけ前に生成する
    while (this.noteIndex < this.chartData.notes.length) {
      const note = this.chartData.notes[this.noteIndex];
      const timeUntilNote = note.timing - currentTime;

      // ノートの落下時間より前になったら生成
      if (timeUntilNote <= GAMEPLAY.NOTE_TRAVEL_TIME) {
        if (note.lane < 0 || note.lane >= LANE_COUNT || !this.lanePositions[note.lane]) {
          console.warn(`Invalid lane index: ${note.lane}`, note);
          this.noteIndex++;
          continue;
        }

        // ノートを生成
        const activeNote: ActiveNote = {
          ...note,
          id: `note_${this.noteIndex}`,
          judged: false,
          // ロングノート用の初期化
          longNoteState: isLongNote(note) ? LongNoteState.NOT_STARTED : undefined,
        };
        this.activeNotes.push(activeNote);

        // スプライトを生成
        this.createNoteSprite(activeNote);

        this.noteIndex++;
      } else {
        break;
      }
    }
  }

  /**
   * ノートスプライトを作成
   */
  private createNoteSprite(note: ActiveNote): void {
    const x = this.lanePositions[note.lane];

    // 通常ノートとロングノートで形を変える
    let sprite: Phaser.GameObjects.Rectangle;

    if (isLongNote(note)) {
      // ロングノート：縦長の矩形
      sprite = this.scene.add.rectangle(
        x,
        0,
        GAMEPLAY.NOTE_SIZE,
        GAMEPLAY.NOTE_SIZE,
        LANE_NOTE_COLORS[note.lane]
      );
    } else {
      // 通常ノート：横長の平べったい矩形
      sprite = this.scene.add.rectangle(
        x,
        0,
        GAMEPLAY.LANE_WIDTH - 4,
        GAMEPLAY.NOTE_SIZE / 2,
        LANE_NOTE_COLORS[note.lane]
      );
    }

    sprite.setDepth(10); // ハイライトの上に表示
    this.noteSprites.set(note.id, sprite);
  }

  /**
   * ノートの位置を更新
   */
  updateNotes(currentTime: number): void {
    for (const note of this.activeNotes) {
      const sprite = this.noteSprites.get(note.id);
      if (!sprite) {
        continue;
      }

      if (isLongNote(note) && note.endTiming) {
        // ロングノートの描画
        const timeUntilStart = note.timing - currentTime;
        const timeUntilEnd = note.endTiming - currentTime;

        const startY = GAMEPLAY.JUDGMENT_LINE_Y - (timeUntilStart / 1000) * GAMEPLAY.NOTE_SPEED;
        const endY = GAMEPLAY.JUDGMENT_LINE_Y - (timeUntilEnd / 1000) * GAMEPLAY.NOTE_SPEED;

        // 開始判定済みで押している場合は、判定ラインから伸びる表現
        if (isLongNoteHolding(note) && !note.judged) {
          const noteHeight = Math.max(GAMEPLAY.JUDGMENT_LINE_Y - endY, 0);
          sprite.setPosition(sprite.x, GAMEPLAY.JUDGMENT_LINE_Y - noteHeight / 2);
          sprite.setSize(GAMEPLAY.NOTE_SIZE, noteHeight);
          sprite.setAlpha(0.5); // 押している間は半透明
        } else {
          // まだ押していない場合、またはミス/途中離しの場合は通常の落下
          const noteHeight = Math.abs(startY - endY);
          const centerY = (startY + endY) / 2;
          sprite.setPosition(sprite.x, centerY);
          sprite.setSize(GAMEPLAY.NOTE_SIZE, Math.max(noteHeight, GAMEPLAY.NOTE_SIZE));

          // ミスした場合は半透明に
          if (note.judged) {
            sprite.setAlpha(0.3);
          }
        }
      } else {
        // 通常ノートの位置を計算（音楽時刻に基づく）
        const timeUntilHit = note.timing - currentTime;
        const y = GAMEPLAY.JUDGMENT_LINE_Y - (timeUntilHit / 1000) * GAMEPLAY.NOTE_SPEED;
        sprite.setY(y);
      }
    }
  }

  /**
   * 完了したノートを削除
   */
  removeFinishedNotes(currentTime: number): void {
    const notesToRemove: string[] = [];

    for (const note of this.activeNotes) {
      // 通常ノートは handleJudgment() で即座に削除されるのでここには来ない
      if (!isLongNote(note)) {
        continue;
      }

      // ロングノートの削除条件:
      // 1. 終了判定が完了した（成功/失敗問わず） - handleJudgment()で削除されるのでここには来ない
      // 2. 終了判定が未完了で、endTiming + badウィンドウを超えた
      if (!isLongNoteEndJudged(note) && note.endTiming) {
        if (currentTime > note.endTiming + DEFAULT_JUDGMENT_WINDOW.bad) {
          notesToRemove.push(note.id);
        }
      }
    }

    // ノートを削除
    for (const noteId of notesToRemove) {
      this.removeNote(noteId);
    }
  }

  /**
   * ノートを削除
   */
  removeNote(noteId: string): void {
    const sprite = this.noteSprites.get(noteId);
    if (sprite) {
      sprite.destroy();
      this.noteSprites.delete(noteId);
    }
    const noteIndex = this.activeNotes.findIndex((n) => n.id === noteId);
    if (noteIndex !== -1) {
      this.activeNotes.splice(noteIndex, 1);
    }
  }

  /**
   * アクティブなノートを取得
   */
  getActiveNotes(): ActiveNote[] {
    return this.activeNotes;
  }

  /**
   * ノートスプライトを取得
   */
  getNoteSprite(noteId: string): Phaser.GameObjects.Rectangle | undefined {
    return this.noteSprites.get(noteId);
  }

  /**
   * すべてのノートが判定済みか
   */
  areAllNotesJudged(): boolean {
    return this.noteIndex >= this.chartData.notes.length && this.activeNotes.length === 0;
  }

  /**
   * クリーンアップ（シーン終了時）
   */
  cleanup(): void {
    for (const [noteId] of this.noteSprites) {
      this.removeNote(noteId);
    }
    this.activeNotes = [];
    this.noteSprites.clear();
    this.noteIndex = 0;
  }
}
