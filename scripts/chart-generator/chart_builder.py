"""
Chart Builder Module

分析結果から譜面データ（ChartData JSON）を生成するモジュール。
レーン配置ロジック、ノート密度調整を担当。
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from enum import Enum
from typing import Any, Optional

import numpy as np
from numpy.typing import NDArray

from analyzer import AnalysisResult


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


class Difficulty(Enum):
    """難易度設定"""
    EASY = 'easy'
    NORMAL = 'normal'
    HARD = 'hard'


@dataclass(frozen=True)
class DifficultyParams:
    """難易度別のパラメータ（音符単位）"""
    note_division: int  # 音符の分割数（4=4分音符、8=8分音符、16=16分音符）


# 難易度別パラメータ（調整ポイント）
# BPMから間隔を計算: 60000 / BPM / (note_division / 4) ms
DIFFICULTY_SETTINGS: dict[Difficulty, DifficultyParams] = {
    Difficulty.EASY: DifficultyParams(note_division=4),    # 4分音符間隔
    Difficulty.NORMAL: DifficultyParams(note_division=8),  # 8分音符間隔
    Difficulty.HARD: DifficultyParams(note_division=16),   # 16分音符間隔
}


def calc_min_interval_ms(bpm: float, note_division: int) -> int:
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
    return int(quarter_note_ms / (note_division / 4))


# =============================================================================
# データ型定義
# =============================================================================

@dataclass
class NoteData:
    """ノートデータ"""
    lane: int
    timing: int  # ミリ秒


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
    onsets_by_band: dict[str, NDArray[np.floating]],
) -> list[NoteData]:
    """
    オンセット情報からノートを生成する。

    同じ帯域内での連続ノートは、交互にレーンを切り替えて配置。

    Args:
        onsets_by_band: 帯域名→オンセット位置配列の辞書

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
        for onset_time in onset_times:
            timing_ms = _seconds_to_ms(float(onset_time))
            lane = lanes[lane_index % len(lanes)]
            notes.append(NoteData(lane=lane, timing=timing_ms))
            lane_index += 1

    return notes


# =============================================================================
# ノート密度調整
# =============================================================================

def filter_notes_by_interval(
    notes: list[NoteData],
    min_interval_ms: int,
) -> list[NoteData]:
    """
    最小間隔より短い間隔のノートを間引く。
    レーンに関係なく、直前のノートとの時間差でフィルタするため、
    同時押しは発生しにくい。

    Args:
        notes: 入力ノートリスト
        min_interval_ms: ノート間の最小間隔（ミリ秒）

    Returns:
        間引き後のノートリスト
    """
    if not notes:
        return []

    # 時間順にソート
    sorted_notes = sorted(notes, key=lambda n: n.timing)

    filtered: list[NoteData] = [sorted_notes[0]]
    for note in sorted_notes[1:]:
        # 直前のノートとの間隔をチェック（レーンに関係なく）
        if note.timing - filtered[-1].timing >= min_interval_ms:
            filtered.append(note)

    return filtered


def apply_difficulty_filter(
    notes: list[NoteData],
    difficulty: Difficulty,
    bpm: float,
) -> list[NoteData]:
    """
    難易度に応じてノートを間引く（BPMベース）。

    Args:
        notes: 入力ノートリスト
        difficulty: 難易度
        bpm: BPM

    Returns:
        間引き後のノートリスト
    """
    params = DIFFICULTY_SETTINGS[difficulty]

    # BPMから最小間隔を計算
    min_interval_ms = calc_min_interval_ms(bpm, params.note_division)

    # 最小間隔でフィルタ（レーンに関係なく）
    return filter_notes_by_interval(notes, min_interval_ms)


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
    # オンセットからノート生成
    notes = generate_notes_from_onsets(analysis.onsets_by_band)

    # 難易度に応じた間引き（BPMベース）
    notes = apply_difficulty_filter(notes, difficulty, analysis.bpm.tempo)

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
