# AGENTS.md - 開発者・AIエージェント向けガイド

**このファイルを読む前に、必ず [README.md](README.md) を先に読んでください。**

このドキュメントは、コードベースを理解し、開発を継続するための技術的な情報をまとめたものです。

---

## 🏗️ アーキテクチャ設計

### 基本方針：コアロジックとViewの完全分離

```
┌─────────────────────────────────────┐
│  View Layer (Phaser 3 依存)         │
│  src/scenes/*                       │
│  - TitleScene                       │
│  - SongSelectScene                  │
│  - GameScene                        │
│  - ResultScene                      │
└─────────────┬───────────────────────┘
              │ uses
              ↓
┌─────────────────────────────────────┐
│  Core Layer (View 非依存)           │
│  src/core/*                         │
│  - ChartData (型定義)                │
│  - AudioSyncEngine (音楽同期)        │
│  - JudgmentSystem (判定ロジック)     │
│  - ScoreCalculator (スコア計算)      │
└─────────────────────────────────────┘
```

**重要な設計思想：**
- Core Layerは**Phaserに依存しない**
- 将来、譜面エディタを別UIフレームワーク（React等）で実装可能
- Core Layerのテストが容易

---

## 📁 ディレクトリ構造

```
src/
├── config/              # 設定ファイル（★重要）
│   └── GameConfig.ts    # 全ての設定値を集約
├── core/                # View非依存のコアロジック
│   ├── ChartData.ts     # 型定義とヘルパー関数
│   ├── AudioSyncEngine.ts
│   ├── JudgmentSystem.ts
│   └── ScoreCalculator.ts
├── scenes/              # Phaserシーン（View層）
│   ├── TitleScene.ts
│   ├── SongSelectScene.ts
│   ├── GameScene.ts     # 最も複雑なシーン
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
- `any` 型の使用禁止
- enum または union type で状態管理

### 命名規則
- クラス・型：PascalCase (`GameScene`, `ChartData`)
- 関数・変数：camelCase (`getCurrentTime`, `noteIndex`)
- 定数：UPPER_SNAKE_CASE (`LANE_COUNT`, `NOTE_SPEED`)
- private メソッド：`private showEffect()` (prefix 不要)

### ファイル構成
- 1ファイル1クラス原則
- 型定義は `src/types/` に集約
- 設定値は `src/config/GameConfig.ts` に集約

### コメント
- JSDoc は主要な public API のみ
- 複雑なロジックには説明コメント
- TODO コメントは避ける（Issue を使用）

---

## 🧪 デバッグ方法

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
3. **音楽時刻ベースで計算する（フレーム依存にしない）**
4. **Phaser シーンの再利用を意識する（初期化とクリーンアップ）**
5. **型安全性を保つ（any 禁止）**

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
