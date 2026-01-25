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

# RMS計算のパラメータ（調整ポイント）
RMS_FRAME_LENGTH = 2048

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


@dataclass(frozen=True)
class OnsetFeature:
    """オンセットの特徴量"""
    time_sec: float
    strength: float
    rms: float


class AnalysisResult(NamedTuple):
    """音声分析の全結果"""
    bpm: BPMResult
    onsets_by_band: dict[str, list[OnsetFeature]]
    beat_start_ms: Optional[int]
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

def detect_bpm(audio: AudioData) -> tuple[BPMResult, Optional[int]]:
    """
    BPMとビート位置を検出する。

    Args:
        audio: 音声データ

    Returns:
        BPMResult: 検出されたBPM
        最初のビート時刻（ミリ秒）、検出できない場合はNone
    """
    tempo_min = BPM_DETECTION_PARAMS['tempo_min']
    tempo_max = BPM_DETECTION_PARAMS['tempo_max']
    start_bpm = (tempo_min + tempo_max) / 2  # 範囲の中央値を初期値に

    # BPM検出
    tempo, beat_frames = librosa.beat.beat_track(
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

    beat_times = librosa.frames_to_time(beat_frames, sr=audio.sample_rate)
    beat_start_ms = None
    if len(beat_times) > 0:
        beat_start_ms = int(round(float(beat_times[0]) * 1000))

    return BPMResult(tempo=tempo_value), beat_start_ms


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


def extract_onset_features(
    onset_strength: NDArray[np.floating],
    rms: NDArray[np.floating],
    sample_rate: int,
    onset_times: NDArray[np.floating],
) -> list[OnsetFeature]:
    """
    オンセット時刻に対する強度・RMSを抽出する。

    Args:
        onset_strength: 全帯域のオンセット強度
        rms: 全帯域のRMS
        sample_rate: サンプルレート
        onset_times: オンセット時刻（秒単位）

    Returns:
        オンセット特徴量のリスト
    """
    if onset_times.size == 0:
        return []

    hop_length = ONSET_DETECTION_PARAMS['hop_length']
    onset_frames = librosa.time_to_frames(
        onset_times,
        sr=sample_rate,
        hop_length=hop_length,
    )

    max_strength_idx = len(onset_strength) - 1
    max_rms_idx = len(rms) - 1

    features: list[OnsetFeature] = []
    for time_sec, frame_idx in zip(onset_times, onset_frames):
        strength_idx = int(min(max(frame_idx, 0), max_strength_idx))
        rms_idx = int(min(max(frame_idx, 0), max_rms_idx))
        features.append(
            OnsetFeature(
                time_sec=float(time_sec),
                strength=float(onset_strength[strength_idx]),
                rms=float(rms[rms_idx]),
            ),
        )

    return features


def detect_onsets_by_band(
    audio: AudioData,
    onset_strength: NDArray[np.floating],
    rms: NDArray[np.floating],
) -> dict[str, list[OnsetFeature]]:
    """
    周波数帯域別にオンセットを検出する。

    Args:
        audio: 音声データ

    Returns:
        帯域名をキー、オンセット特徴量リストを値とする辞書
    """
    results: dict[str, list[OnsetFeature]] = {}

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
        results[band.name] = extract_onset_features(
            onset_strength,
            rms,
            audio.sample_rate,
            onsets,
        )

    return results


def compute_onset_strength_and_rms(
    audio: AudioData,
) -> tuple[NDArray[np.floating], NDArray[np.floating]]:
    """
    全帯域のオンセット強度とRMSを計算する。

    Args:
        audio: 音声データ

    Returns:
        オンセット強度配列とRMS配列
    """
    hop_length = ONSET_DETECTION_PARAMS['hop_length']
    onset_strength = librosa.onset.onset_strength(
        y=audio.waveform,
        sr=audio.sample_rate,
        hop_length=hop_length,
    )
    rms = librosa.feature.rms(
        y=audio.waveform,
        frame_length=RMS_FRAME_LENGTH,
        hop_length=hop_length,
    )[0]
    return onset_strength, rms


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
    bpm_result, beat_start_ms = detect_bpm(audio)

    # 全帯域の強度・音量を計算
    onset_strength, rms = compute_onset_strength_and_rms(audio)

    # 周波数帯域別オンセット検出
    onsets_by_band = detect_onsets_by_band(audio, onset_strength, rms)

    # 楽曲の長さ（秒）
    duration_sec = len(audio.waveform) / audio.sample_rate

    return AnalysisResult(
        bpm=bpm_result,
        onsets_by_band=onsets_by_band,
        beat_start_ms=beat_start_ms,
        duration_sec=duration_sec,
    )
