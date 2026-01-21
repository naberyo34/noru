/**
 * GameScene
 * ゲームプレイ画面
 * Phaser 3 Scene
 */

import Phaser from 'phaser';
import { ANIMATION, EFFECTS, GAMEPLAY, UI } from '../config/GameConfig';
import { AudioSyncEngine } from '../core/AudioSyncEngine';
import {
  type ActiveNote,
  type ChartData,
  isLongNote,
  isLongNoteEndJudged,
  isLongNoteHolding,
  isLongNoteStartJudged,
  JudgmentType,
} from '../core/ChartData';
import { type JudgmentResult, JudgmentSystem } from '../core/JudgmentSystem';
import { ScoreCalculator } from '../core/ScoreCalculator';
import { EffectManager } from '../managers/EffectManager';
import { InputManager } from '../managers/InputManager';
import { NoteManager } from '../managers/NoteManager';
import { UIManager } from '../managers/UIManager';

export class GameScene extends Phaser.Scene {
  // Core
  private audioEngine: AudioSyncEngine | null = null;
  private judgmentSystem!: JudgmentSystem;
  private scoreCalculator!: ScoreCalculator;
  private chartData!: ChartData;
  private chartFile: string = 'assets/charts/test-song-hard.json';

  // Managers
  private noteManager!: NoteManager;
  private uiManager!: UIManager;
  private effectManager!: EffectManager;
  private inputManager!: InputManager;

  // ゲーム状態
  private gameStarted: boolean = false;
  private gameEnded: boolean = false;

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data: { chartFile?: string }) {
    // SongSelectSceneから渡されたチャートファイルのパス
    this.chartFile = data.chartFile || 'assets/charts/test-song-hard.json';

    // ゲーム状態をリセット
    this.gameStarted = false;
    this.gameEnded = false;
    this.audioEngine = null;
  }

  preload() {
    // チャートデータを読み込む
    this.load.json('chart', this.chartFile);
  }

  create() {
    // フェードイン
    this.cameras.main.fadeIn(ANIMATION.FADE_IN_DURATION, 0, 0, 0);

    // チャートデータを取得
    this.chartData = this.cache.json.get('chart') as ChartData;

    if (!this.chartData) {
      console.error('Failed to load chart data');
      const { width, height } = this.cameras.main;
      this.add
        .text(width / 2, height / 2, 'Failed to load chart data', {
          fontSize: UI.FONT_ERROR,
          color: UI.TEXT_PRIMARY,
        })
        .setOrigin(0.5);
      return;
    }

    // コアシステムを初期化
    this.judgmentSystem = new JudgmentSystem();
    this.scoreCalculator = new ScoreCalculator(this.chartData.notes);

    // マネージャーを初期化
    this.effectManager = new EffectManager(this);
    this.uiManager = new UIManager(this);
    this.inputManager = new InputManager(
      this,
      (lane) => this.handleLaneInput(lane),
      (lane) => this.handleLaneRelease(lane)
    );

    // UIをセットアップ
    this.data.set('chartMetadata', this.chartData.metadata);
    this.uiManager.setupUI();
    this.uiManager.setupLanes(
      (lane) => this.handleLaneInput(lane),
      (lane) => this.handleLaneRelease(lane)
    );

    // NoteManagerを初期化（レーン位置が必要）
    const lanePositions = this.uiManager.getLanePositions();
    this.noteManager = new NoteManager(this, this.chartData, lanePositions);

    // 入力をセットアップ
    this.inputManager.setupKeyboard();

    // 自動的にゲーム開始
    this.initializeAndStart();
  }

  private async initializeAndStart() {
    const { width, height } = this.cameras.main;

    // Loading表示
    const loadingText = this.add
      .text(width / 2, height / 2, 'Loading...', {
        fontSize: UI.FONT_LOADING,
        color: UI.TEXT_PRIMARY,
      })
      .setOrigin(0.5);

    try {
      // AudioContextを初期化して音楽を読み込む
      this.audioEngine = new AudioSyncEngine();
      await this.audioEngine.loadAudio(this.chartData.metadata.audioFile);
      this.audioEngine.setOffset(this.chartData.metadata.offset || 0);

      loadingText.destroy();

      // カウントダウン
      await this.showCountdown();

      // ゲーム開始
      this.startGame();
    } catch (error) {
      console.error('Failed to initialize audio:', error);
      loadingText.setText('Failed to load audio. Click to retry.');
      loadingText.setInteractive();
      loadingText.once('pointerdown', () => {
        loadingText.destroy();
        this.initializeAndStart();
      });
    }
  }

  private async showCountdown() {
    const { width, height } = this.cameras.main;
    const countdownTexts = ['3', '2', '1', 'START!'];

    for (const text of countdownTexts) {
      const fontSize = text === 'START!' ? UI.FONT_COUNTDOWN_START : UI.FONT_COUNTDOWN;
      const duration =
        text === 'START!' ? EFFECTS.COUNTDOWN_START_DURATION : EFFECTS.COUNTDOWN_DURATION;
      const countdownText = this.add
        .text(width / 2, height / 2, text, {
          fontSize: fontSize,
          color: UI.TEXT_PRIMARY,
          fontStyle: 'bold',
        })
        .setOrigin(0.5);

      await new Promise((resolve) => {
        this.time.delayedCall(duration, () => {
          countdownText.destroy();
          resolve(null);
        });
      });
    }
  }

  private startGame() {
    if (!this.audioEngine) return;

    this.audioEngine.play();
    this.gameStarted = true;
  }

  update() {
    if (!this.gameStarted || this.gameEnded || !this.audioEngine) {
      return;
    }

    const currentTime = this.audioEngine.getCurrentTime();

    // 新しいノートを生成
    this.noteManager.spawnNotes(currentTime);

    // Miss判定チェック（ノート削除前に実行）
    this.checkMissedNotes(currentTime);

    // ロングノート：途中で離したかチェック
    this.checkLongNoteHolding();

    // 完了したノートを削除（判定処理後に実行）
    this.noteManager.removeFinishedNotes(currentTime);

    // ロングノート：長押しエフェクトの位置を更新
    this.effectManager.updateHoldingEffects(
      this.noteManager.getActiveNotes(),
      this.uiManager.getLanePositions(),
      GAMEPLAY.JUDGMENT_LINE_Y
    );

    // ノートの描画を更新
    this.noteManager.updateNotes(currentTime);

    // 楽曲終了チェック
    const duration = this.audioEngine.getDuration();
    const isAudioEnded = !this.audioEngine.getIsPlaying() || currentTime >= duration;
    const allNotesJudged = this.noteManager.areAllNotesJudged();

    if (isAudioEnded && allNotesJudged) {
      this.endGame();
    }
  }

  private handleLaneInput(lane: number) {
    // レーンハイライト表示（キー押下のフィードバック）
    // ゲーム状態に関わらず常に表示
    this.uiManager.highlightLane(lane);

    if (!this.gameStarted || this.gameEnded) {
      return;
    }

    if (!this.audioEngine) return;
    const currentTime = this.audioEngine.getCurrentTime();

    // まずロングノートの開始判定を試す
    const longNoteResult = this.judgmentSystem.judgeStart(
      currentTime,
      lane,
      this.noteManager.getActiveNotes()
    );
    if (longNoteResult) {
      this.handleJudgment(longNoteResult);
      return;
    }

    // 通常ノートの判定
    const result = this.judgmentSystem.judge(currentTime, lane, this.noteManager.getActiveNotes());
    if (result) {
      this.handleJudgment(result);
    }
  }

  private handleLaneRelease(lane: number) {
    // レーンハイライトを解除（キーリリースのフィードバック）
    // ゲーム状態に関わらず常に解除
    this.uiManager.unhighlightLane(lane);

    if (!this.gameStarted || this.gameEnded) {
      return;
    }

    if (!this.audioEngine) return;
    const currentTime = this.audioEngine.getCurrentTime();

    // ロングノートの終了判定
    const result = this.judgmentSystem.judgeEnd(
      currentTime,
      lane,
      this.noteManager.getActiveNotes()
    );
    if (result) {
      this.handleJudgment(result);
    }
  }

  private handleJudgment(result: JudgmentResult) {
    // 判定結果をスコアに反映
    this.scoreCalculator.addJudgment(result.judgment);

    // ノートスプライトの位置を取得（エフェクト用）
    const sprite = this.noteManager.getNoteSprite(result.note.id);
    let noteX = 0;
    let noteY = 0;
    if (sprite) {
      noteX = sprite.x;
      noteY = sprite.y;

      // ロングノートの開始判定の場合
      const isStartJudgment =
        isLongNote(result.note) &&
        isLongNoteStartJudged(result.note) &&
        !isLongNoteEndJudged(result.note);

      // ロングノート開始判定成功時：長押しエフェクトを開始
      if (
        isStartJudgment &&
        result.judgment !== JudgmentType.MISS &&
        result.judgment !== JudgmentType.BAD
      ) {
        this.effectManager.startHoldingEffect(result.note, noteX, noteY, result.judgment);
      }

      // ロングノート終了時：長押しエフェクトを停止
      if (isLongNote(result.note) && result.note.judged) {
        this.effectManager.stopHoldingEffect(result.note.id);
      }

      // スプライトとactiveNotesからの削除
      // 通常ノート：常に即座に削除
      // ロングノート：終了判定が完了した場合（成功/失敗問わず）に即座に削除
      const shouldRemove = !isLongNote(result.note) || isLongNoteEndJudged(result.note);

      if (shouldRemove) {
        this.noteManager.removeNote(result.note.id);
      }
    }

    // ヒットエフェクト表示
    if (result.judgment !== JudgmentType.MISS) {
      this.effectManager.showHitEffect(noteX, noteY, result.judgment);
    }

    // 判定テキスト表示（コンボ数込み）
    const combo = this.scoreCalculator.getCurrentCombo();
    this.effectManager.showJudgmentText(result.judgment, combo);

    // UI更新
    this.updateUI();
  }

  private checkLongNoteHolding() {
    const releasedNotes: ActiveNote[] = [];

    for (const note of this.noteManager.getActiveNotes()) {
      // holding状態なのにキーが押されていないノートを検出
      if (isLongNoteHolding(note) && !this.inputManager.isKeyPressed(note.lane)) {
        releasedNotes.push(note);
      }
    }

    for (const note of releasedNotes) {
      // 途中で離した場合はミス扱い
      const result = this.judgmentSystem.releaseEarly(note);

      // 長押しエフェクトを停止
      this.effectManager.stopHoldingEffect(note.id);

      // スコア計算のみ実行（スプライトは残す）
      this.scoreCalculator.addJudgment(result.judgment);

      // 判定テキスト表示
      const combo = this.scoreCalculator.getCurrentCombo();
      this.effectManager.showJudgmentText(result.judgment, combo);

      // UI更新
      this.updateUI();
    }
  }

  private checkMissedNotes(currentTime: number) {
    const missedNotes: ActiveNote[] = [];

    for (const note of this.noteManager.getActiveNotes()) {
      // 通常ノートまたはロングノートの開始判定のMissチェック
      if (this.judgmentSystem.shouldMiss(currentTime, note)) {
        missedNotes.push(note);
      }
      // ロングノートの終了判定のMissチェック
      else if (this.judgmentSystem.shouldMissEnd(currentTime, note)) {
        missedNotes.push(note);
      }
    }

    for (const note of missedNotes) {
      // ロングノートの終了Miss
      if (isLongNote(note) && isLongNoteStartJudged(note) && !isLongNoteEndJudged(note)) {
        const result = this.judgmentSystem.missEnd(note);
        this.handleJudgment(result);
      }
      // 通常Missまたはロングノート開始Miss
      else {
        const result = this.judgmentSystem.miss(note);
        this.handleJudgment(result);
      }
    }
  }

  private updateUI() {
    const score = this.scoreCalculator.getScore();
    const accuracy = this.scoreCalculator.getAccuracy();

    this.uiManager.updateScore(score);
    this.uiManager.updateAccuracy(accuracy);
  }

  private endGame() {
    if (this.gameEnded) return;
    this.gameEnded = true;

    // 音楽停止
    if (this.audioEngine) {
      this.audioEngine.stop();
    }

    // フェードアウトしてリザルト画面へ
    this.cameras.main.fadeOut(ANIMATION.FADE_OUT_DURATION, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('ResultScene', {
        result: this.scoreCalculator.getResult(),
        chartMetadata: this.chartData.metadata,
      });
    });
  }

  shutdown() {
    // クリーンアップ
    if (this.audioEngine) {
      this.audioEngine.dispose();
      this.audioEngine = null;
    }

    if (this.noteManager) {
      this.noteManager.cleanup();
    }

    if (this.effectManager) {
      this.effectManager.cleanup();
    }

    if (this.inputManager) {
      this.inputManager.cleanup();
    }

    if (this.uiManager) {
      this.uiManager.cleanup();
    }
  }
}
