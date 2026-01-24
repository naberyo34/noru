#!/usr/bin/env python3
"""
Chart Generator CLI

音声ファイルから譜面データ（ChartData JSON）を自動生成するCLIツール。

Usage:
    python main.py input.wav -o output.json
    python main.py input.wav -o output.json --title "My Song" --artist "Artist"
    python main.py input.wav -o output.json --difficulty hard
"""

import argparse
import sys
from pathlib import Path

from analyzer import analyze_audio
from chart_builder import Difficulty, build_chart


def parse_args() -> argparse.Namespace:
    """コマンドライン引数をパース"""
    parser = argparse.ArgumentParser(
        description='音声ファイルから譜面データを自動生成する',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    %(prog)s input.wav -o output.json
    %(prog)s input.wav -o output.json --title "Song Title" --artist "Artist Name"
    %(prog)s input.wav -o output.json --difficulty hard
        """,
    )

    parser.add_argument(
        'input',
        type=str,
        help='入力音声ファイル（.wav, .mp3等）',
    )

    parser.add_argument(
        '-o', '--output',
        type=str,
        required=True,
        help='出力する譜面JSONファイルのパス',
    )

    parser.add_argument(
        '--title',
        type=str,
        default='Generated Chart',
        help='楽曲タイトル（デフォルト: Generated Chart）',
    )

    parser.add_argument(
        '--artist',
        type=str,
        default='Unknown',
        help='アーティスト名（デフォルト: Unknown）',
    )

    parser.add_argument(
        '--audio-file',
        type=str,
        default=None,
        help='譜面JSONに記載する音声ファイルパス（デフォルト: 入力ファイル名）',
    )

    parser.add_argument(
        '--difficulty',
        type=str,
        choices=['easy', 'normal', 'hard'],
        default='normal',
        help='難易度（ノート密度に影響）（デフォルト: normal）',
    )

    parser.add_argument(
        '--offset',
        type=int,
        default=0,
        help='音楽とノートの同期オフセット（ミリ秒）（デフォルト: 0）',
    )

    parser.add_argument(
        '-v', '--verbose',
        action='store_true',
        help='詳細な出力を表示',
    )

    return parser.parse_args()


def main() -> int:
    """メイン処理"""
    args = parse_args()

    # 入力ファイルの存在確認
    input_path = Path(args.input)
    if not input_path.exists():
        print(f'Error: 入力ファイルが見つかりません: {args.input}', file=sys.stderr)
        return 1

    # 出力ディレクトリの存在確認
    output_path = Path(args.output)
    if output_path.parent and not output_path.parent.exists():
        print(f'Error: 出力先ディレクトリが存在しません: {output_path.parent}', file=sys.stderr)
        return 1

    # 音声ファイルパス（譜面JSONに記載するパス）
    audio_file = args.audio_file or f'assets/audio/{input_path.name}'

    # 難易度
    difficulty = Difficulty(args.difficulty)

    if args.verbose:
        print(f'入力ファイル: {args.input}')
        print(f'出力ファイル: {args.output}')
        print(f'難易度: {args.difficulty}')
        print()
        print('音声を分析中...')

    try:
        # 音声分析
        analysis = analyze_audio(str(input_path))

        if args.verbose:
            print(f'  BPM: {analysis.bpm.tempo:.1f}')
            print(f'  楽曲長: {analysis.duration_sec:.1f}秒')
            for band_name, onsets in analysis.onsets_by_band.items():
                print(f'  {band_name}帯域のオンセット数: {len(onsets)}')
            print()
            print('譜面を生成中...')

        # 譜面生成
        chart = build_chart(
            analysis=analysis,
            title=args.title,
            artist=args.artist,
            audio_file=audio_file,
            difficulty=difficulty,
            offset=args.offset,
        )

        if args.verbose:
            print(f'  生成されたノート数: {len(chart.notes)}')
            print()

        # JSON出力
        output_path.write_text(chart.to_json(), encoding='utf-8')

        print(f'譜面を生成しました: {args.output}')
        print(f'  ノート数: {len(chart.notes)}')
        print(f'  BPM: {chart.metadata.bpm:.1f}')

        return 0

    except Exception as e:
        print(f'Error: {e}', file=sys.stderr)
        if args.verbose:
            import traceback
            traceback.print_exc()
        return 1


if __name__ == '__main__':
    sys.exit(main())
