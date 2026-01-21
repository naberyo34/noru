/**
 * SongSelectScene
 * 楽曲選択画面
 */

import Phaser from 'phaser';
import type { Song } from '../types/Song';

export class SongSelectScene extends Phaser.Scene {
  private songs: Song[] = [];
  private selectedSongIndex: number = 0;
  private selectedDifficultyIndex: number = 0;

  constructor() {
    super({ key: 'SongSelectScene' });
  }

  preload() {
    // 楽曲リストを読み込む
    this.load.json('songs', 'assets/songs.json');
  }

  create() {
    const { width, height } = this.cameras.main;

    // フェードイン
    this.cameras.main.fadeIn(500, 0, 0, 0);

    // 楽曲リストを取得
    this.songs = this.cache.json.get('songs') as Song[];

    if (!this.songs || this.songs.length === 0) {
      this.add
        .text(width / 2, height / 2, 'No songs available', {
          fontSize: '24px',
          color: '#ff0000',
        })
        .setOrigin(0.5);
      return;
    }

    // 背景
    this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a2e);

    // タイトル
    this.add
      .text(width / 2, 16, 'SONG SELECT', {
        fontSize: '14px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    // 楽曲情報表示
    this.displaySongInfo();

    // 操作説明
    this.add
      .text(width / 2, height - 40, '← → : Change Song  |  ↑ ↓ : Change Difficulty', {
        fontSize: '6px',
        color: '#888888',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height - 28, 'ENTER / SPACE / Click : Start Game', {
        fontSize: '7px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height - 16, 'ESC : Back to Title', {
        fontSize: '6px',
        color: '#888888',
      })
      .setOrigin(0.5);

    // キーボード入力
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      this.handleKeyInput(event.key);
    });

    // クリック/タップで開始
    this.input.on('pointerdown', () => {
      this.startGame();
    });
  }

  private displaySongInfo() {
    const { width, height } = this.cameras.main;
    const song = this.songs[this.selectedSongIndex];
    const difficulty = song.difficulties[this.selectedDifficultyIndex];

    // 楽曲情報エリア
    const infoY = height / 2 - 24;

    // 楽曲タイトル
    this.add
      .text(width / 2, infoY, song.title, {
        fontSize: '19px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    // アーティスト
    this.add
      .text(width / 2, infoY + 24, song.artist, {
        fontSize: '10px',
        color: '#cccccc',
      })
      .setOrigin(0.5);

    // BPM
    this.add
      .text(width / 2, infoY + 40, `BPM: ${song.bpm}`, {
        fontSize: '8px',
        color: '#888888',
      })
      .setOrigin(0.5);

    // 難易度
    const difficultyColors: { [key: string]: string } = {
      EASY: '#00ff00',
      NORMAL: '#00ffff',
      HARD: '#ffff00',
      EXPERT: '#ff8800',
      MASTER: '#ff0000',
    };

    this.add
      .text(width / 2, infoY + 64, difficulty.level, {
        fontSize: '13px',
        color: difficultyColors[difficulty.level] || '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    // 難易度星
    const stars = '★'.repeat(difficulty.stars) + '☆'.repeat(10 - difficulty.stars);
    this.add
      .text(width / 2, infoY + 80, stars, {
        fontSize: '10px',
        color: '#ffff00',
      })
      .setOrigin(0.5);

    // 楽曲インデックス表示
    if (this.songs.length > 1) {
      this.add
        .text(width / 2, infoY + 100, `${this.selectedSongIndex + 1} / ${this.songs.length}`, {
          fontSize: '7px',
          color: '#666666',
        })
        .setOrigin(0.5);
    }
  }

  private handleKeyInput(key: string) {
    switch (key.toLowerCase()) {
      case 'arrowleft':
        this.changeSong(-1);
        break;
      case 'arrowright':
        this.changeSong(1);
        break;
      case 'arrowup':
        this.changeDifficulty(-1);
        break;
      case 'arrowdown':
        this.changeDifficulty(1);
        break;
      case 'enter':
      case ' ':
        this.startGame();
        break;
      case 'escape':
        this.backToTitle();
        break;
    }
  }

  private changeSong(direction: number) {
    this.selectedSongIndex += direction;
    if (this.selectedSongIndex < 0) {
      this.selectedSongIndex = this.songs.length - 1;
    } else if (this.selectedSongIndex >= this.songs.length) {
      this.selectedSongIndex = 0;
    }
    this.selectedDifficultyIndex = 0;
    this.scene.restart();
  }

  private changeDifficulty(direction: number) {
    const song = this.songs[this.selectedSongIndex];
    this.selectedDifficultyIndex += direction;
    if (this.selectedDifficultyIndex < 0) {
      this.selectedDifficultyIndex = song.difficulties.length - 1;
    } else if (this.selectedDifficultyIndex >= song.difficulties.length) {
      this.selectedDifficultyIndex = 0;
    }
    this.scene.restart();
  }

  private startGame() {
    const song = this.songs[this.selectedSongIndex];
    const difficulty = song.difficulties[this.selectedDifficultyIndex];

    // GameSceneにデータを渡す
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('GameScene', {
        chartFile: difficulty.chartFile,
      });
    });
  }

  private backToTitle() {
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('TitleScene');
    });
  }
}
