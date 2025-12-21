import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { BaseLevel } from './levels/base_level';
import { InfiniteLevel } from './levels/infinite';
import { TutorialLevel } from './levels/tutorial';
import { PlayerController } from './player';
import { UIManager } from './ui_manager';
import type { ThemeColors } from './config';

export type LevelType = 'infinite' | 'tutorial';

export class LevelLoader {
  private scene: THREE.Scene;
  private world: RAPIER.World;
  private currentLevel: BaseLevel | null = null;
  public currentLevelType: LevelType | null = null;
  private player!: PlayerController;
  private ui!: UIManager;

  constructor(scene: THREE.Scene, world: RAPIER.World) {
    this.scene = scene;
    this.world = world;
  }

  public setContext(player: PlayerController, ui: UIManager) {
    this.player = player;
    this.ui = ui;
    if (this.currentLevel) {
      this.currentLevel.setContext(player, ui);
    }
  }

  public loadLevel(levelType: LevelType) {
    this.currentLevelType = levelType;
    if (this.currentLevel) {
      try {
        this.currentLevel.dispose();
      } catch (e) {
        console.error('Failed to dispose level:', e);
      }
      this.currentLevel = null;
    }

    if (levelType === 'infinite') {
      this.currentLevel = new InfiniteLevel(this.scene, this.world);
    } else if (levelType === 'tutorial') {
      this.currentLevel = new TutorialLevel(this.scene, this.world);
    }

    if (this.currentLevel) {
      if (!this.player || !this.ui) {
        throw new Error("LevelLoader: Context not set (player/ui missing) before loading level.");
      }
      this.currentLevel.setContext(this.player, this.ui);
      this.currentLevel.load();
    }
  }

  public update(playerZ: number, playerSpeed: number, playerY: number) {
    if (this.currentLevel) {
      this.currentLevel.update(playerZ, playerSpeed, playerY);
    }
  }

  public getMinY(): number {
    return this.currentLevel ? this.currentLevel.getMinY() : 0;
  }

  public checkDeathCollision(handle: number): boolean {
    if (this.currentLevel) {
      return this.currentLevel.isChunkDeadly(handle);
    }
    return false;
  }

  public getTeleportOffset(handle: number): THREE.Vector3 | null {
    if (this.currentLevel) {
      return this.currentLevel.getChunkTeleportOffset(handle);
    }
    return null;
  }

  public setMinYThreshold(y: number) {
    if (this.currentLevel) {
      this.currentLevel.setMinYThreshold(y);
    }
  }

  public updateChunkColors(colors: ThemeColors) {
    if (this.currentLevel) {
      this.currentLevel.updateChunkColors(colors);
    }
  }

  public restart() {
    if (this.currentLevel instanceof TutorialLevel) {
      this.currentLevel.restart();
    }
  }
}
