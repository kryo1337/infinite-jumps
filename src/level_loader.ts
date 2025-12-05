import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { BaseLevel } from './levels/base_level';
import { InfiniteLevel } from './levels/infinite';

export type LevelType = 'infinite';

export class LevelLoader {
  private scene: THREE.Scene;
  private world: RAPIER.World;
  private currentLevel: BaseLevel | null = null;
  public currentLevelType: LevelType | null = null;

  constructor(scene: THREE.Scene, world: RAPIER.World) {
    this.scene = scene;
    this.world = world;
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
    }

    if (this.currentLevel) {
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
}
