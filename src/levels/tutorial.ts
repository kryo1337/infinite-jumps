import * as THREE from 'three';
import { BaseLevel } from './base_level';
import { Chunk } from './chunk';
import { GAME_STATE } from '../config';
import type { ThemeColors } from '../config';

export class TutorialLevel extends BaseLevel {
  private currentRoom: number = 0;
  private currentSpawnPoint: { x: number, y: number, z: number } = { x: 0, y: 3, z: 0 };
  private finishChunkHandle: number | undefined;

  private pressedKeys = {
    w: false,
    a: false,
    s: false,
    d: false,
    space: false
  };

  private room1Complete: boolean = false;
  private isDisposed: boolean = false;
  private completionTimeout: any = null;

  public dispose() {
    this.isDisposed = true;
    if (this.completionTimeout) {
      clearTimeout(this.completionTimeout);
      this.completionTimeout = null;
    }
    super.dispose();
  }

  public load() {
    this.currentRoom = 0;
    this.loadRoom(1);
  }

  public restart() {
    if (this.completionTimeout) {
      clearTimeout(this.completionTimeout);
      this.completionTimeout = null;
    }

    if (this.currentRoom > 5) {
      this.ui.hideTutorialOverlay();
      this.ui.setGameMode('bhop_surf', 'normal');
      GAME_STATE.currentMode = 'bhop_surf';
      GAME_STATE.currentDifficulty = 'normal';
      this.ui.onLoadLevel?.('infinite');
      return;
    }

    this.player.respawn(this.currentSpawnPoint);
    if (this.currentRoom === 1) {
      this.pressedKeys = { w: false, a: false, s: false, d: false, space: false };
      this.room1Complete = false;
      this.updateRoom1Overlay();
    }
  }

  public getMinY(): number {
    return -Infinity;
  }

  protected getColorForChunk(chunk: Chunk, colors: ThemeColors): number {
    if (this.finishChunkHandle !== undefined && chunk.collider.handle === this.finishChunkHandle) {
      return 0x00ff00;
    }
    return super.getColorForChunk(chunk, colors);
  }

  public update(_playerZ: number, _playerSpeed: number, playerY: number) {
    if (playerY < -20) {
      this.player.respawn(this.currentSpawnPoint);
      return;
    }

    if (this.currentRoom === 1) {
      this.updateRoom1();
    } else {
      this.checkFinish();
    }
  }

  private updateRoom1() {
    if (this.room1Complete) return;

    const input = this.player.inputState;

    if (input.forward > 0) this.pressedKeys.w = true;
    if (input.forward < 0) this.pressedKeys.s = true;
    if (input.right < 0) this.pressedKeys.a = true;
    if (input.right > 0) this.pressedKeys.d = true;
    if (input.jump) this.pressedKeys.space = true;

    this.updateRoom1Overlay();

    if (this.pressedKeys.w && this.pressedKeys.a && this.pressedKeys.s &&
      this.pressedKeys.d && this.pressedKeys.space) {
      this.room1Complete = true;
      this.loadRoom(2);
    }
  }

  private updateRoom1Overlay() {
    const color = (active: boolean) => active ? '#69db7c' : '#ffffff';

    const w = `<span style="color: ${color(this.pressedKeys.w)}">W</span>`;
    const a = `<span style="color: ${color(this.pressedKeys.a)}">A</span>`;
    const s = `<span style="color: ${color(this.pressedKeys.s)}">S</span>`;
    const d = `<span style="color: ${color(this.pressedKeys.d)}">D</span>`;
    const space = `<span style="color: ${color(this.pressedKeys.space)}">SPACE</span>`;

    this.ui.showTutorialOverlay(`${w}${a}${s}${d} to Move, ${space} to Jump<br><span style="font-size: 0.8em; color: #aaa;">(R to Restart)</span>`);
  }

  private checkFinish() {
    if (this.finishChunkHandle !== undefined) {
      if (this.player.groundColliderHandle === this.finishChunkHandle) {
        this.loadRoom(this.currentRoom + 1);
      }
    }
  }

  private clearRoom() {
    for (const chunk of this.activeChunks) {
      this.chunkManager.releaseChunk(chunk);
    }
    this.activeChunks = [];
    this.finishChunkHandle = undefined;
  }

  private loadRoom(index: number) {
    this.clearRoom();
    this.currentRoom = index;

    this.currentSpawnPoint = { x: 0, y: 5, z: 0 };

    switch (index) {
      case 1:
        this.setupRoom1();
        break;
      case 2:
        this.setupRoom2();
        break;
      case 3:
        this.setupRoom3();
        break;
      case 4:
        this.setupRoom4();
        break;
      case 5:
        this.setupRoom5();
        break;
      default:
        this.ui.showTutorialOverlay("Tutorial Complete!");
        this.completionTimeout = setTimeout(() => {
          this.completionTimeout = null;
          if (this.isDisposed) return;
          this.ui.hideTutorialOverlay();

          this.ui.setGameMode('bhop_surf', 'normal');
          GAME_STATE.currentMode = 'bhop_surf';
          GAME_STATE.currentDifficulty = 'normal';

          this.ui.onLoadLevel?.('infinite');
        }, 500);
        break;
    }

    this.player.respawn(this.currentSpawnPoint);

    const colors = this.chunkManager.getThemeColors();
    if (colors) {
      this.updateChunkColors(colors);
    }
  }

  private spawnFinishBlock(pos: { x: number, y: number, z: number }, size: [number, number, number] = [5, 1, 5]) {
    const chunk = this.spawnBlock(pos, size, 0x00ff00);
    this.finishChunkHandle = chunk.collider.handle;
  }

  private setupRoom1() {
    this.pressedKeys = { w: false, a: false, s: false, d: false, space: false };
    this.updateRoom1Overlay();
    this.room1Complete = false;

    const color = this.chunkManager.getColorForBlockType('box');
    this.spawnBlock({ x: 0, y: 0, z: 0 }, [20, 1, 20], color);
  }

  private setupRoom2() {
    this.ui.showTutorialOverlay("Jump across the gap");

    const color = this.chunkManager.getColorForBlockType('box');
    this.spawnBlock({ x: 0, y: 0, z: 0 }, [5, 1, 5], color);
    this.spawnFinishBlock({ x: 0, y: 0, z: 12 });
  }

  private setupRoom3() {
    this.ui.showTutorialOverlay("Hold Space to Bunnyhop");

    const color = this.chunkManager.getColorForBlockType('box');
    let z = 0;
    this.spawnBlock({ x: 0, y: 0, z: z }, [5, 1, 5], color);
    z += 8;

    for (let i = 0; i < 10; i++) {
      this.spawnBlock({ x: 0, y: 0, z: z }, [3, 1, 3], color);
      z += 6;
    }

    this.spawnFinishBlock({ x: 0, y: 0, z: z + 2 });
  }

  private spawnChunk(
    type: 'box' | 'ramp' | 'down_ramp' | 'cross',
    size: [number, number, number],
    pos: { x: number, y: number, z: number },
    rot: { x: number, y: number, z: number, w: number },
    color: number
  ): Chunk {
    const chunk = this.chunkManager.spawnChunk(type, size, pos, rot, color);
    this.activeChunks.push(chunk);
    return chunk;
  }

  private setupRoom4() {
    this.ui.showTutorialOverlay("Surf: Hold A/D against the ramp");

    this.spawnBlock({ x: 0, y: 0, z: 0 }, [5, 1, 5], 0x555555);

    let z = 15;
    const rampSize: [number, number, number] = [4, 5, 20];
    const offset = 2.0;

    const qLeft = new THREE.Quaternion();
    const qRight = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);

    const rampColor = this.chunkManager.getColorForBlockType('ramp');
    this.spawnChunk('ramp', rampSize, { x: -offset, y: 1, z: z }, { x: qLeft.x, y: qLeft.y, z: qLeft.z, w: qLeft.w }, rampColor);
    this.spawnChunk('ramp', rampSize, { x: offset, y: 1, z: z }, { x: qRight.x, y: qRight.y, z: qRight.z, w: qRight.w }, rampColor);

    this.spawnFinishBlock({ x: 0, y: -2, z: z + (rampSize[2] / 2) + 10 });
  }

  private setupRoom5() {
    this.ui.showTutorialOverlay("Chain your surf jumps");

    this.spawnBlock({ x: 0, y: 0, z: 0 }, [5, 1, 5], 0x555555);

    let z = 15;
    const rampSize: [number, number, number] = [4, 5, 20];
    const offset = 2.0;
    const qLeft = new THREE.Quaternion();
    const qRight = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
    const rampColor = this.chunkManager.getColorForBlockType('ramp');

    this.spawnChunk('ramp', rampSize, { x: -offset, y: 1, z: z }, { x: qLeft.x, y: qLeft.y, z: qLeft.z, w: qLeft.w }, rampColor);
    this.spawnChunk('ramp', rampSize, { x: offset, y: 1, z: z }, { x: qRight.x, y: qRight.y, z: qRight.z, w: qRight.w }, rampColor);

    z += 30;

    this.spawnChunk('ramp', rampSize, { x: -offset, y: 1, z: z }, { x: qLeft.x, y: qLeft.y, z: qLeft.z, w: qLeft.w }, rampColor);
    this.spawnChunk('ramp', rampSize, { x: offset, y: 1, z: z }, { x: qRight.x, y: qRight.y, z: qRight.z, w: qRight.w }, rampColor);

    z += 25;

    this.spawnFinishBlock({ x: 0, y: -5, z: z + 5 });
  }
}
