/**
 * TitleScene
 * タイトル画面
 */

import Phaser from 'phaser';

export class TitleScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TitleScene' });
  }

  create() {
    const { width, height } = this.cameras.main;

    // 背景
    this.add.rectangle(width / 2, height / 2, width, height, 0x0a0a1e);

    // タイトルロゴ
    this.add.text(width / 2, height / 2 - 32, 'NORU', {
      fontSize: '38px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // サブタイトル
    this.add.text(width / 2, height / 2 + 8, 'Rhythm Game', {
      fontSize: '13px',
      color: '#888888',
    }).setOrigin(0.5);

    // スタートプロンプト
    const startText = this.add.text(width / 2, height / 2 + 48, 'Press ENTER or Click to Start', {
      fontSize: '10px',
      color: '#ffffff',
    }).setOrigin(0.5);

    // 点滅アニメーション
    this.tweens.add({
      targets: startText,
      alpha: 0.3,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // バージョン表示
    this.add.text(width - 8, height - 8, 'v0.1.0', {
      fontSize: '6px',
      color: '#444444',
    }).setOrigin(1, 1);

    // 開始フラグ（重複防止）
    let started = false;

    const startGame = () => {
      if (started) return;
      started = true;
      this.cameras.main.fadeOut(500, 0, 0, 0);
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
