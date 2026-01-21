/**
 * EffectManager
 * エフェクト表示を管理するマネージャー
 */

import Phaser from 'phaser';
import { EFFECTS, JUDGMENT_COLORS, JUDGMENT_COLORS_CSS, UI } from '../config/GameConfig';
import { type ActiveNote, JudgmentType, LongNoteState } from '../core/ChartData';

export class EffectManager {
  private scene: Phaser.Scene;
  private holdingEffects: Map<string, Phaser.GameObjects.Container> = new Map();

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * ヒットエフェクトを表示
   */
  showHitEffect(x: number, y: number, judgment: JudgmentType): void {
    const color = JUDGMENT_COLORS[judgment];

    // 中心の光るエフェクト
    const glow = this.scene.add.circle(x, y, EFFECTS.HIT_GLOW_RADIUS, color, 0.8);
    this.scene.tweens.add({
      targets: glow,
      alpha: 0,
      scale: 1.5,
      duration: EFFECTS.HIT_GLOW_DURATION,
      ease: 'Power2',
      onComplete: () => glow.destroy(),
    });

    // 四方に飛ぶパーティクル
    const angles = [0, 90, 180, 270];
    for (let i = 0; i < EFFECTS.HIT_PARTICLE_COUNT; i++) {
      const angle = Phaser.Math.DegToRad(angles[i]);
      const particle = this.scene.add.circle(x, y, 3, color, 1);

      this.scene.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * EFFECTS.HIT_PARTICLE_DISTANCE,
        y: y + Math.sin(angle) * EFFECTS.HIT_PARTICLE_DISTANCE,
        alpha: 0,
        duration: EFFECTS.HIT_PARTICLE_DURATION,
        ease: 'Power2',
        onComplete: () => particle.destroy(),
      });
    }
  }

  /**
   * 判定テキストを表示（コンボ数込み）
   */
  showJudgmentText(judgment: JudgmentType, combo: number): void {
    const { width } = this.scene.cameras.main;

    // コンボ数を含めたテキスト（MISS以外）
    let displayText: string = judgment;
    if (judgment !== JudgmentType.MISS && combo > 0) {
      displayText = `${judgment} ${combo}`;
    }

    const text = this.scene.add.text(width / 2, EFFECTS.JUDGMENT_TEXT_Y, displayText, {
      fontSize: UI.FONT_JUDGMENT,
      color: JUDGMENT_COLORS_CSS[judgment],
      fontStyle: 'bold',
    });
    text.setOrigin(0.5);

    // フェードアウト
    this.scene.tweens.add({
      targets: text,
      alpha: 0,
      y: text.y - 20,
      duration: EFFECTS.JUDGMENT_TEXT_DURATION,
      ease: 'Power2',
      onComplete: () => text.destroy(),
    });
  }

  /**
   * ロングノート長押しエフェクトを開始
   */
  startHoldingEffect(note: ActiveNote, x: number, y: number, judgment: JudgmentType): void {
    const color = JUDGMENT_COLORS[judgment];

    const container = this.scene.add.container(x, y);

    // グローエフェクト（連続）
    const glow = this.scene.add.circle(0, 0, EFFECTS.LONG_NOTE_HOLD_RADIUS, color, 0.6);
    container.add(glow);

    // パルスアニメーション
    this.scene.tweens.add({
      targets: glow,
      scale: 1.3,
      alpha: 0.3,
      duration: EFFECTS.LONG_NOTE_HOLD_PULSE_DURATION,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.holdingEffects.set(note.id, container);
  }

  /**
   * ロングノート長押しエフェクトを停止
   */
  stopHoldingEffect(noteId: string): void {
    const effect = this.holdingEffects.get(noteId);
    if (effect) {
      effect.destroy();
      this.holdingEffects.delete(noteId);
    }
  }

  /**
   * ロングノート長押しエフェクトの位置を更新
   */
  updateHoldingEffects(
    activeNotes: ActiveNote[],
    lanePositions: number[],
    judmentLineY: number
  ): void {
    for (const [noteId, effect] of this.holdingEffects) {
      const note = activeNotes.find((n) => n.id === noteId);
      if (note && note.longNoteState === LongNoteState.HOLDING) {
        const x = lanePositions[note.lane];
        effect.setPosition(x, judmentLineY);
      } else {
        // holding状態でなければエフェクト削除
        this.stopHoldingEffect(noteId);
      }
    }
  }

  /**
   * クリーンアップ（シーン終了時）
   */
  cleanup(): void {
    for (const [noteId] of this.holdingEffects) {
      this.stopHoldingEffect(noteId);
    }
    this.holdingEffects.clear();
  }
}
