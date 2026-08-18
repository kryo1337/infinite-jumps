import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { Chunk } from './chunk';
import { ChunkManager } from './chunk_manager';
import type { ThemeColors } from '../config';
import { PlayerController } from '../player';
import { UIManager } from '../ui_manager';

export abstract class BaseLevel {
  protected scene: THREE.Scene;
  protected world: RAPIER.World;
  protected chunkManager: ChunkManager;
  protected activeChunks: Chunk[] = [];
  protected chunksByCollider: Map<number, Chunk> = new Map();
  protected player!: PlayerController;
  protected ui!: UIManager;

  constructor(scene: THREE.Scene, world: RAPIER.World, chunkManager: ChunkManager) {
    this.scene = scene;
    this.world = world;
    this.chunkManager = chunkManager;
  }

  public setContext(player: PlayerController, ui: UIManager) {
    this.player = player;
    this.ui = ui;
  }

  public abstract load(): void;
  public abstract update(playerZ: number, playerSpeed: number, playerY: number): void;

  public getMinY(): number {
    return 0;
  }

  public dispose() {
    this.activeChunks.forEach(chunk => this.chunkManager.releaseChunk(chunk));
    this.activeChunks = [];
    this.chunksByCollider.clear();
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
      this.addActiveChunk(chunk);
    }
    return chunk;
  }

  protected addActiveChunk(chunk: Chunk) {
    this.activeChunks.push(chunk);
    for (const collider of chunk.colliders) {
      this.chunksByCollider.set(collider.handle, chunk);
    }
  }

  protected releaseChunk(chunk: Chunk) {
    for (const collider of chunk.colliders) {
      this.chunksByCollider.delete(collider.handle);
    }
    this.chunkManager.releaseChunk(chunk);
  }

  public isChunkDeadly(colliderHandle: number): boolean {
    const chunk = this.chunksByCollider.get(colliderHandle);
    return chunk ? chunk.isDeadly : false;
  }

  public getChunkTeleportOffset(colliderHandle: number): THREE.Vector3 | null {
    const chunk = this.chunksByCollider.get(colliderHandle);
    return chunk ? chunk.teleportOffset : null;
  }

  public setMinYThreshold(_y: number): void {
    // override in subclasses
  }

  public updateChunkColors(colors: ThemeColors): void {
    this.chunkManager.setThemeColors(colors);

    const appliedColors = new Set<number>();
    for (const chunk of this.activeChunks) {
      const colorHex = this.getColorForChunk(chunk, colors);
      this.applyColorToChunk(chunk, colorHex);
      appliedColors.add(colorHex);
    }

    this.chunkManager.pruneMaterials(colors, appliedColors);
  }

  protected getColorForChunk(chunk: Chunk, colors: ThemeColors): number {
    if (chunk.isDeadly) {
      return parseInt(colors.damage.slice(1), 16);
    }

    if (chunk.teleportOffset) {
      return parseInt(colors.teleport.slice(1), 16);
    }

    const chunkType = chunk.type.split('_')[0];

    switch (chunkType) {
      case 'box':
        return parseInt(colors.bhop.slice(1), 16);
      case 'ramp':
        return parseInt(colors.surf.slice(1), 16);
      case 'cross':
        return parseInt(colors.bhop.slice(1), 16);
      default:
        return parseInt(colors.primary.slice(1), 16);
    }
  }

  protected applyColorToChunk(chunk: Chunk, colorHex: number): void {
    chunk.applyMaterial(this.chunkManager.getMaterial(colorHex));
  }

  public getChunkManager(): ChunkManager {
    return this.chunkManager;
  }
}
