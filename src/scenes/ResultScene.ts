/**
 * ResultScene
 * リザルト画面
 */

import Phaser from 'phaser';
import { PlayResult, JudgmentType } from '../core/ChartData';

export class ResultScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ResultScene' });
  }

  create(data: { result: PlayResult; chartTitle: string; chartArtist: string }) {
    const { width, height } = this.cameras.main;
    const { result, chartTitle, chartArtist } = data;

    // フェードイン
    this.cameras.main.fadeIn(500, 0, 0, 0);

    // 背景
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.95);

    // タイトル
    this.add.text(width / 2, 32, 'RESULT', {
      fontSize: '19px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // 楽曲情報
    this.add.text(width / 2, 52, chartTitle, {
      fontSize: '10px',
      color: '#cccccc',
    }).setOrigin(0.5);

    this.add.text(width / 2, 64, chartArtist, {
      fontSize: '7px',
      color: '#888888',
    }).setOrigin(0.5);

    // スコア
    this.add.text(width / 2, 88, `Score: ${result.score}`, {
      fontSize: '14px',
      color: '#ffffff',
    }).setOrigin(0.5);

    // 正確度
    const accuracyColor = this.getAccuracyColor(result.accuracy);
    this.add.text(width / 2, 108, `Accuracy: ${result.accuracy.toFixed(2)}%`, {
      fontSize: '11px',
      color: accuracyColor,
    }).setOrigin(0.5);

    // 最大コンボ
    this.add.text(width / 2, 126, `Max Combo: ${result.maxCombo}`, {
      fontSize: '10px',
      color: '#ffff00',
    }).setOrigin(0.5);

    // 判定カウント
    const judgmentY = 152;
    const judgmentData = [
      { type: JudgmentType.PERFECT, color: '#ffff00', count: result.judgmentCounts[JudgmentType.PERFECT] },
      { type: JudgmentType.GREAT, color: '#00ff00', count: result.judgmentCounts[JudgmentType.GREAT] },
      { type: JudgmentType.GOOD, color: '#00ffff', count: result.judgmentCounts[JudgmentType.GOOD] },
      { type: JudgmentType.BAD, color: '#ff8800', count: result.judgmentCounts[JudgmentType.BAD] },
      { type: JudgmentType.MISS, color: '#ff0000', count: result.judgmentCounts[JudgmentType.MISS] },
    ];

    this.add.text(width / 2, judgmentY, 'Judgments', {
      fontSize: '8px',
      color: '#888888',
    }).setOrigin(0.5);

    let currentY = judgmentY + 16;
    judgmentData.forEach(({ type, color, count }) => {
      this.add.text(width / 2 - 40, currentY, `${type}:`, {
        fontSize: '7px',
        color: color,
      }).setOrigin(1, 0.5);

      this.add.text(width / 2 + 40, currentY, `${count}`, {
        fontSize: '7px',
        color: '#ffffff',
      }).setOrigin(1, 0.5);

      currentY += 12;
    });

    // 操作説明
    this.add.text(width / 2, height - 24, 'ENTER / SPACE / Click : Back to Song Select', {
      fontSize: '7px',
      color: '#ffffff',
    }).setOrigin(0.5);

    this.add.text(width / 2, height - 12, 'ESC : Back to Title', {
      fontSize: '6px',
      color: '#888888',
    }).setOrigin(0.5);

    // キーボード入力
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      this.handleKeyInput(event.key);
    });

    // クリック/タップで楽曲選択へ
    this.input.on('pointerdown', () => {
      this.backToSongSelect();
    });
  }

  private getAccuracyColor(accuracy: number): string {
    if (accuracy >= 95) return '#ffff00'; // Perfect
    if (accuracy >= 90) return '#00ff00'; // Great
    if (accuracy >= 80) return '#00ffff'; // Good
    if (accuracy >= 70) return '#ff8800'; // Bad
    return '#ff0000'; // Miss
  }

  private handleKeyInput(key: string) {
    switch (key.toLowerCase()) {
      case 'enter':
      case ' ':
        this.backToSongSelect();
        break;
      case 'escape':
        this.backToTitle();
        break;
    }
  }

  private backToSongSelect() {
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('SongSelectScene');
    });
  }

  private backToTitle() {
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('TitleScene');
    });
  }
}
