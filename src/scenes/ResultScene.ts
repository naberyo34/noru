/**
 * ResultScene
 * リザルト画面
 */

import Phaser from 'phaser';
import { ANIMATION, JUDGMENT_COLORS_CSS, RESULT_UI } from '../config/GameConfig';
import { JudgmentType, type PlayResult } from '../core/ChartData';

export class ResultScene extends Phaser.Scene {
  constructor() {
    super({ key: 'ResultScene' });
  }

  create(data: { result: PlayResult; chartMetadata: { title: string; artist: string } }) {
    const { width, height } = this.cameras.main;
    const { result, chartMetadata } = data;

    // フェードイン
    this.cameras.main.fadeIn(ANIMATION.FADE_IN_DURATION, 0, 0, 0);

    // 背景
    this.add.rectangle(
      width / 2,
      height / 2,
      width,
      height,
      RESULT_UI.BACKGROUND_COLOR,
      RESULT_UI.BACKGROUND_ALPHA
    );

    // タイトル
    this.add
      .text(width / 2, RESULT_UI.TITLE_Y, 'RESULT', {
        fontSize: RESULT_UI.TITLE_FONT,
        color: RESULT_UI.TITLE_COLOR,
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    // 楽曲情報
    this.add
      .text(width / 2, RESULT_UI.SONG_TITLE_Y, chartMetadata.title, {
        fontSize: RESULT_UI.SONG_TITLE_FONT,
        color: RESULT_UI.SONG_TITLE_COLOR,
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, RESULT_UI.SONG_ARTIST_Y, chartMetadata.artist, {
        fontSize: RESULT_UI.SONG_ARTIST_FONT,
        color: RESULT_UI.SONG_ARTIST_COLOR,
      })
      .setOrigin(0.5);

    // スコア
    this.add
      .text(width / 2, RESULT_UI.SCORE_Y, `Score: ${result.score}`, {
        fontSize: RESULT_UI.SCORE_FONT,
        color: RESULT_UI.SCORE_COLOR,
      })
      .setOrigin(0.5);

    // 正確度
    const accuracyColor = this.getAccuracyColor(result.accuracy);
    this.add
      .text(width / 2, RESULT_UI.ACCURACY_Y, `Accuracy: ${result.accuracy.toFixed(2)}%`, {
        fontSize: RESULT_UI.ACCURACY_FONT,
        color: accuracyColor,
      })
      .setOrigin(0.5);

    // 最大コンボ
    this.add
      .text(width / 2, RESULT_UI.MAX_COMBO_Y, `Max Combo: ${result.maxCombo}`, {
        fontSize: RESULT_UI.MAX_COMBO_FONT,
        color: RESULT_UI.MAX_COMBO_COLOR,
      })
      .setOrigin(0.5);

    // 判定カウント
    const judgmentY = RESULT_UI.JUDGMENT_TITLE_Y;
    const judgmentData = [
      {
        type: JudgmentType.PERFECT,
        color: JUDGMENT_COLORS_CSS[JudgmentType.PERFECT],
        count: result.judgmentCounts[JudgmentType.PERFECT],
      },
      {
        type: JudgmentType.GREAT,
        color: JUDGMENT_COLORS_CSS[JudgmentType.GREAT],
        count: result.judgmentCounts[JudgmentType.GREAT],
      },
      {
        type: JudgmentType.GOOD,
        color: JUDGMENT_COLORS_CSS[JudgmentType.GOOD],
        count: result.judgmentCounts[JudgmentType.GOOD],
      },
      {
        type: JudgmentType.BAD,
        color: JUDGMENT_COLORS_CSS[JudgmentType.BAD],
        count: result.judgmentCounts[JudgmentType.BAD],
      },
      {
        type: JudgmentType.MISS,
        color: JUDGMENT_COLORS_CSS[JudgmentType.MISS],
        count: result.judgmentCounts[JudgmentType.MISS],
      },
    ];

    this.add
      .text(width / 2, judgmentY, 'Judgments', {
        fontSize: RESULT_UI.JUDGMENT_TITLE_FONT,
        color: RESULT_UI.JUDGMENT_TITLE_COLOR,
      })
      .setOrigin(0.5);

    let currentY = judgmentY + RESULT_UI.JUDGMENT_START_OFFSET;
    judgmentData.forEach(({ type, color, count }) => {
      this.add
        .text(width / 2 + RESULT_UI.JUDGMENT_LABEL_X_OFFSET, currentY, `${type}:`, {
          fontSize: RESULT_UI.JUDGMENT_LABEL_FONT,
          color: color,
        })
        .setOrigin(1, 0.5);

      this.add
        .text(width / 2 + RESULT_UI.JUDGMENT_VALUE_X_OFFSET, currentY, `${count}`, {
          fontSize: RESULT_UI.JUDGMENT_VALUE_FONT,
          color: RESULT_UI.JUDGMENT_VALUE_COLOR,
        })
        .setOrigin(1, 0.5);

      currentY += RESULT_UI.JUDGMENT_ROW_GAP;
    });

    // 操作説明
    this.add
      .text(
        width / 2,
        height - RESULT_UI.HINT1_OFFSET_Y,
        'ENTER / SPACE / Click : Back to Song Select',
        {
          fontSize: RESULT_UI.HINT1_FONT,
          color: RESULT_UI.HINT1_COLOR,
        }
      )
      .setOrigin(0.5);

    this.add
      .text(width / 2, height - RESULT_UI.HINT2_OFFSET_Y, 'ESC : Back to Title', {
        fontSize: RESULT_UI.HINT2_FONT,
        color: RESULT_UI.HINT2_COLOR,
      })
      .setOrigin(0.5);

    // キーボード入力
    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      this.handleKeyInput(event.key);
    });

    // クリック/タップで楽曲選択へ
    this.input.on('pointerdown', () => {
      this.backToSongSelect();
    });
  }

  private getAccuracyColor(accuracy: number): string {
    if (accuracy >= RESULT_UI.ACCURACY_THRESHOLDS.PERFECT) {
      return JUDGMENT_COLORS_CSS[JudgmentType.PERFECT];
    }
    if (accuracy >= RESULT_UI.ACCURACY_THRESHOLDS.GREAT) {
      return JUDGMENT_COLORS_CSS[JudgmentType.GREAT];
    }
    if (accuracy >= RESULT_UI.ACCURACY_THRESHOLDS.GOOD) {
      return JUDGMENT_COLORS_CSS[JudgmentType.GOOD];
    }
    if (accuracy >= RESULT_UI.ACCURACY_THRESHOLDS.BAD) {
      return JUDGMENT_COLORS_CSS[JudgmentType.BAD];
    }
    return JUDGMENT_COLORS_CSS[JudgmentType.MISS];
  }

  private handleKeyInput(key: string) {
    switch (key.toLowerCase()) {
      case 'enter':
      case ' ':
        this.backToSongSelect();
        break;
      case 'escape':
        this.backToTitle();
        break;
    }
  }

  private backToSongSelect() {
    this.cameras.main.fadeOut(ANIMATION.FADE_OUT_TO_GAME, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('SongSelectScene');
    });
  }

  private backToTitle() {
    this.cameras.main.fadeOut(ANIMATION.FADE_OUT_DURATION, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('TitleScene');
    });
  }
}
