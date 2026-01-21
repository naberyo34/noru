import Phaser from 'phaser';
import { TitleScene } from './scenes/TitleScene';
import { SongSelectScene } from './scenes/SongSelectScene';
import { GameScene } from './scenes/GameScene';
import { ResultScene } from './scenes/ResultScene';
import { SCREEN } from './config/GameConfig';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: SCREEN.WIDTH,
  height: SCREEN.HEIGHT,
  parent: 'game-container',
  backgroundColor: '#1a1a2e',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    max: {
      width: SCREEN.WIDTH * SCREEN.MAX_SCALE,
      height: SCREEN.HEIGHT * SCREEN.MAX_SCALE,
    },
  },
  render: {
    pixelArt: true, // ドット絵用のピクセルパーフェクト設定
    antialias: false,
  },
  physics: {
    default: undefined, // 物理演算は使用しない
  },
  scene: [TitleScene, SongSelectScene, GameScene, ResultScene],
};

new Phaser.Game(config);
