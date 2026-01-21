/**
 * AudioSyncEngine
 * Web Audio APIを使用した高精度音楽同期エンジン
 * View非依存のコアロジック
 */

export class AudioSyncEngine {
  private audioContext: AudioContext | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private startTime: number = 0;
  private pausedAt: number = 0;
  private isPlaying: boolean = false;
  private offset: number = 0; // オフセット調整（ミリ秒）

  /**
   * AudioContextを初期化
   * ユーザーの最初の操作（タップ、クリック）時に呼び出す
   */
  async initialize(): Promise<void> {
    if (this.audioContext) {
      return;
    }

    this.audioContext = new AudioContext();

    // iOS Safariなど、一部のブラウザではresumeが必要
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  /**
   * 音楽ファイルを読み込む
   * @param url .wavファイルのURL
   */
  async loadAudio(url: string): Promise<void> {
    if (!this.audioContext) {
      await this.initialize();
    }

    try {
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      this.audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer);
    } catch (error) {
      console.error('Failed to load audio:', error);
      throw error;
    }
  }

  /**
   * 音楽を再生開始
   * @param offset 再生開始位置（秒）
   */
  play(offset: number = 0): void {
    if (!this.audioContext || !this.audioBuffer) {
      console.error('AudioContext or AudioBuffer not initialized');
      return;
    }

    // 既に再生中の場合は停止
    if (this.sourceNode) {
      this.sourceNode.stop();
      this.sourceNode.disconnect();
    }

    // 新しいSourceNodeを作成（SourceNodeは使い捨て）
    this.sourceNode = this.audioContext.createBufferSource();
    this.sourceNode.buffer = this.audioBuffer;
    this.sourceNode.connect(this.audioContext.destination);

    // 再生開始
    const startOffset = this.pausedAt + offset;
    this.sourceNode.start(0, startOffset);
    this.startTime = this.audioContext.currentTime - startOffset;
    this.isPlaying = true;
    this.pausedAt = 0;

    // 楽曲終了時のハンドリング
    this.sourceNode.onended = () => {
      this.isPlaying = false;
    };
  }

  /**
   * 音楽を一時停止
   */
  pause(): void {
    if (!this.isPlaying || !this.sourceNode || !this.audioContext) {
      return;
    }

    this.pausedAt = this.audioContext.currentTime - this.startTime;
    this.sourceNode.stop();
    this.sourceNode.disconnect();
    this.sourceNode = null;
    this.isPlaying = false;
  }

  /**
   * 音楽を停止
   */
  stop(): void {
    if (this.sourceNode) {
      this.sourceNode.stop();
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }
    this.isPlaying = false;
    this.startTime = 0;
    this.pausedAt = 0;
  }

  /**
   * 現在の再生時刻を取得（ミリ秒）
   * オフセット調整を含む
   */
  getCurrentTime(): number {
    if (!this.audioContext) {
      return 0;
    }

    if (!this.isPlaying) {
      return this.pausedAt * 1000 + this.offset;
    }

    const currentTime = this.audioContext.currentTime - this.startTime;
    return currentTime * 1000 + this.offset;
  }

  /**
   * 音楽の長さを取得（ミリ秒）
   */
  getDuration(): number {
    if (!this.audioBuffer) {
      return 0;
    }
    return this.audioBuffer.duration * 1000;
  }

  /**
   * 再生中かどうか
   */
  getIsPlaying(): boolean {
    return this.isPlaying;
  }

  /**
   * オフセット調整値を設定（ミリ秒）
   * 音楽とノートの同期ズレを補正する
   */
  setOffset(offset: number): void {
    this.offset = offset;
  }

  /**
   * オフセット調整値を取得（ミリ秒）
   */
  getOffset(): number {
    return this.offset;
  }

  /**
   * AudioContextの状態を取得
   */
  getAudioContextState(): AudioContextState | null {
    return this.audioContext?.state ?? null;
  }

  /**
   * リソースを解放
   */
  dispose(): void {
    this.stop();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.audioBuffer = null;
  }
}
