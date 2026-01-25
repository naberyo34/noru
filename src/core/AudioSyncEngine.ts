/**
 * AudioSyncEngine
 * Web Audio APIを使用した高精度音楽同期エンジン
 * View非依存のコアロジック
 */

type AudioContextFactory = () => AudioContext;
type FetchFunction = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export class AudioSyncEngine {
  private readonly audioContextFactory: AudioContextFactory;
  private readonly fetchFn: FetchFunction;
  private audioContext: AudioContext | null = null;
  private audioBuffer: AudioBuffer | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private isPlaying: boolean = false;
  private offset: number = 0; // オフセット調整（ミリ秒）

  // リードイン機能（曲開始前の準備時間）
  private leadInTime: number = 0; // リードイン時間（ミリ秒）
  private gameStartTime: number = 0; // ゲーム開始時のタイムスタンプ（リードイン開始時点）

  constructor(deps?: { audioContextFactory?: AudioContextFactory; fetchFn?: FetchFunction }) {
    this.audioContextFactory = deps?.audioContextFactory ?? (() => new AudioContext());
    this.fetchFn = deps?.fetchFn ?? fetch;
  }

  /**
   * AudioContextを初期化
   * ユーザーの最初の操作（タップ、クリック）時に呼び出す
   */
  async initialize(): Promise<void> {
    if (this.audioContext) {
      return;
    }

    this.audioContext = this.audioContextFactory();

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
      const response = await this.fetchFn(url);
      const arrayBuffer = await response.arrayBuffer();
      this.audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer);
    } catch (error) {
      console.error('Failed to load audio:', error);
      throw error;
    }
  }

  /**
   * リードイン時間を設定（ミリ秒）
   * 音楽再生前に準備時間を設ける（ノートが画面上部から落ちてくる時間を確保）
   */
  setLeadInTime(leadInMs: number): void {
    this.leadInTime = Math.max(0, leadInMs);
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

    // ゲーム開始時刻を記録（リードインがある場合はここから時間計測開始）
    this.gameStartTime = this.audioContext.currentTime;
    this.isPlaying = true;

    // 新しいSourceNodeを作成
    this.sourceNode = this.audioContext.createBufferSource();
    this.sourceNode.buffer = this.audioBuffer;
    this.sourceNode.connect(this.audioContext.destination);

    if (this.leadInTime > 0) {
      // リードインあり：指定時間後に音楽再生を開始
      const leadInSeconds = this.leadInTime / 1000;
      const audioStartAt = this.gameStartTime + leadInSeconds;
      this.sourceNode.start(audioStartAt, offset);
    } else {
      // リードインなし：即座に再生
      this.sourceNode.start(0, offset);
    }

    // 楽曲終了時のハンドリング
    this.sourceNode.onended = () => {
      this.isPlaying = false;
    };
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
    this.gameStartTime = 0;
  }

  /**
   * 現在の再生時刻を取得（ミリ秒）
   * オフセット調整を含む
   * リードイン中は負の値を返す（-leadInTime から 0 に向かって増加）
   */
  getCurrentTime(): number {
    if (!this.audioContext || !this.isPlaying) {
      return 0;
    }

    // 統一された時間計算：
    // ゲーム開始からの経過時間 - リードイン時間 = 音楽時刻
    // リードイン中は負の値、リードイン後は音楽の再生位置と一致
    const elapsedSinceGameStart = (this.audioContext.currentTime - this.gameStartTime) * 1000;
    return elapsedSinceGameStart - this.leadInTime + this.offset;
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
   * リソースを解放
   */
  dispose(): void {
    this.stop();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.audioBuffer = null;
    this.leadInTime = 0;
  }
}
