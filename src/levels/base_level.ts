import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { Chunk } from './chunk';
import { ChunkManager } from './chunk_manager';

export abstract class BaseLevel {
  protected scene: THREE.Scene;
  protected world: RAPIER.World;
  protected chunkManager: ChunkManager;
  protected activeChunks: Chunk[] = [];

  constructor(scene: THREE.Scene, world: RAPIER.World) {
    this.scene = scene;
    this.world = world;
    this.chunkManager = new ChunkManager(scene, world);
  }

  public abstract load(): void;
  public abstract update(playerZ: number, playerSpeed: number): void;

  public dispose() {
    this.activeChunks.forEach(chunk => this.chunkManager.releaseChunk(chunk));
    this.activeChunks = [];
    this.chunkManager.dispose();
  }

  protected spawnBlock(pos: { x: number, y: number, z: number }, size: [number, number, number], color: number): Chunk {
    const chunk = this.chunkManager.spawnChunk(
      'box',
      size,
      pos,
      { x: 0, y: 0, z: 0, w: 1 },
      color
    );
    if (chunk) {
      this.activeChunks.push(chunk);
    }
    return chunk;
  }

  protected releaseChunk(chunk: Chunk) {
    this.chunkManager.releaseChunk(chunk);
  }
}
