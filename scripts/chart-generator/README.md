# Chart Generator

音声ファイルから譜面データ（ChartData JSON）を自動生成する CLI ツール。

## セットアップ

```bash
cd scripts/chart-generator
pip install -r requirements.txt
```

## 使い方

```bash
# 基本
python main.py input.wav -o output.json

# メタデータ指定
python main.py input.wav -o output.json --title "My Song" --artist "Artist"

# 難易度指定（easy / normal / hard）
python main.py input.wav -o output.json --difficulty hard

# オフセット調整（ミリ秒）
python main.py input.wav -o output.json --offset -50

# 詳細出力
python main.py input.wav -o output.json -v
```

### オプション一覧

| オプション | 説明 | デフォルト |
|-----------|------|-----------|
| `-o, --output` | 出力JSONファイルパス（必須） | - |
| `--title` | 楽曲タイトル | `Generated Chart` |
| `--artist` | アーティスト名 | `Unknown` |
| `--audio-file` | 譜面JSONに記載する音声ファイルパス | 入力ファイル名 |
| `--difficulty` | 難易度（`easy` / `normal` / `hard`） | `normal` |
| `--offset` | 音楽とノートの同期オフセット（ms） | `0` |
| `-v, --verbose` | 詳細出力 | - |

---

## アーキテクチャ

```
main.py          CLI エントリーポイント
    │
    ├── analyzer.py       音声分析（BPM検出、オンセット検出）
    │
    └── chart_builder.py  譜面生成（レーン配置、密度調整）
```

---

## 生成ロジック

### 1. 音声分析（analyzer.py）

#### 処理フロー

```
音声ファイル読み込み (librosa)
        │
        ├─ BPM検出 / ビート位置検出 (librosa.beat.beat_track)
        │
        ├─ 強度/音量の共通特徴量を計算
        │   ├─ onset strength (librosa.onset.onset_strength)
        │   └─ RMS (librosa.feature.rms)
        │
        └─ 周波数帯域別オンセット検出
            ├─ low  (20-250Hz)    → ベース・キック
            ├─ mid  (250-2000Hz)  → スネア・メロディ
            └─ high (2000-8000Hz) → ハイハット・シンバル
```

#### 周波数帯域

| 帯域 | 周波数範囲 | 検出対象 |
|------|-----------|---------|
| low | 20-250Hz | ベース、キック |
| mid | 250-2000Hz | スネア、メロディ |
| high | 2000-8000Hz | ハイハット、シンバル |

各帯域に対してバンドパスフィルタ（Butterworth）を適用し、個別にオンセット検出を行う。

#### 強度・音量の特徴量

- **onset strength**（音の立ち上がりの強さ）と **RMS**（音量）を **全帯域の波形から1回だけ計算**。
- 各帯域のオンセット時刻をフレームに変換し、対応する strength / RMS を紐づける。
- これにより「同時押しの判定軸」が帯域に依存せず、曲全体のダイナミクスを反映しやすい。

#### BPM検出 / ビート位置

- 検出範囲: 90-200 BPM
- 範囲外の場合は倍/半分に自動調整（例: 60 BPM → 120 BPM）
- `beat_track` の **最初のビート時刻** をグリッドの起点として使う
- ビートが検出できない冒頭区間は **クォンタイズ対象外**

---

### 2. 譜面生成（chart_builder.py）

#### レーン配置

周波数帯域を8レーンにマッピング：

```
低音(キック/ベース)  │  中音(メロディ/スネア)  │  高音(ハイハット)
    [0] [1]         │    [2] [3] [4] [5]     │      [6] [7]
```

| 帯域 | 配置レーン |
|------|-----------|
| low | 0, 1（左端） |
| mid | 2, 3, 4, 5（中央） |
| high | 6, 7（右端） |

同じ帯域内の連続ノートは**交互にレーンを切り替え**て配置する。

#### 難易度と密度調整

| 難易度 | 音符間隔 | BPM=120時の最小間隔 |
|-------|---------|-------------------|
| easy | 4分音符 | 500ms |
| normal | 8分音符 | 250ms |
| hard | 16分音符 | 125ms |

最小間隔の計算式：

```
最小間隔(ms) = 60000 / BPM / (note_division / 4)
```

#### 間引き・同時押しロジック

- **帯域ごとに**最小間隔でオンセットを間引く（低・中・高で独立）
- 生成されたノートをマージし、近接したタイミングを同時押しとしてまとめる
- 同時押しは**オンセット強度**と**RMS音量**が高い場合のみ許可
- 強度・音量は**全帯域で共通の値**を使い、**局所時間窓**で判定する
- 同時押しの最大数・判定幅・強度/音量の閾値は難易度ごとに調整

#### クォンタイズ

- **最初のビート時刻以降**のノートをグリッドへ吸着
- グリッドは **BPM固定の1/16**（局所テンポには追従しない）
- 冒頭のビート未検出区間は **クォンタイズしない**（原始オンセットを保持）

#### 同時押し判定の詳細

1. **近接クラスタの形成**
   - `chord_window_ms` 以内のノートをまとめてクラスタ化する（連鎖的に近いものは同一クラスタ）。
2. **局所窓での閾値計算**
   - クラスタ中心時刻を基準に `chord_local_window_ms` の時間窓を取り、  
     その窓内の strength / RMS の **パーセンタイル**を閾値として算出。
3. **同時押し許可条件**
   - クラスタ内の **最大 strength** または **最大 RMS** が閾値を超えた場合のみ同時押しにする。

この仕組みにより、**静かなパートでは単押しが維持され、派手なピークでは同時押しが出やすい**。

---

## 調整ポイント

パラメータを変更したい場合は、各ファイルの定数セクションを編集する。

### analyzer.py

```python
# 周波数帯域の定義
FREQUENCY_BANDS = (
    FrequencyBand(name='low', low_hz=20, high_hz=250),
    FrequencyBand(name='mid', low_hz=250, high_hz=2000),
    FrequencyBand(name='high', low_hz=2000, high_hz=8000),
)

# BPM検出範囲
BPM_DETECTION_PARAMS = {
    'tempo_min': 90,
    'tempo_max': 200,
}
```

### chart_builder.py

```python
# 周波数帯域 → レーンのマッピング
LANE_MAPPINGS = (
    LaneMapping(band_name='low', lanes=(0, 1)),
    LaneMapping(band_name='mid', lanes=(2, 3, 4, 5)),
    LaneMapping(band_name='high', lanes=(6, 7)),
)

# クォンタイズ設定（グリッド基準）
QUANTIZE_DIVISION = 16  # 1/16グリッドに吸着

# 難易度別パラメータ
DIFFICULTY_SETTINGS = {
    Difficulty.EASY: DifficultyParams(
        note_division=4,
        chord_window_ms=30,
        max_chord_notes=2,
        chord_strength_percentile=90,
        chord_rms_percentile=90,
        chord_local_window_ms=4000,
    ),
    Difficulty.NORMAL: DifficultyParams(
        note_division=8,
        chord_window_ms=35,
        max_chord_notes=2,
        chord_strength_percentile=85,
        chord_rms_percentile=85,
        chord_local_window_ms=3000,
    ),
    Difficulty.HARD: DifficultyParams(
        note_division=16,
        chord_window_ms=40,
        max_chord_notes=3,
        chord_strength_percentile=80,
        chord_rms_percentile=80,
        chord_local_window_ms=2500,
    ),
}
```

---

## 依存ライブラリ

| ライブラリ | 用途 |
|-----------|------|
| librosa | 音声読み込み、BPM検出、オンセット検出 |
| numpy | 配列操作 |
| scipy | バンドパスフィルタ |
| soundfile | 音声ファイルI/O |

---

## 出力形式

生成されるJSONはゲーム本体の ChartData 形式に準拠：

```json
{
  "metadata": {
    "title": "Song Title",
    "artist": "Artist Name",
    "audioFile": "assets/audio/song.wav",
    "bpm": 120.0,
    "timeSignature": [4, 4],
    "offset": 0
  },
  "notes": [
    { "lane": 0, "timing": 1000 },
    { "lane": 3, "timing": 1250 },
    ...
  ]
}
```

- `timing`: ミリ秒単位の絶対時刻
- `lane`: 0-7 のレーン番号
