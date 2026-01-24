/**
 * InputManager
 * 入力処理を管理するマネージャー
 */

import Phaser from 'phaser';
import { HI_SPEED } from '../config/GameConfig';
import { getLaneFromKey, LANE_KEYS } from '../core/ChartData';

export class InputManager {
  private scene: Phaser.Scene;
  private onLanePress: (lane: number) => void;
  private onLaneRelease: (lane: number) => void;
  private pressedKeys: Set<number> = new Set();
  private keyObjects: Array<Phaser.Input.Keyboard.Key | null> = [];
  private keyDownHandler?: (event: KeyboardEvent) => void;
  private keyUpHandler?: (event: KeyboardEvent) => void;
  private laneInputEnabled: boolean = true;
  private hiSpeedKeys: {
    up?: Phaser.Input.Keyboard.Key;
    down?: Phaser.Input.Keyboard.Key;
  } = {};
  private hiSpeedHandlers?: {
    up: () => void;
    down: () => void;
  };
  private escKey?: Phaser.Input.Keyboard.Key;
  private escHandler?: () => void;

  constructor(
    scene: Phaser.Scene,
    onLanePress: (lane: number) => void,
    onLaneRelease: (lane: number) => void
  ) {
    this.scene = scene;
    this.onLanePress = onLanePress;
    this.onLaneRelease = onLaneRelease;
  }

  /**
   * キーボード入力をセットアップ
   */
  setupKeyboard(): void {
    const keyboard = this.scene.input.keyboard;
    if (!keyboard) {
      return;
    }

    this.keyObjects = LANE_KEYS.map((key) => keyboard.addKey(key, false));

    // キーダウン
    this.keyDownHandler = (event: KeyboardEvent) => {
      // OSのキーリピートを無視（長押し中の連続発火を防ぐ）
      if (event.repeat) {
        return;
      }

      // event.key と event.code の両方を試す
      let lane = getLaneFromKey(event.key);
      if (lane === null) {
        lane = getLaneFromKey(event.code);
      }
      if (lane !== null) {
        this.handlePress(lane);
      }
    };
    keyboard.on('keydown', this.keyDownHandler);

    // キーアップ
    this.keyUpHandler = (event: KeyboardEvent) => {
      // event.key と event.code の両方を試す
      let lane = getLaneFromKey(event.key);
      if (lane === null) {
        lane = getLaneFromKey(event.code);
      }
      if (lane !== null) {
        this.handleRelease(lane);
      }
    };
    keyboard.on('keyup', this.keyUpHandler);
  }

  /**
   * レーン押下処理
   */
  private handlePress(lane: number): void {
    if (!this.laneInputEnabled) {
      return;
    }
    this.pressedKeys.add(lane);
    this.onLanePress(lane);
  }

  /**
   * レーンリリース処理
   */
  private handleRelease(lane: number): void {
    if (!this.laneInputEnabled) {
      return;
    }
    this.pressedKeys.delete(lane);
    this.onLaneRelease(lane);
  }

  /**
   * 特定のレーンが押されているか
   */
  isKeyPressed(lane: number): boolean {
    if (!this.laneInputEnabled) {
      return false;
    }
    if (lane < 0 || lane >= LANE_KEYS.length) {
      return false;
    }
    const keyObj = this.keyObjects[lane];
    if (keyObj?.isDown) {
      return true;
    }

    return this.pressedKeys.has(lane);
  }

  /**
   * レーン入力の有効/無効を切り替え
   */
  setLaneInputEnabled(enabled: boolean): void {
    this.laneInputEnabled = enabled;
    if (!enabled) {
      this.clearPressedKeys();
    }
  }

  /**
   * ハイスピード変更用キーをセットアップ
   */
  setupHiSpeedKeys(onChange: (delta: number) => void): void {
    const keyboard = this.scene.input.keyboard;
    if (!keyboard) {
      return;
    }

    this.hiSpeedKeys.up = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP);
    this.hiSpeedKeys.down = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN);

    this.hiSpeedHandlers = {
      up: () => onChange(HI_SPEED.STEP),
      down: () => onChange(-HI_SPEED.STEP),
    };

    this.hiSpeedKeys.up.on('down', this.hiSpeedHandlers.up);
    this.hiSpeedKeys.down.on('down', this.hiSpeedHandlers.down);
  }

  /**
   * ギブアップ用のESCキーをセットアップ
   */
  setupEscKey(onEsc: () => void): void {
    const keyboard = this.scene.input.keyboard;
    if (!keyboard) {
      return;
    }

    this.escKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.escHandler = () => onEsc();
    this.escKey.on('down', this.escHandler);
  }

  /**
   * 押されているキーの記録をクリア
   */
  clearPressedKeys(): void {
    this.pressedKeys.clear();
  }

  /**
   * クリーンアップ（シーン終了時）
   */
  cleanup(): void {
    this.pressedKeys.clear();
    const keyboard = this.scene.input.keyboard;
    if (keyboard && this.keyDownHandler) {
      keyboard.off('keydown', this.keyDownHandler);
    }
    if (keyboard && this.keyUpHandler) {
      keyboard.off('keyup', this.keyUpHandler);
    }
    this.keyDownHandler = undefined;
    this.keyUpHandler = undefined;

    if (this.hiSpeedKeys.up && this.hiSpeedHandlers) {
      this.hiSpeedKeys.up.off('down', this.hiSpeedHandlers.up);
    }
    if (this.hiSpeedKeys.down && this.hiSpeedHandlers) {
      this.hiSpeedKeys.down.off('down', this.hiSpeedHandlers.down);
    }
    this.hiSpeedHandlers = undefined;

    if (this.escKey && this.escHandler) {
      this.escKey.off('down', this.escHandler);
    }
    this.escHandler = undefined;
  }
}
