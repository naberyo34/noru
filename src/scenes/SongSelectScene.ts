/**
 * SongSelectScene
 * 楽曲選択画面
 */

import Phaser from 'phaser';
import { ANIMATION, SONG_SELECT_UI } from '../config/GameConfig';
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
    this.cameras.main.fadeIn(ANIMATION.FADE_IN_DURATION, 0, 0, 0);

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
    this.add.rectangle(width / 2, height / 2, width, height, SONG_SELECT_UI.BACKGROUND_COLOR);

    // タイトル
    this.add
      .text(width / 2, SONG_SELECT_UI.TITLE_Y, 'SONG SELECT', {
        fontSize: SONG_SELECT_UI.TITLE_FONT,
        color: SONG_SELECT_UI.TITLE_COLOR,
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    // 楽曲情報表示
    this.displaySongInfo();

    // 操作説明
    this.add
      .text(
        width / 2,
        height - SONG_SELECT_UI.HINT1_OFFSET_Y,
        '← → : Change Song  |  ↑ ↓ : Change Difficulty',
        {
          fontSize: SONG_SELECT_UI.HINT1_FONT,
          color: SONG_SELECT_UI.HINT1_COLOR,
        }
      )
      .setOrigin(0.5);

    this.add
      .text(
        width / 2,
        height - SONG_SELECT_UI.HINT2_OFFSET_Y,
        'ENTER / SPACE / Click : Start Game',
        {
          fontSize: SONG_SELECT_UI.HINT2_FONT,
          color: SONG_SELECT_UI.HINT2_COLOR,
        }
      )
      .setOrigin(0.5);

    this.add
      .text(width / 2, height - SONG_SELECT_UI.HINT3_OFFSET_Y, 'ESC : Back to Title', {
        fontSize: SONG_SELECT_UI.HINT3_FONT,
        color: SONG_SELECT_UI.HINT3_COLOR,
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
    const infoY = height / 2 + SONG_SELECT_UI.INFO_BASE_OFFSET_Y;

    // 楽曲タイトル
    this.add
      .text(width / 2, infoY, song.title, {
        fontSize: SONG_SELECT_UI.SONG_TITLE_FONT,
        color: SONG_SELECT_UI.SONG_TITLE_COLOR,
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    // アーティスト
    this.add
      .text(width / 2, infoY + SONG_SELECT_UI.ARTIST_OFFSET_Y, song.artist, {
        fontSize: SONG_SELECT_UI.ARTIST_FONT,
        color: SONG_SELECT_UI.ARTIST_COLOR,
      })
      .setOrigin(0.5);

    // BPM
    this.add
      .text(width / 2, infoY + SONG_SELECT_UI.BPM_OFFSET_Y, `BPM: ${song.bpm}`, {
        fontSize: SONG_SELECT_UI.BPM_FONT,
        color: SONG_SELECT_UI.BPM_COLOR,
      })
      .setOrigin(0.5);

    // 難易度
    this.add
      .text(width / 2, infoY + SONG_SELECT_UI.DIFFICULTY_OFFSET_Y, difficulty.level, {
        fontSize: SONG_SELECT_UI.DIFFICULTY_FONT,
        color:
          SONG_SELECT_UI.DIFFICULTY_COLORS[
            difficulty.level as keyof typeof SONG_SELECT_UI.DIFFICULTY_COLORS
          ] || SONG_SELECT_UI.TITLE_COLOR,
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    // 難易度星
    const stars = '★'.repeat(difficulty.stars) + '☆'.repeat(10 - difficulty.stars);
    this.add
      .text(width / 2, infoY + SONG_SELECT_UI.STAR_OFFSET_Y, stars, {
        fontSize: SONG_SELECT_UI.STAR_FONT,
        color: SONG_SELECT_UI.STAR_COLOR,
      })
      .setOrigin(0.5);

    // 楽曲インデックス表示
    if (this.songs.length > 1) {
      this.add
        .text(
          width / 2,
          infoY + SONG_SELECT_UI.INDEX_OFFSET_Y,
          `${this.selectedSongIndex + 1} / ${this.songs.length}`,
          {
            fontSize: SONG_SELECT_UI.INDEX_FONT,
            color: SONG_SELECT_UI.INDEX_COLOR,
          }
        )
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
    this.cameras.main.fadeOut(ANIMATION.FADE_OUT_TO_GAME, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('GameScene', {
        chartFile: difficulty.chartFile,
      });
    });
  }

  private backToTitle() {
    this.cameras.main.fadeOut(ANIMATION.FADE_OUT_DURATION, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('TitleScene');
    });
  }
}
