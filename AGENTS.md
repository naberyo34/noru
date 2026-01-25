# AGENTS.md - 開発者・AIエージェント向けガイド

**このファイルを読む前に、必ず [README.md](README.md) を先に読んでください。**

このドキュメントは、コードベースを理解し、開発を継続するための技術的な情報をまとめたものです。

---

## 🏗️ アーキテクチャ設計

### 基本方針：コアロジックとViewの完全分離

```
┌─────────────────────────────────────────────────────────┐
│  View Layer (Phaser 3 依存)                             │
│  src/scenes/*                                           │
│  - TitleScene                                           │
│  - SongSelectScene                                      │
│  - GameScene                                            │
│  - ResultScene                                          │
└───────────────────┬─────────────────────────────────────┘
                    │ uses
                    ↓
┌─────────────────────────────────────────────────────────┐
│  Manager Layer (Scene 責務分離)                         │
│  src/managers/*                                         │
│  - NoteManager (ノート生成・更新・削除)                  │
│  - UIManager (UI要素管理)                               │
│  - EffectManager (エフェクト表示)                       │
│  - InputManager (入力処理)                              │
└───────────────────┬─────────────────────────────────────┘
                    │ uses
                    ↓
┌─────────────────────────────────────────────────────────┐
│  Core Layer (View 非依存)                               │
│  src/core/*                                             │
│  - ChartData (型定義)                                   │
│  - AudioSyncEngine (音楽同期)                           │
│  - JudgmentSystem (判定ロジック)                        │
│  - ScoreCalculator (スコア計算)                         │
└─────────────────────────────────────────────────────────┘
```

**重要な設計思想：**
- **Core Layerは Phaser に依存しない**
  - 将来、譜面エディタを別UIフレームワーク（React等）で実装可能
  - Core Layerのテストが容易
- **Manager Layerで Scene の責務を分離**
  - GameScene が肥大化するのを防ぐ
  - 機能単位でコードを分割し、保守性を向上
  - 各マネージャーは単一責任を持つ

---

## 📁 ディレクトリ構造

```
src/
├── config/              # 設定ファイル（★重要）
│   └── GameConfig.ts    # 全ての設定値を集約
├── core/                # View非依存のコアロジック
│   ├── __tests__/       # Core Layer のユニットテスト
│   ├── ChartData.ts     # 型定義とヘルパー関数
│   ├── AudioSyncEngine.ts
│   ├── JudgmentSystem.ts
│   └── ScoreCalculator.ts
├── managers/            # Scene責務分離（★重要）
│   ├── NoteManager.ts       # ノート生成・更新・削除
│   ├── UIManager.ts         # UI要素管理
│   ├── EffectManager.ts     # エフェクト表示
│   └── InputManager.ts      # 入力処理
├── scenes/              # Phaserシーン（View層）
│   ├── TitleScene.ts
│   ├── SongSelectScene.ts
│   ├── GameScene.ts     # マネージャーを統括
│   └── ResultScene.ts
├── types/               # 共通型定義
│   └── Song.ts
└── main.ts              # エントリーポイント
```

---

## ⚙️ 設定値の管理

### 絶対に守るべきルール

**❌ マジックナンバーを直書きしない**
```typescript
// NG
this.add.text(160, 120, 'Hello', { fontSize: '14px' })
const circle = this.add.circle(x, y, 12, 0xffff00)
```

**✅ GameConfig から参照する**
```typescript
// OK
this.add.text(width / 2, height / 2, 'Hello', { fontSize: UI.FONT_JUDGMENT })
const circle = this.add.circle(x, y, EFFECTS.HIT_GLOW_RADIUS, JUDGMENT_COLORS[judgment])
```

### GameConfig.ts の構成
- `SCREEN` - 画面解像度
- `GAMEPLAY` - ゲームプレイ設定（レーン幅、ノート速度など）
- `JUDGMENT_COLORS` / `JUDGMENT_COLORS_CSS` - 判定色（16進数/CSS）
- `LANE_NOTE_COLORS` - レーンノート色
- `EFFECTS` - エフェクト設定（パーティクル数、持続時間など）
- `UI` - フォントサイズ、配置
- `ANIMATION` - アニメーション持続時間

**設定値を追加する際は必ず GameConfig.ts に追加すること**

---

## 🎮 音楽同期の実装

### 最重要：Web Audio API の使用

```typescript
// ✅ 正しい時刻取得
const currentTime = this.audioEngine.getCurrentTime(); // ミリ秒
const noteY = GAMEPLAY.JUDGMENT_LINE_Y - (timeUntilHit / 1000) * GAMEPLAY.NOTE_SPEED;

// ❌ 誤った実装（フレーム依存）
this.frameCount++;
const noteY = this.frameCount * someSpeed; // フレームレート依存でズレる
```

**AudioSyncEngine のポイント：**
- `audioContext.currentTime` で高精度タイミング取得
- オフセット調整機能あり（`setOffset()`）
- ノート位置は**音楽時刻から逆算**して計算

---

## 🎨 Phaser シーンのライフサイクル

### GameScene の重要なポイント

```typescript
init(data) {
  // シーン開始時に毎回呼ばれる
  // ★状態変数を必ずリセットすること
  this.gameStarted = false;
  this.noteIndex = 0;
  this.activeNotes = [];
}

preload() {
  // アセット読み込み
  // 音楽ファイルは init() 後に AudioEngine で読み込む
}

create() {
  // UIセットアップ
  // initializeAndStart() で自動的にゲーム開始
}

update() {
  // 毎フレーム実行
  // 音楽時刻ベースでノート位置を更新
}

shutdown() {
  // シーン終了時のクリーンアップ
  // AudioEngine を dispose() すること
}
```

**注意：Phaserのシーンは再利用されるため、init/shutdown で状態をリセット必須**

---

## 📝 譜面データ形式

### ChartData の構造

```typescript
{
  "metadata": {
    "title": "楽曲タイトル",
    "artist": "アーティスト",
    "audioFile": "assets/audio/song.wav",
    "bpm": 120,              // 現在は固定BPM
    "timeSignature": [4, 4], // 現在は4/4固定
    "offset": 0              // 音ズレ補正（ms）
  },
  "notes": [
    { "lane": 0, "timing": 2000 }  // lane: 0-7, timing: ミリ秒
  ],
  // 将来の拡張用（未実装）
  "bpmChanges": [],      // BPM変化
  "activeLanes": []      // 使用レーン指定（4〜8レーン可変）
}
```

**重要：**
- `timing` は**絶対時刻**（ミリ秒）
- `bpm` と `timeSignature` は**現在参照されていない**（将来の拡張用）
- 譜面エディタや自動生成機能実装時に、beat → timing 変換が必要

---

## 🎯 判定システム

### JudgmentSystem の仕組み

```typescript
// 判定ウィンドウ（ChartData.ts で定義）
DEFAULT_JUDGMENT_WINDOW = {
  perfect: 30,  // ±30ms
  great: 60,    // ±60ms
  good: 90,     // ±90ms
  bad: 120,     // ±120ms
};
```

**判定の流れ：**
1. キー入力時、現在時刻とノートタイミングの差を計算
2. 最も近いノートを探す
3. 判定ウィンドウ内なら判定、外ならnull
4. Miss判定はupdate()内で自動的に処理（Bad判定ウィンドウを超過）

---

## 🔧 よくある実装パターン

### 1. 新しいエフェクトを追加する

```typescript
// GameConfig.ts に設定を追加
export const EFFECTS = {
  MY_NEW_EFFECT_DURATION: 300,
  MY_NEW_EFFECT_COLOR: 0xff00ff,
} as const;

// GameScene.ts で使用
private showMyEffect() {
  const particle = this.add.circle(x, y, 10, EFFECTS.MY_NEW_EFFECT_COLOR);
  this.tweens.add({
    targets: particle,
    alpha: 0,
    duration: EFFECTS.MY_NEW_EFFECT_DURATION,
    onComplete: () => particle.destroy(),
  });
}
```

### 2. 新しいシーンを追加する

```typescript
// 1. src/scenes/NewScene.ts を作成
export class NewScene extends Phaser.Scene {
  constructor() {
    super({ key: 'NewScene' });
  }
  // ...
}

// 2. main.ts に登録
import { NewScene } from './scenes/NewScene';
scene: [TitleScene, SongSelectScene, GameScene, ResultScene, NewScene]

// 3. 遷移
this.scene.start('NewScene', { データ });
```

### 3. 色を統一的に扱う

```typescript
// 16進数カラー（Phaser用）
this.add.circle(x, y, 10, JUDGMENT_COLORS[JudgmentType.PERFECT])

// CSS文字列（Text用）
this.add.text(x, y, 'PERFECT', { color: JUDGMENT_COLORS_CSS[JudgmentType.PERFECT] })
```

---

## 🎨 マネージャーパターン

### Scene の肥大化を防ぐ設計

GameScene は以下のマネージャークラスを使用して責務を分離しています。

### 各マネージャーの責務

#### 1. **NoteManager** (`src/managers/NoteManager.ts`)
```typescript
// 責務：ノートの生成・更新・削除
class NoteManager {
  spawnNotes(currentTime: number): void          // ノート生成
  updateNotes(currentTime: number): void         // 位置更新
  removeFinishedNotes(currentTime: number): void // 削除
  getActiveNotes(): ActiveNote[]                 // 取得
}

// GameScene での使用例
create() {
  this.noteManager = new NoteManager(this, this.chartData, lanePositions);
}

update() {
  this.noteManager.spawnNotes(currentTime);
  this.noteManager.updateNotes(currentTime);
}
```

#### 2. **UIManager** (`src/managers/UIManager.ts`)
```typescript
// 責務：UI要素の管理
class UIManager {
  setupUI(): void                    // 基本UI作成
  setupLanes(onPress, onRelease): void // レーン作成
  updateScore(score: number): void   // スコア更新
  highlightLane(lane: number): void  // ハイライト
}

// GameScene での使用例
create() {
  this.uiManager = new UIManager(this);
  this.uiManager.setupUI();
  this.uiManager.setupLanes(...);
}
```

#### 3. **EffectManager** (`src/managers/EffectManager.ts`)
```typescript
// 責務：エフェクト表示
class EffectManager {
  showHitEffect(x, y, judgment): void         // ヒットエフェクト
  showJudgmentText(judgment, combo): void     // 判定テキスト
  startHoldingEffect(note, x, y, judgment): void  // 長押しエフェクト開始
  stopHoldingEffect(noteId): void             // 長押しエフェクト停止
}

// GameScene での使用例
handleJudgment(result) {
  this.effectManager.showHitEffect(x, y, result.judgment);
  this.effectManager.showJudgmentText(result.judgment, combo);
}
```

#### 4. **InputManager** (`src/managers/InputManager.ts`)
```typescript
// 責務：入力処理
class InputManager {
  setupKeyboard(): void                  // キーボード設定
  isKeyPressed(lane: number): boolean    // キー状態取得
}

// GameScene での使用例
create() {
  this.inputManager = new InputManager(
    this,
    (lane) => this.handleLaneInput(lane),
    (lane) => this.handleLaneRelease(lane)
  );
  this.inputManager.setupKeyboard();
}
```

### GameScene のシンプル化

**Before（888行）：**
- ノート生成、UI管理、エフェクト、入力処理がすべて GameScene に混在
- メソッドが多く、責務が不明確
- テストや保守が困難

**After（約400行）：**
```typescript
export class GameScene extends Phaser.Scene {
  // マネージャーを保持
  private noteManager!: NoteManager;
  private uiManager!: UIManager;
  private effectManager!: EffectManager;
  private inputManager!: InputManager;

  create() {
    // マネージャーを初期化
    this.uiManager = new UIManager(this);
    this.effectManager = new EffectManager(this);
    this.inputManager = new InputManager(this, ...);
    this.noteManager = new NoteManager(this, ...);
  }

  update() {
    // マネージャーに処理を委譲
    this.noteManager.spawnNotes(currentTime);
    this.noteManager.updateNotes(currentTime);
  }
}
```

### 新しい機能を追加する場合

**例：新しいエフェクトを追加**
1. `EffectManager.ts` に新メソッドを追加
2. `GameScene` から呼び出すだけ

**例：新しいUI要素を追加**
1. `UIManager.ts` に新メソッドを追加
2. 必要な設定を `GameConfig.ts` に追加

**マネージャーを追加する場合：**
1. `src/managers/NewManager.ts` を作成
2. `GameScene` の `create()` で初期化
3. 必要に応じて `update()` や他のメソッドから呼び出す

### 注意点

- **マネージャー間の依存は最小限に**
  - 基本的に GameScene 経由で連携する
  - 直接依存させない（循環参照を防ぐ）
  
- **Scene への参照は `private scene: Phaser.Scene` で保持**
  - マネージャーから Phaser の機能にアクセス可能
  - `this.scene.add.text(...)` など

- **cleanup() を忘れずに**
  - `shutdown()` でマネージャーの `cleanup()` を呼ぶ
  - メモリリーク防止

---

## 🚨 注意事項・既知の問題

### 1. **解像度は 320×240 固定**
- 座標計算は必ず `this.cameras.main` の width/height を使用
- ハードコードされた座標（400, 300など）は使わない

### 2. **AudioContext の初期化タイミング**
- ブラウザの自動再生ポリシーにより、ユーザー操作後に初期化必須
- GameScene では `initializeAndStart()` で自動処理済み

### 3. **判定テキストの同時表示**
- 毎回新しい Text オブジェクトを生成すること
- 使い回すと Tween が競合して表示されなくなる

### 4. **ノートの位置計算**
```typescript
// ✅ 正しい実装
const timeUntilHit = note.timing - currentTime;
const y = GAMEPLAY.JUDGMENT_LINE_Y - (timeUntilHit / 1000) * GAMEPLAY.NOTE_SPEED;

// ❌ 間違った実装
const y = note.startY + elapsedFrames * speed; // フレーム依存
```

### 5. **Phaser シーンの再利用**
- シーンは破棄されず再利用される
- `init()` で必ず状態変数をリセット
- `shutdown()` で必ずリソースを解放

---

## 🐍 Python スクリプトの実行

### venv の使用

`scripts/chart-generator/` には Python の仮想環境（`.venv`）が用意されています。
Python スクリプトを実行する際は、必ずこの venv を使用してください。

```bash
# 譜面生成スクリプトの実行例
cd scripts/chart-generator
.venv/bin/python main.py input.wav -o output.json

# または絶対パスで
scripts/chart-generator/.venv/bin/python scripts/chart-generator/main.py ...
```

**注意：**
- `python` や `python3` コマンドを直接使わない（システムの Python を使ってしまう）
- 必ず `.venv/bin/python` を使用すること

---

## 🔮 将来の拡張ポイント

### すでに設計済み（実装は未）

#### 1. BPM変化対応
```typescript
// ChartData に bpmChanges を追加
bpmChanges: [
  { timing: 0, bpm: 120 },
  { timing: 30000, bpm: 140 }
]

// AudioSyncEngine または新しい BPMManager クラスで対応
```

#### 2. 可変レーン数（4〜8レーン）
```typescript
// ChartData に activeLanes を追加
activeLanes: [0, 1, 2, 3] // 4レーンモード

// GameScene で LANE_COUNT の代わりに activeLanes.length を使用
```

#### 3. 譜面エディタ
- Core Layer を再利用
- React + Canvas でエディタUI構築
- リアルタイムプレビュー機能

#### 4. 譜面自動生成
- Web Audio API で波形解析
- BPM検出（autocorrelation等）
- ビート検出（onset detection）
- ChartData 形式で出力

---

## 📋 コーディング規約

### TypeScript
- `strict: true` 必須
- `any` 型の使用禁止（Biomeで警告）
- enum または union type で状態管理

### コードスタイル（Biome管理）
- **インデント**: 2スペース
- **クォート**: シングルクォート (`'`)
- **セミコロン**: 必須
- **行の長さ**: 100文字まで
- **import順序**: 自動整列

コードを書いたら必ず以下を実行：
```bash
npm run lint  # 自動修正
```

### 命名規則
- クラス・型：PascalCase (`GameScene`, `ChartData`)
- 関数・変数：camelCase (`getCurrentTime`, `noteIndex`)
- 定数：UPPER_SNAKE_CASE (`LANE_COUNT`, `NOTE_SPEED`)
- private メソッド：`private showEffect()` (prefix 不要)
- 未使用変数：アンダースコアプレフィックス (`_unused`)

### ファイル構成
- 1ファイル1クラス原則
- 型定義は `src/types/` に集約
- 設定値は `src/config/GameConfig.ts` に集約

### コメント

**重要：コメントは「なぜそうなっているか」を説明する**

#### ❌ 悪い例（作業履歴を書いている）
```typescript
// pointeroutは削除（長押し中に指が動いてもミス扱いにしない）
// ここに追加
// XXXを修正
```

#### ✅ 良い例（理由や意図を説明している）
```typescript
// pointeroutイベントは使用しない（長押し中に指が少し動いてもミス扱いにならないようにするため）
// キーリピートを無視（長押し中の連続発火を防ぐ）
// 通常ノートは判定済みならactiveNotesから削除されているはずだが、念のため画面外チェック
```

#### コメントのガイドライン
- **作業履歴ではなく、コードの意図を説明する**
- 「追加」「削除」「修正」などの作業単位ではなく、「なぜこうなっているか」を書く
- コードから明らかなことは書かない
- JSDoc は主要な public API のみ
- 複雑なロジックには説明コメント
- TODO コメントは避ける（Issue を使用）

#### 不要なコードの削除
- 使わなくなったコードは削除する（コメントアウトして残さない）
- 後方互換性を無駄に残さない
- git履歴があるので、削除しても問題ない

---

## 🧪 テスト

### 実行方法

```bash
npm test        # watch モードで実行
npm run test:run  # 1回だけ実行
```

### テストの配置

- **Core Layer のテストのみ**を `src/core/__tests__/` に配置
- ファイル名は `*.test.ts` 形式（例：`JudgmentSystem.test.ts`）
- Vitest を使用

### テストの書き方

#### 1. DIパターンを活用する

`AudioSyncEngine` は外部依存（AudioContext, fetch）をコンストラクタで注入可能。テスト時はモックを渡す。

```typescript
// 本番コード（デフォルト値を使用）
const engine = new AudioSyncEngine();

// テストコード（モックを注入）
const engine = new AudioSyncEngine({
  audioContextFactory: () => fakeAudioContext,
  fetchFn: fakeFetch,
});
```

#### 2. 設定値はハードコードしない

判定ウィンドウなどの設定値をテストで使う場合、定数をインポートして使用する。
設定値が変更されてもテストが自動追従する。

```typescript
// ❌ NG: ハードコード
expect(system.judge(1030, 0, [note])?.judgment).toBe(JudgmentType.PERFECT);

// ✅ OK: 定数を使用
import { DEFAULT_JUDGMENT_WINDOW } from '../ChartData';
const { perfect } = DEFAULT_JUDGMENT_WINDOW;
expect(system.judge(baseTiming + perfect, 0, [note])?.judgment).toBe(JudgmentType.PERFECT);
```

#### 3. 境界値をテストする

判定システムなど境界が重要なロジックでは、境界値のテストを必ず書く。

```typescript
// 判定ウィンドウの境界
expect(system.shouldMiss(baseTiming + bad, note)).toBe(false);     // 境界内
expect(system.shouldMiss(baseTiming + bad + 1, note)).toBe(true);  // 境界外
```

#### 4. 実装の流れに沿ったテスト

`initialize()` → `loadAudio()` → `play()` など、実際の使用順序に沿ってテストを書く。

```typescript
await engine.initialize();
await engine.loadAudio('test.wav');
engine.play();
```

### テスト対象

**テストすべき：**
- Core Layer（`src/core/*`）- View非依存でテストしやすい
- ヘルパー関数、計算ロジック、判定システム

**テストしない（現時点）：**
- Manager Layer、Scene Layer - Phaser依存があり、モックが複雑

---

## 🐛 デバッグ方法

### 音楽同期のズレ確認
```typescript
// GameScene.ts の update() に追加
console.log('currentTime:', currentTime, 'note.timing:', note.timing);
```

### 判定ウィンドウの可視化
```typescript
// GameConfig.ts で判定ウィンドウを調整
DEFAULT_JUDGMENT_WINDOW = {
  perfect: 100, // 広くすれば判定しやすくなる
  // ...
}
```

### オフセット調整
```typescript
// public/assets/charts/*.json の offset を変更
"offset": -50  // マイナスで早く、プラスで遅く
```

---

## 📚 参考資料

### Phaser 3
- 公式ドキュメント: https://photonstorm.github.io/phaser3-docs/
- シーンライフサイクル: https://rexrainbow.github.io/phaser3-rex-notes/docs/site/scene/

### Web Audio API
- MDN: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
- タイミング精度: AudioContext.currentTime を使用

### リズムゲーム実装
- osu!web (参考実装)
- タイミング補正の重要性

---

## 🤝 開発時の心構え

1. **設定値は GameConfig.ts に集約**
2. **Core Layer を View から独立させる**
3. **マネージャーパターンで Scene の肥大化を防ぐ**
   - 新機能は適切なマネージャーに追加
   - Scene が 500 行を超えたら分割を検討
4. **音楽時刻ベースで計算する（フレーム依存にしない）**
5. **Phaser シーンの再利用を意識する（初期化とクリーンアップ）**
6. **型安全性を保つ（any 禁止）**

---

## ✅ チェックリスト（実装前）

新機能を実装する前に確認：

- [ ] README.md を読んだ
- [ ] このドキュメント（AGENTS.md）を読んだ
- [ ] GameConfig.ts の構造を理解した
- [ ] Core Layer と View Layer の責務を理解した
- [ ] 既存コードの設計思想を尊重できる

---

**Good Luck Coding! 🚀**
