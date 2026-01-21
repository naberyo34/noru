/**
 * GameScene
 * ゲームプレイ画面
 * Phaser 3 Scene
 */

import Phaser from 'phaser';
import {
  ANIMATION,
  EFFECTS,
  GAMEPLAY,
  JUDGMENT_COLORS,
  JUDGMENT_COLORS_CSS,
  LANE_NOTE_COLORS,
  UI,
} from '../config/GameConfig';
import { AudioSyncEngine } from '../core/AudioSyncEngine';
import {
  type ActiveNote,
  type ChartData,
  getLaneFromKey,
  JudgmentType,
  LANE_COUNT,
  LANE_KEYS,
} from '../core/ChartData';
import { type JudgmentResult, JudgmentSystem } from '../core/JudgmentSystem';
import { ScoreCalculator } from '../core/ScoreCalculator';

export class GameScene extends Phaser.Scene {
  private audioEngine: AudioSyncEngine | null = null;
  private judgmentSystem!: JudgmentSystem;
  private scoreCalculator!: ScoreCalculator;
  private chartData!: ChartData;
  private activeNotes: ActiveNote[] = [];
  private noteSprites: Map<string, Phaser.GameObjects.Rectangle> = new Map();

  // UI要素
  private scoreText!: Phaser.GameObjects.Text;
  private accuracyText!: Phaser.GameObjects.Text;
  private laneGraphics: Phaser.GameObjects.Rectangle[] = [];
  private laneHighlights: Phaser.GameObjects.Rectangle[] = [];

  // ゲーム状態
  private gameStarted: boolean = false;
  private gameEnded: boolean = false;
  private noteIndex: number = 0;

  // タッチ用のゾーン
  private touchZones: Phaser.GameObjects.Zone[] = [];

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data: { chartFile?: string }) {
    // SongSelectSceneから渡されたチャートファイルのパス
    this.chartFile = data.chartFile || 'assets/charts/test-song-hard.json';

    // ゲーム状態をリセット
    this.gameStarted = false;
    this.gameEnded = false;
    this.noteIndex = 0;
    this.activeNotes = [];
    this.noteSprites.clear();
    this.audioEngine = null;
  }

  private chartFile: string = 'assets/charts/test-song-hard.json';

  preload() {
    // チャートデータを読み込む
    this.load.json('chart', this.chartFile);
  }

  create() {
    // フェードイン
    this.cameras.main.fadeIn(500, 0, 0, 0);

    // チャートデータを取得
    this.chartData = this.cache.json.get('chart') as ChartData;

    if (!this.chartData) {
      console.error('Failed to load chart data');
      const { width, height } = this.cameras.main;
      this.add
        .text(width / 2, height / 2, 'Failed to load chart data', {
          fontSize: '12px',
          color: '#ff0000',
        })
        .setOrigin(0.5);
      return;
    }

    // コアシステムの初期化（AudioEngine以外）
    this.judgmentSystem = new JudgmentSystem();
    this.scoreCalculator = new ScoreCalculator(this.chartData.notes.length);

    // UIのセットアップ
    this.setupUI();
    this.setupLanes();

    // 自動的にゲームを初期化して開始
    this.initializeAndStart();
  }

  private setupUI() {
    const { width } = this.cameras.main;

    // タイトル表示
    this.add
      .text(width / 2, UI.TITLE_Y, this.chartData.metadata.title, {
        fontSize: UI.FONT_TITLE,
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, UI.ARTIST_Y, this.chartData.metadata.artist, {
        fontSize: UI.FONT_ARTIST,
        color: '#cccccc',
      })
      .setOrigin(0.5);

    // スコア表示
    this.scoreText = this.add.text(UI.SCORE_X, UI.SCORE_Y, 'Score: 0', {
      fontSize: UI.FONT_SCORE,
      color: '#ffffff',
    });

    // 正確度表示
    this.accuracyText = this.add
      .text(width - UI.ACCURACY_OFFSET, UI.SCORE_Y, 'Accuracy: 100.0%', {
        fontSize: UI.FONT_SCORE,
        color: '#ffffff',
      })
      .setOrigin(1, 0);
  }

  private setupLanes() {
    const { width, height } = this.cameras.main;
    const startX = width / 2 - (LANE_COUNT * GAMEPLAY.LANE_WIDTH) / 2;

    // レーン背景
    for (let i = 0; i < LANE_COUNT; i++) {
      const x = startX + i * GAMEPLAY.LANE_WIDTH + GAMEPLAY.LANE_WIDTH / 2;

      // レーン背景
      const lane = this.add.rectangle(
        x,
        GAMEPLAY.LANE_Y_CENTER,
        GAMEPLAY.LANE_WIDTH - 2,
        height,
        0x333333,
        0.5
      );
      this.laneGraphics.push(lane);

      // レーンキー表示
      this.add
        .text(x, height - UI.LANE_KEY_Y_OFFSET, LANE_KEYS[i].toUpperCase(), {
          fontSize: UI.FONT_LANE_KEY,
          color: '#ffffff',
          fontStyle: 'bold',
        })
        .setOrigin(0.5);

      // ハイライト（キー押下時用）
      const highlight = this.add.rectangle(
        x,
        GAMEPLAY.LANE_Y_CENTER,
        GAMEPLAY.LANE_WIDTH - 2,
        height,
        0xffffff,
        0
      );
      this.laneHighlights.push(highlight);

      // タッチ用ゾーン
      const touchZone = this.add
        .zone(x, GAMEPLAY.LANE_Y_CENTER, GAMEPLAY.LANE_WIDTH, height)
        .setInteractive();
      touchZone.on('pointerdown', () => this.handleLaneInput(i));
      this.touchZones.push(touchZone);
    }

    // 判定ライン（視覚的ガイド）
    this.add.rectangle(
      width / 2,
      GAMEPLAY.JUDGMENT_LINE_Y,
      LANE_COUNT * GAMEPLAY.LANE_WIDTH,
      2,
      0xff0000,
      0.8
    );
  }

  private async initializeAndStart() {
    const { width, height } = this.cameras.main;

    const loadingText = this.add
      .text(width / 2, height / 2, 'Loading...', {
        fontSize: UI.FONT_TITLE,
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    const statusText = this.add
      .text(width / 2, height / 2 + 20, 'Initializing audio...', {
        fontSize: UI.FONT_ARTIST,
        color: '#888888',
      })
      .setOrigin(0.5);

    try {
      // AudioEngineの初期化
      this.audioEngine = new AudioSyncEngine();
      await this.audioEngine.initialize();

      // オフセット設定
      this.audioEngine.setOffset(this.chartData.metadata.offset);

      statusText.setText('Loading audio file...');

      // 音楽ファイルを読み込む
      await this.audioEngine.loadAudio(this.chartData.metadata.audioFile);

      // ローディング表示を削除
      loadingText.destroy();
      statusText.destroy();

      // カウントダウン表示
      await this.showCountdown();

      // ゲーム開始
      this.startGame();
    } catch (error) {
      console.error('Failed to initialize game:', error);
      loadingText.setText('Failed to load game');
      loadingText.setColor('#ff0000');
      statusText.setText('Please check the console for details');
      statusText.setColor('#ff0000');
    }
  }

  private async showCountdown() {
    const { width, height } = this.cameras.main;

    const countdownNumbers = ['3', '2', '1', 'START!'];

    for (const num of countdownNumbers) {
      const text = this.add
        .text(width / 2, height / 2, num, {
          fontSize: num === 'START!' ? UI.FONT_COUNTDOWN_START : UI.FONT_COUNTDOWN,
          color: '#ffffff',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
        .setAlpha(0);

      // フェードイン・アウト
      this.tweens.add({
        targets: text,
        alpha: 1,
        scale: 1.2,
        duration: 200,
        ease: 'Power2',
      });

      await new Promise((resolve) =>
        setTimeout(
          resolve,
          num === 'START!' ? EFFECTS.COUNTDOWN_START_DURATION : EFFECTS.COUNTDOWN_DURATION
        )
      );

      this.tweens.add({
        targets: text,
        alpha: 0,
        duration: 200,
        ease: 'Power2',
        onComplete: () => text.destroy(),
      });

      if (num !== 'START!') {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }
  }

  private startGame() {
    if (!this.audioEngine) {
      console.error('AudioEngine not initialized');
      return;
    }

    this.gameStarted = true;
    this.audioEngine.play();

    // キーボード入力設定
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      // event.key と event.code の両方を試す
      let lane = getLaneFromKey(event.key);
      if (lane === null) {
        lane = getLaneFromKey(event.code);
      }
      if (lane !== null) {
        this.handleLaneInput(lane);
      }
    });
  }

  private handleLaneInput(lane: number) {
    if (!this.gameStarted || this.gameEnded) {
      return;
    }

    // レーンハイライト表示
    this.showLaneHighlight(lane);

    // 判定
    if (!this.audioEngine) return;
    const currentTime = this.audioEngine.getCurrentTime();
    const result = this.judgmentSystem.judge(currentTime, lane, this.activeNotes);

    if (result) {
      this.handleJudgment(result);
    }
  }

  private showLaneHighlight(lane: number) {
    const highlight = this.laneHighlights[lane];
    highlight.setAlpha(0.3);

    // フェードアウト
    this.tweens.add({
      targets: highlight,
      alpha: 0,
      duration: ANIMATION.LANE_HIGHLIGHT_DURATION,
      ease: 'Power2',
    });
  }

  private handleJudgment(result: JudgmentResult) {
    // スコアカリキュレーターに判定を追加
    this.scoreCalculator.addJudgment(result.judgment);

    // ノートスプライトの位置を取得（エフェクト用）
    const sprite = this.noteSprites.get(result.note.id);
    let noteX = 0;
    let noteY = 0;
    if (sprite) {
      noteX = sprite.x;
      noteY = sprite.y;
      sprite.destroy();
      this.noteSprites.delete(result.note.id);
    }

    // activeNotesから削除
    const noteIndex = this.activeNotes.findIndex((n) => n.id === result.note.id);
    if (noteIndex !== -1) {
      this.activeNotes.splice(noteIndex, 1);
    }

    // ヒットエフェクト表示
    if (result.judgment !== JudgmentType.MISS) {
      this.showHitEffect(noteX, noteY, result.judgment);
    }

    // 判定テキスト表示（コンボ数込み）
    this.showJudgmentText(result.judgment);

    // UI更新
    this.updateUI();
  }

  private showJudgmentText(judgment: JudgmentType) {
    const { width } = this.cameras.main;

    // 現在のコンボ数を取得
    const combo = this.scoreCalculator.getCurrentCombo();

    // 判定とコンボ数を一緒に表示（ビートマニア風）
    let displayText: string = judgment;
    if (combo > 0 && judgment !== JudgmentType.MISS && judgment !== JudgmentType.BAD) {
      displayText = `${judgment} ${combo}`;
    }

    // 判定ごとに新しいテキストオブジェクトを生成（同時表示対応）
    const judgmentText = this.add
      .text(width / 2, EFFECTS.JUDGMENT_TEXT_Y, displayText, {
        fontSize: UI.FONT_JUDGMENT,
        color: JUDGMENT_COLORS_CSS[judgment],
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    // フェードアウト後に削除
    this.tweens.add({
      targets: judgmentText,
      alpha: 0,
      duration: EFFECTS.JUDGMENT_TEXT_DURATION,
      ease: 'Power2',
      onComplete: () => judgmentText.destroy(),
    });
  }

  private showHitEffect(x: number, y: number, judgment: JudgmentType) {
    const color = JUDGMENT_COLORS[judgment];

    // 中心の光
    const centerGlow = this.add.circle(x, y, EFFECTS.HIT_GLOW_RADIUS, color, 0.8);
    this.tweens.add({
      targets: centerGlow,
      scale: 1.5,
      alpha: 0,
      duration: EFFECTS.HIT_GLOW_DURATION,
      ease: 'Power2',
      onComplete: () => centerGlow.destroy(),
    });

    // 放射状のパーティクル
    for (let i = 0; i < EFFECTS.HIT_PARTICLE_COUNT; i++) {
      const angle = ((Math.PI * 2) / EFFECTS.HIT_PARTICLE_COUNT) * i + Math.PI / 4;
      const particle = this.add.rectangle(x, y, 4, 4, color, 1);

      const targetX = x + Math.cos(angle) * EFFECTS.HIT_PARTICLE_DISTANCE;
      const targetY = y + Math.sin(angle) * EFFECTS.HIT_PARTICLE_DISTANCE;

      this.tweens.add({
        targets: particle,
        x: targetX,
        y: targetY,
        alpha: 0,
        duration: EFFECTS.HIT_PARTICLE_DURATION,
        ease: 'Power2',
        onComplete: () => particle.destroy(),
      });
    }
  }

  private updateUI() {
    this.scoreText.setText(`Score: ${this.scoreCalculator.getScore()}`);

    const accuracy = this.scoreCalculator.getAccuracy();
    this.accuracyText.setText(`Accuracy: ${accuracy.toFixed(1)}%`);
  }

  update() {
    if (!this.gameStarted || this.gameEnded || !this.audioEngine) {
      return;
    }

    const currentTime = this.audioEngine.getCurrentTime();

    // 新しいノートを生成
    this.spawnNotes(currentTime);

    // ノートを更新
    this.updateNotes(currentTime);

    // Miss判定チェック
    this.checkMissedNotes(currentTime);

    // 楽曲終了チェック
    const duration = this.audioEngine.getDuration();
    const isAudioEnded = !this.audioEngine.getIsPlaying() || currentTime >= duration;
    const allNotesJudged =
      this.noteIndex >= this.chartData.notes.length && this.activeNotes.length === 0;

    if (isAudioEnded && allNotesJudged) {
      this.endGame();
    }
  }

  private spawnNotes(currentTime: number) {
    // ノートが判定ラインに到達する時間分だけ前に生成する
    while (this.noteIndex < this.chartData.notes.length) {
      const note = this.chartData.notes[this.noteIndex];
      const timeUntilNote = note.timing - currentTime;

      // ノートの落下時間より前になったら生成
      if (timeUntilNote <= GAMEPLAY.NOTE_TRAVEL_TIME) {
        // ノートを生成
        const activeNote: ActiveNote = {
          ...note,
          id: `note_${this.noteIndex}`,
          judged: false,
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

  private createNoteSprite(note: ActiveNote) {
    const { width } = this.cameras.main;
    const startX = width / 2 - (LANE_COUNT * GAMEPLAY.LANE_WIDTH) / 2;
    const x = startX + note.lane * GAMEPLAY.LANE_WIDTH + GAMEPLAY.LANE_WIDTH / 2;

    const color = LANE_NOTE_COLORS[note.lane];

    const sprite = this.add.rectangle(
      x,
      GAMEPLAY.NOTE_SPAWN_Y,
      GAMEPLAY.NOTE_SIZE,
      GAMEPLAY.NOTE_SIZE,
      color,
      1
    );
    sprite.setStrokeStyle(1, 0xffffff);

    this.noteSprites.set(note.id, sprite);
  }

  private updateNotes(currentTime: number) {
    for (const note of this.activeNotes) {
      if (note.judged) {
        continue;
      }

      const sprite = this.noteSprites.get(note.id);
      if (!sprite) {
        continue;
      }

      // ノートの位置を計算（音楽時刻に基づく）
      const timeUntilHit = note.timing - currentTime;
      const y = GAMEPLAY.JUDGMENT_LINE_Y - (timeUntilHit / 1000) * GAMEPLAY.NOTE_SPEED;

      sprite.setY(y);
    }
  }

  private checkMissedNotes(currentTime: number) {
    const missedNotes: ActiveNote[] = [];

    for (const note of this.activeNotes) {
      if (this.judgmentSystem.shouldMiss(currentTime, note)) {
        missedNotes.push(note);
      }
    }

    for (const note of missedNotes) {
      const result = this.judgmentSystem.miss(note);
      this.handleJudgment(result);
    }
  }

  private endGame() {
    this.gameEnded = true;

    // 結果を取得
    const result = this.scoreCalculator.getResult();

    // ResultSceneに遷移
    this.cameras.main.fadeOut(ANIMATION.FADE_OUT_DURATION, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('ResultScene', {
        result: result,
        chartTitle: this.chartData.metadata.title,
        chartArtist: this.chartData.metadata.artist,
      });
    });
  }

  shutdown() {
    // クリーンアップ
    if (this.audioEngine) {
      this.audioEngine.dispose();
      this.audioEngine = null;
    }
    this.input.keyboard?.removeAllListeners();

    // 配列をクリア
    this.activeNotes = [];
    this.noteSprites.clear();
    this.laneGraphics = [];
    this.laneHighlights = [];
    this.touchZones = [];
  }
}
