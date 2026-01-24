"""
Audio Analyzer Module

音声ファイルの分析を行うモジュール。
BPM検出、周波数帯域別オンセット検出を担当。
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import NamedTuple, Optional

import librosa
import numpy as np
from numpy.typing import NDArray
from scipy.signal import butter, sosfilt


# =============================================================================
# 設定値（調整しやすいように定数として分離）
# =============================================================================

@dataclass(frozen=True)
class FrequencyBand:
    """周波数帯域の定義"""
    name: str
    low_hz: float
    high_hz: float


# 周波数帯域の定義（調整ポイント）
FREQUENCY_BANDS: tuple[FrequencyBand, ...] = (
    FrequencyBand(name='low', low_hz=20, high_hz=250),      # ベース・キック
    FrequencyBand(name='mid', low_hz=250, high_hz=2000),    # スネア・メロディ
    FrequencyBand(name='high', low_hz=2000, high_hz=8000),  # ハイハット・シンバル
)

# オンセット検出のパラメータ（調整ポイント）
ONSET_DETECTION_PARAMS = {
    'hop_length': 512,      # フレームのホップ長
    'backtrack': True,      # オンセットを音の立ち上がりに戻す
    'units': 'time',        # 結果を秒単位で返す
}

# バンドパスフィルタの次数
FILTER_ORDER = 4

# BPM検出のパラメータ（調整ポイント）
BPM_DETECTION_PARAMS = {
    'tempo_min': 90,   # 検出するBPMの下限
    'tempo_max': 200,  # 検出するBPMの上限
}


# =============================================================================
# データ型定義
# =============================================================================

class AudioData(NamedTuple):
    """読み込んだ音声データ"""
    waveform: NDArray[np.floating]
    sample_rate: int


class BPMResult(NamedTuple):
    """BPM検出結果"""
    tempo: float


class AnalysisResult(NamedTuple):
    """音声分析の全結果"""
    bpm: BPMResult
    onsets_by_band: dict[str, NDArray[np.floating]]
    duration_sec: float


# =============================================================================
# 音声読み込み
# =============================================================================

def load_audio(file_path: str, target_sr: Optional[int] = None) -> AudioData:
    """
    音声ファイルを読み込む。

    Args:
        file_path: 音声ファイルのパス
        target_sr: リサンプリング先のサンプルレート（Noneの場合は元のまま）

    Returns:
        AudioData: 波形データとサンプルレート
    """
    waveform, sample_rate = librosa.load(file_path, sr=target_sr, mono=True)
    return AudioData(waveform=waveform, sample_rate=sample_rate)


# =============================================================================
# BPM検出
# =============================================================================

def detect_bpm(audio: AudioData) -> BPMResult:
    """
    BPMとビート位置を検出する。

    Args:
        audio: 音声データ

    Returns:
        BPMResult: 検出されたBPMとビート位置
    """
    tempo_min = BPM_DETECTION_PARAMS['tempo_min']
    tempo_max = BPM_DETECTION_PARAMS['tempo_max']
    start_bpm = (tempo_min + tempo_max) / 2  # 範囲の中央値を初期値に

    # BPM検出
    tempo, _ = librosa.beat.beat_track(
        y=audio.waveform,
        sr=audio.sample_rate,
        start_bpm=start_bpm,
    )
    tempo_value = float(tempo[0]) if hasattr(tempo, '__len__') else float(tempo)

    # 範囲外なら倍/半分に調整
    while tempo_value < tempo_min and tempo_value * 2 <= tempo_max:
        tempo_value *= 2
    while tempo_value > tempo_max and tempo_value / 2 >= tempo_min:
        tempo_value /= 2

    return BPMResult(tempo=tempo_value)


# =============================================================================
# 周波数フィルタリング
# =============================================================================

def apply_bandpass_filter(
    waveform: NDArray[np.floating],
    sample_rate: int,
    low_hz: float,
    high_hz: float,
) -> NDArray[np.floating]:
    """
    バンドパスフィルタを適用する。

    Args:
        waveform: 入力波形
        sample_rate: サンプルレート
        low_hz: 下限周波数
        high_hz: 上限周波数

    Returns:
        フィルタ適用後の波形
    """
    # ナイキスト周波数でクリップ
    nyquist = sample_rate / 2
    low_normalized = max(low_hz / nyquist, 0.001)
    high_normalized = min(high_hz / nyquist, 0.999)

    sos = butter(
        FILTER_ORDER,
        [low_normalized, high_normalized],
        btype='band',
        output='sos',
    )
    return sosfilt(sos, waveform)


# =============================================================================
# オンセット検出
# =============================================================================

def detect_onsets(
    waveform: NDArray[np.floating],
    sample_rate: int,
) -> NDArray[np.floating]:
    """
    オンセット（音の立ち上がり）を検出する。

    Args:
        waveform: 入力波形
        sample_rate: サンプルレート

    Returns:
        オンセット位置の配列（秒単位）
    """
    onset_frames = librosa.onset.onset_detect(
        y=waveform,
        sr=sample_rate,
        **ONSET_DETECTION_PARAMS,
    )
    return np.array(onset_frames)


def detect_onsets_by_band(audio: AudioData) -> dict[str, NDArray[np.floating]]:
    """
    周波数帯域別にオンセットを検出する。

    Args:
        audio: 音声データ

    Returns:
        帯域名をキー、オンセット位置配列を値とする辞書
    """
    results: dict[str, NDArray[np.floating]] = {}

    for band in FREQUENCY_BANDS:
        # バンドパスフィルタを適用
        filtered = apply_bandpass_filter(
            audio.waveform,
            audio.sample_rate,
            band.low_hz,
            band.high_hz,
        )
        # オンセット検出
        onsets = detect_onsets(filtered, audio.sample_rate)
        results[band.name] = onsets

    return results


# =============================================================================
# メイン分析関数
# =============================================================================

def analyze_audio(file_path: str) -> AnalysisResult:
    """
    音声ファイルを分析し、BPMとオンセット情報を取得する。

    Args:
        file_path: 音声ファイルのパス

    Returns:
        AnalysisResult: 分析結果
    """
    # 音声読み込み
    audio = load_audio(file_path)

    # BPM検出
    bpm_result = detect_bpm(audio)

    # 周波数帯域別オンセット検出
    onsets_by_band = detect_onsets_by_band(audio)

    # 楽曲の長さ（秒）
    duration_sec = len(audio.waveform) / audio.sample_rate

    return AnalysisResult(
        bpm=bpm_result,
        onsets_by_band=onsets_by_band,
        duration_sec=duration_sec,
    )
