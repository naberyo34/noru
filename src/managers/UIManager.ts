/**
 * UIManager
 * UI要素の管理を行うマネージャー
 */

import type Phaser from 'phaser';
import { ANIMATION, EFFECTS, GAMEPLAY, UI } from '../config/GameConfig';
import { LANE_COUNT, LANE_KEYS } from '../core/ChartData';

export class UIManager {
  private scene: Phaser.Scene;
  private scoreText!: Phaser.GameObjects.Text;
  private accuracyText!: Phaser.GameObjects.Text;
  private hiSpeedText!: Phaser.GameObjects.Text;
  private laneGraphics: Phaser.GameObjects.Rectangle[] = [];
  private laneHighlights: Phaser.GameObjects.Rectangle[] = [];
  private touchZones: Phaser.GameObjects.Zone[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /**
   * 基本UIをセットアップ
   */
  setupUI(): void {
    const { width } = this.scene.cameras.main;

    // スコア表示
    this.scoreText = this.scene.add.text(UI.SCORE_X, UI.SCORE_Y, 'Score: 0', {
      fontSize: UI.FONT_SCORE,
      color: UI.TEXT_PRIMARY,
    });

    // 正確度表示
    this.accuracyText = this.scene.add.text(
      UI.SCORE_X,
      UI.SCORE_Y + UI.ACCURACY_OFFSET,
      'Accuracy: 100.00%',
      {
        fontSize: UI.FONT_ACCURACY,
        color: UI.TEXT_PRIMARY,
      }
    );

    // 楽曲情報（上部中央）
    const chartMetadata = this.scene.data.get('chartMetadata');
    if (chartMetadata) {
      this.scene.add
        .text(width / 2, UI.SONG_INFO_Y, `${chartMetadata.title} - ${chartMetadata.artist}`, {
          fontSize: UI.FONT_SONG_INFO,
          color: UI.TEXT_PRIMARY,
        })
        .setOrigin(0.5, 0);
    }

    // ハイスピード表示（右上）
    this.hiSpeedText = this.scene.add.text(width - UI.HI_SPEED_X_OFFSET, UI.SCORE_Y, 'x1.0', {
      fontSize: UI.FONT_SCORE,
      color: UI.HI_SPEED_COLOR,
    });
    this.hiSpeedText.setOrigin(1, 0); // 右揃え
  }

  /**
   * レーンをセットアップ
   */
  setupLanes(onLanePress: (lane: number) => void, onLaneRelease: (lane: number) => void): void {
    const { width, height } = this.scene.cameras.main;
    const startX = width / 2 - (LANE_COUNT * GAMEPLAY.LANE_WIDTH) / 2;

    for (let i = 0; i < LANE_COUNT; i++) {
      const x = startX + i * GAMEPLAY.LANE_WIDTH + GAMEPLAY.LANE_WIDTH / 2;

      // レーン背景
      const lane = this.scene.add.rectangle(
        x,
        GAMEPLAY.LANE_Y_CENTER,
        GAMEPLAY.LANE_WIDTH - 2,
        height,
        0x333333,
        0.5
      );
      lane.setDepth(0); // 背景として最背面
      this.laneGraphics.push(lane);

      // レーンキー表示
      this.scene.add
        .text(x, height - UI.LANE_KEY_Y_OFFSET, LANE_KEYS[i].toUpperCase(), {
          fontSize: UI.FONT_LANE_KEY,
          color: '#ffffff',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);

      // ハイライト（キー押下時用）
      const highlight = this.scene.add.rectangle(
        x,
        GAMEPLAY.LANE_Y_CENTER,
        GAMEPLAY.LANE_WIDTH - 2,
        height,
        EFFECTS.LANE_HIGHLIGHT_COLOR,
        0
      );
      highlight.setDepth(5); // レーン背景の上、ノートの下
      this.laneHighlights.push(highlight);

      // タッチ用ゾーン
      const touchZone = this.scene.add
        .zone(x, GAMEPLAY.LANE_Y_CENTER, GAMEPLAY.LANE_WIDTH, height)
        .setInteractive();
      touchZone.on('pointerdown', () => onLanePress(i));
      touchZone.on('pointerup', () => onLaneRelease(i));
      this.touchZones.push(touchZone);
    }

    // 判定ライン（視覚的ガイド）
    this.scene.add.rectangle(
      width / 2,
      GAMEPLAY.JUDGMENT_LINE_Y,
      LANE_COUNT * GAMEPLAY.LANE_WIDTH,
      2,
      0xff0000,
      0.8
    );
  }

  /**
   * スコアを更新
   */
  updateScore(score: number): void {
    this.scoreText.setText(`Score: ${score}`);
  }

  /**
   * 正確度を更新
   */
  updateAccuracy(accuracy: number): void {
    this.accuracyText.setText(`Accuracy: ${accuracy.toFixed(2)}%`);
  }

  /**
   * ハイスピード表示を更新
   */
  updateHiSpeed(hiSpeed: number): void {
    this.hiSpeedText.setText(`x${hiSpeed.toFixed(1)}`);
  }

  /**
   * レーンをハイライト
   */
  highlightLane(lane: number): void {
    const highlight = this.laneHighlights[lane];
    if (highlight) {
      // 進行中のアニメーションをキャンセル
      this.scene.tweens.killTweensOf(highlight);

      // 状態を完全にリセット
      highlight.setScale(1, 1);
      highlight.setAlpha(1);
      highlight.setFillStyle(EFFECTS.LANE_HIGHLIGHT_COLOR, EFFECTS.LANE_HIGHLIGHT_ALPHA);
    }
  }

  /**
   * レーンハイライトを解除（横幅縮小＋フェードアウトアニメーション）
   */
  unhighlightLane(lane: number): void {
    const highlight = this.laneHighlights[lane];
    if (highlight) {
      // 進行中のアニメーションをキャンセル
      this.scene.tweens.killTweensOf(highlight);

      // 横幅縮小＋フェードアウトアニメーション
      this.scene.tweens.add({
        targets: highlight,
        scaleX: 0, // 横幅を0に
        alpha: 0, // フェードアウト
        duration: ANIMATION.LANE_HIGHLIGHT_FADE_OUT,
        ease: 'Power2',
        onComplete: () => {
          // アニメーション完了後、すべてのプロパティを完全にリセット
          highlight.setScale(1, 1);
          highlight.setAlpha(1);
          highlight.setFillStyle(EFFECTS.LANE_HIGHLIGHT_COLOR, 0);
        },
      });
    }
  }

  /**
   * レーンのX座標を取得
   */
  getLanePositions(): number[] {
    const { width } = this.scene.cameras.main;
    const startX = width / 2 - (LANE_COUNT * GAMEPLAY.LANE_WIDTH) / 2;
    const positions: number[] = [];

    for (let i = 0; i < LANE_COUNT; i++) {
      positions.push(startX + i * GAMEPLAY.LANE_WIDTH + GAMEPLAY.LANE_WIDTH / 2);
    }

    return positions;
  }

  /**
   * クリーンアップ（必要に応じて）
   */
  cleanup(): void {
    // 特に何もしない（Phaserが自動でクリーンアップ）
  }
}
