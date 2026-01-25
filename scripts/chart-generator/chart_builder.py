"""
Chart Builder Module

分析結果から譜面データ（ChartData JSON）を生成するモジュール。
レーン配置ロジック、ノート密度調整を担当。
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from enum import Enum
from statistics import median
from typing import Any, Optional

import numpy as np
from numpy.typing import NDArray

from analyzer import AnalysisResult, OnsetFeature


# =============================================================================
# 設定値（調整しやすいように定数として分離）
# =============================================================================

@dataclass(frozen=True)
class LaneMapping:
    """周波数帯域からレーンへのマッピング"""
    band_name: str
    lanes: tuple[int, ...]


# 周波数帯域 → レーンのマッピング（調整ポイント）
LANE_MAPPINGS: tuple[LaneMapping, ...] = (
    LaneMapping(band_name='low', lanes=(0, 1)),           # 低音域 → レーン0-1
    LaneMapping(band_name='mid', lanes=(2, 3, 4, 5)),     # 中音域 → レーン2-5
    LaneMapping(band_name='high', lanes=(6, 7)),          # 高音域 → レーン6-7
)

# クォンタイズ設定（グリッド基準）
QUANTIZE_DIVISION = 16  # 1/16グリッドに吸着


class Difficulty(Enum):
    """難易度設定"""
    EASY = 'easy'
    NORMAL = 'normal'
    HARD = 'hard'


@dataclass(frozen=True)
class DifficultyParams:
    """難易度別のパラメータ（音符単位）"""
    note_division: int  # 音符の分割数（4=4分音符、8=8分音符、16=16分音符）
    chord_window_ms: int  # 同時押しとみなす時間幅
    max_chord_notes: int  # 同時押しの最大数
    chord_strength_percentile: int  # 強度の閾値（パーセンタイル）
    chord_rms_percentile: int  # RMSの閾値（パーセンタイル）
    chord_local_window_ms: int  # 強度・音量を評価する時間窓


# 難易度別パラメータ（調整ポイント）
# BPMから間隔を計算: 60000 / BPM / (note_division / 4) ms
DIFFICULTY_SETTINGS: dict[Difficulty, DifficultyParams] = {
    Difficulty.EASY: DifficultyParams(
        note_division=4,
        chord_window_ms=30,
        max_chord_notes=2,
        chord_strength_percentile=90,
        chord_rms_percentile=90,
        chord_local_window_ms=4000,
    ),  # 4分音符間隔
    Difficulty.NORMAL: DifficultyParams(
        note_division=8,
        chord_window_ms=35,
        max_chord_notes=2,
        chord_strength_percentile=85,
        chord_rms_percentile=85,
        chord_local_window_ms=3000,
    ),  # 8分音符間隔
    Difficulty.HARD: DifficultyParams(
        note_division=16,
        chord_window_ms=40,
        max_chord_notes=3,
        chord_strength_percentile=80,
        chord_rms_percentile=80,
        chord_local_window_ms=2500,
    ),  # 16分音符間隔
}


def calc_min_interval_ms(bpm: float, note_division: int) -> float:
    """
    BPMと音符分割数から最小間隔（ミリ秒）を計算する。

    Args:
        bpm: BPM
        note_division: 音符の分割数（4, 8, 16など）

    Returns:
        最小間隔（ミリ秒）
    """
    # 4分音符 = 60000 / BPM
    # 8分音符 = 4分音符 / 2
    # 16分音符 = 4分音符 / 4
    quarter_note_ms = 60000 / bpm
    return quarter_note_ms / (note_division / 4)


# =============================================================================
# データ型定義
# =============================================================================

@dataclass
class NoteData:
    """ノートデータ"""
    lane: int
    timing: int  # ミリ秒
    band_name: Optional[str] = None
    strength: float = 0.0
    rms: float = 0.0


@dataclass
class ChartMetadata:
    """譜面メタデータ"""
    title: str
    artist: str
    audio_file: str
    bpm: float
    time_signature: tuple[int, int]
    offset: int


@dataclass
class ChartData:
    """譜面データ全体"""
    metadata: ChartMetadata
    notes: list[NoteData]

    def to_dict(self) -> dict[str, Any]:
        """JSON出力用の辞書に変換"""
        return {
            'metadata': {
                'title': self.metadata.title,
                'artist': self.metadata.artist,
                'audioFile': self.metadata.audio_file,
                'bpm': self.metadata.bpm,
                'timeSignature': list(self.metadata.time_signature),
                'offset': self.metadata.offset,
            },
            'notes': [
                {'lane': note.lane, 'timing': note.timing}
                for note in self.notes
            ],
        }

    def to_json(self, indent: int = 2) -> str:
        """JSON文字列に変換"""
        return json.dumps(self.to_dict(), indent=indent, ensure_ascii=False)


# =============================================================================
# ノート生成
# =============================================================================

def _get_lane_mapping(band_name: str) -> Optional[tuple[int, ...]]:
    """帯域名からレーンマッピングを取得"""
    for mapping in LANE_MAPPINGS:
        if mapping.band_name == band_name:
            return mapping.lanes
    return None


def _seconds_to_ms(seconds: float) -> int:
    """秒をミリ秒に変換"""
    return int(seconds * 1000)


def generate_notes_from_onsets(
    onsets_by_band: dict[str, list[OnsetFeature]],
) -> list[NoteData]:
    """
    オンセット情報からノートを生成する。

    同じ帯域内での連続ノートは、交互にレーンを切り替えて配置。

    Args:
        onsets_by_band: 帯域名→オンセット特徴量の辞書

    Returns:
        生成されたノートのリスト（時間順でソートされていない）
    """
    notes: list[NoteData] = []

    for band_name, onset_times in onsets_by_band.items():
        lanes = _get_lane_mapping(band_name)
        if lanes is None:
            continue

        # 交互にレーンを切り替える
        lane_index = 0
        for onset in onset_times:
            timing_ms = _seconds_to_ms(onset.time_sec)
            lane = lanes[lane_index % len(lanes)]
            notes.append(
                NoteData(
                    lane=lane,
                    timing=timing_ms,
                    band_name=band_name,
                    strength=onset.strength,
                    rms=onset.rms,
                ),
            )
            lane_index += 1

    return notes


def quantize_notes_to_grid(
    notes: list[NoteData],
    bpm: float,
    beat_start_ms: Optional[int],
    division: int,
) -> list[NoteData]:
    """
    最初のビート時刻以降のノートをグリッドへ吸着する。

    Args:
        notes: 入力ノートリスト
        bpm: BPM
        beat_start_ms: 最初のビート時刻（ミリ秒）
        division: 分割数（16=16分音符グリッド）

    Returns:
        クォンタイズ済みのノートリスト
    """
    if not notes or beat_start_ms is None:
        return notes

    grid_ms = calc_min_interval_ms(bpm, division)
    if grid_ms <= 0:
        return notes

    quantized: list[NoteData] = []

    for note in notes:
        if note.timing < beat_start_ms:
            quantized.append(note)
            continue

        offset_ms = note.timing - beat_start_ms
        snapped = beat_start_ms + round(offset_ms / grid_ms) * grid_ms

        quantized.append(
            NoteData(
                lane=note.lane,
                timing=int(round(snapped)),
                band_name=note.band_name,
                strength=note.strength,
                rms=note.rms,
            ),
        )

    return quantized


# =============================================================================
# ノート密度調整
# =============================================================================

def filter_onset_features_by_interval(
    onsets: list[OnsetFeature],
    min_interval_ms: float,
) -> list[OnsetFeature]:
    """
    最小間隔より短い間隔のオンセットを間引く。

    Args:
        onsets: オンセット特徴量
        min_interval_ms: 最小間隔（ミリ秒）

    Returns:
        間引き後のオンセット特徴量
    """
    if not onsets:
        return []

    min_interval_sec = min_interval_ms / 1000.0
    sorted_onsets = sorted(onsets, key=lambda onset: onset.time_sec)

    filtered: list[OnsetFeature] = [sorted_onsets[0]]
    for onset in sorted_onsets[1:]:
        if onset.time_sec - filtered[-1].time_sec >= min_interval_sec:
            filtered.append(onset)

    return filtered


def filter_onsets_by_band(
    onsets_by_band: dict[str, list[OnsetFeature]],
    min_interval_ms: float,
) -> dict[str, list[OnsetFeature]]:
    """
    帯域ごとに最小間隔でオンセットを間引く。

    Args:
        onsets_by_band: 帯域ごとのオンセット特徴量
        min_interval_ms: 最小間隔（ミリ秒）

    Returns:
        間引き後のオンセット辞書
    """
    return {
        band_name: filter_onset_features_by_interval(onsets, min_interval_ms)
        for band_name, onsets in onsets_by_band.items()
    }


def _get_cluster_max_strength(cluster_notes: list[NoteData]) -> float:
    return max(note.strength for note in cluster_notes)


def _get_cluster_max_rms(cluster_notes: list[NoteData]) -> float:
    return max(note.rms for note in cluster_notes)


def select_chord_notes(
    cluster_notes: list[NoteData],
    max_chord_notes: int,
) -> list[NoteData]:
    """同時押しの上限を超える場合にノートを選別する。"""
    if len(cluster_notes) <= max_chord_notes:
        return cluster_notes

    center_lane = 3.5
    return sorted(
        cluster_notes,
        key=lambda note: (abs(note.lane - center_lane), note.lane),
    )[:max_chord_notes]


def merge_notes_with_chords(
    notes: list[NoteData],
    chord_window_ms: int,
    max_chord_notes: int,
    local_window_ms: int,
    strength_percentile: int,
    rms_percentile: int,
) -> list[NoteData]:
    """
    近接したノートを同時押しとしてまとめる。

    Args:
        notes: 入力ノートリスト
        chord_window_ms: 同時押しとみなす時間幅（ミリ秒）
        max_chord_notes: 同時押しの最大数
        local_window_ms: 強度・音量を評価する時間窓
        strength_percentile: 同時押しを許可する強度の閾値（パーセンタイル）
        rms_percentile: 同時押しを許可するRMSの閾値（パーセンタイル）

    Returns:
        同時押し調整後のノートリスト
    """
    if not notes:
        return []

    sorted_notes = sorted(notes, key=lambda n: n.timing)
    timings = [note.timing for note in sorted_notes]
    strengths = [note.strength for note in sorted_notes]
    rms_values = [note.rms for note in sorted_notes]
    half_window_ms = max(local_window_ms // 2, 0)
    window_start = 0
    window_end = 0
    clusters: list[list[NoteData]] = []
    current_cluster: list[NoteData] = [sorted_notes[0]]

    for note in sorted_notes[1:]:
        if note.timing - current_cluster[-1].timing <= chord_window_ms:
            current_cluster.append(note)
        else:
            clusters.append(current_cluster)
            current_cluster = [note]

    clusters.append(current_cluster)

    merged_notes: list[NoteData] = []
    for cluster in clusters:
        if len(cluster) == 1:
            merged_notes.append(cluster[0])
            continue

        cluster_time = int(round(median([note.timing for note in cluster])))
        window_start_time = cluster_time - half_window_ms
        window_end_time = cluster_time + half_window_ms

        while window_start < len(timings) and timings[window_start] < window_start_time:
            window_start += 1
        while window_end < len(timings) and timings[window_end] <= window_end_time:
            window_end += 1

        local_strengths = strengths[window_start:window_end]
        local_rms = rms_values[window_start:window_end]
        strength_threshold = (
            float(np.percentile(local_strengths, strength_percentile))
            if local_strengths
            else 0.0
        )
        rms_threshold = (
            float(np.percentile(local_rms, rms_percentile))
            if local_rms
            else 0.0
        )

        allow_chord = (
            _get_cluster_max_strength(cluster) >= strength_threshold
            or _get_cluster_max_rms(cluster) >= rms_threshold
        )
        selected_notes = select_chord_notes(
            cluster,
            max_chord_notes if allow_chord else 1,
        )
        for note in selected_notes:
            merged_notes.append(
                NoteData(
                    lane=note.lane,
                    timing=cluster_time,
                    band_name=note.band_name,
                    strength=note.strength,
                    rms=note.rms,
                ),
            )

    return merged_notes


# =============================================================================
# 譜面生成メイン関数
# =============================================================================

def build_chart(
    analysis: AnalysisResult,
    title: str = 'Generated Chart',
    artist: str = 'Unknown',
    audio_file: str = '',
    difficulty: Difficulty = Difficulty.NORMAL,
    offset: int = 0,
) -> ChartData:
    """
    分析結果から譜面データを生成する。

    Args:
        analysis: 音声分析結果
        title: 楽曲タイトル
        artist: アーティスト名
        audio_file: 音声ファイルパス
        difficulty: 難易度
        offset: オフセット（ミリ秒）

    Returns:
        生成された譜面データ
    """
    params = DIFFICULTY_SETTINGS[difficulty]
    min_interval_ms = calc_min_interval_ms(analysis.bpm.tempo, params.note_division)

    # 帯域ごとにオンセットを間引く
    filtered_onsets = filter_onsets_by_band(analysis.onsets_by_band, min_interval_ms)

    # オンセットからノート生成
    notes = generate_notes_from_onsets(filtered_onsets)

    # 最初のビート以降はグリッドに吸着
    notes = quantize_notes_to_grid(
        notes,
        bpm=analysis.bpm.tempo,
        beat_start_ms=analysis.beat_start_ms,
        division=QUANTIZE_DIVISION,
    )

    # 近接ノートを同時押しとしてまとめる
    notes = merge_notes_with_chords(
        notes,
        chord_window_ms=params.chord_window_ms,
        max_chord_notes=params.max_chord_notes,
        local_window_ms=params.chord_local_window_ms,
        strength_percentile=params.chord_strength_percentile,
        rms_percentile=params.chord_rms_percentile,
    )

    # メタデータ作成
    metadata = ChartMetadata(
        title=title,
        artist=artist,
        audio_file=audio_file,
        bpm=analysis.bpm.tempo,
        time_signature=(4, 4),
        offset=offset,
    )

    return ChartData(metadata=metadata, notes=notes)
