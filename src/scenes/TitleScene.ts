/**
 * TitleScene
 * タイトル画面
 */

import Phaser from 'phaser';
import { ANIMATION, TITLE_SCREEN } from '../config/GameConfig';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TitleScene' });
  }

  create() {
    const { width, height } = this.cameras.main;

    // 背景
    this.add.rectangle(width / 2, height / 2, width, height, TITLE_SCREEN.BACKGROUND_COLOR);

    // タイトルロゴ
    this.add
      .text(width / 2, height / 2 + TITLE_SCREEN.TITLE_OFFSET_Y, 'NORU', {
        fontSize: TITLE_SCREEN.TITLE_FONT,
        color: TITLE_SCREEN.TITLE_COLOR,
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    // サブタイトル
    this.add
      .text(width / 2, height / 2 + TITLE_SCREEN.SUBTITLE_OFFSET_Y, 'Rhythm Game', {
        fontSize: TITLE_SCREEN.SUBTITLE_FONT,
        color: TITLE_SCREEN.SUBTITLE_COLOR,
      })
      .setOrigin(0.5);

    // スタートプロンプト
    const startText = this.add
      .text(
        width / 2,
        height / 2 + TITLE_SCREEN.START_PROMPT_OFFSET_Y,
        'Press ENTER or Click to Start',
        {
          fontSize: TITLE_SCREEN.START_PROMPT_FONT,
          color: TITLE_SCREEN.START_PROMPT_COLOR,
        }
      )
      .setOrigin(0.5);

    // 点滅アニメーション
    this.tweens.add({
      targets: startText,
      alpha: TITLE_SCREEN.START_PROMPT_MIN_ALPHA,
      duration: TITLE_SCREEN.START_PROMPT_BLINK_DURATION,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // バージョン表示
    this.add
      .text(width - TITLE_SCREEN.VERSION_OFFSET, height - TITLE_SCREEN.VERSION_OFFSET, 'v0.1.0', {
        fontSize: TITLE_SCREEN.VERSION_FONT,
        color: TITLE_SCREEN.VERSION_COLOR,
      })
      .setOrigin(1, 1);

    // 開始フラグ（重複防止）
    let started = false;

    const startGame = () => {
      if (started) return;
      started = true;
      this.cameras.main.fadeOut(ANIMATION.FADE_OUT_DURATION, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.start('SongSelectScene');
      });
    };

    // キーボード（Enter / Space）で開始
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') {
        startGame();
      }
    });

    // クリック/タップで楽曲選択画面へ
    this.input.once('pointerdown', startGame);
  }
}
