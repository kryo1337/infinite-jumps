import * as THREE from 'three';
import { BaseLevel } from './base_level';
import { Chunk } from './chunk';

const THEME_COLOR = 0xe0b0ff;

interface BlockType {
  type: 'box' | 'ramp' | 'down_ramp' | 'cross';
  probability: number;
  color: number;
  size?: [number, number, number];
  length?: number;
  extraParams?: any;
  spacingMult?: number;
}

export class InfiniteLevel extends BaseLevel {
  private lastBlockEndZ: number = 5;
  private isFirstGen: boolean = true;
  private lastBlockType: string = 'box';
  private readonly blockTypes: BlockType[] = [
    { type: 'box', probability: 0.8, color: THEME_COLOR, size: [3, 1, 3] },
    { type: 'cross', probability: 0.05, color: THEME_COLOR, size: [6, 6, 0.5], length: 6, extraParams: { armWidth: 1 } },
    { type: 'ramp', probability: 0.15, color: THEME_COLOR, size: [4, 5, 12], spacingMult: 1.5 }
  ];

  private static readonly GEN_CONFIG = {
    SPACING_BASE: 5.0,
    SPACING_SPEED_FACTOR: 5.0,
    X_SPREAD: 10.0,
    Y_OFFSET: 0
  };

  public load() {
    this.spawnChunk('box', [10, 1, 10], { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0, w: 1 }, 0x333333);
    this.lastBlockEndZ = 5;
    this.isFirstGen = true;
    this.lastBlockType = 'box';
  }

  public update(playerZ: number, playerSpeed: number) {
    for (let i = this.activeChunks.length - 1; i >= 0; i--) {
      const chunk = this.activeChunks[i];
      const isStart = Math.abs(chunk.mesh.position.z) < 0.1 && Math.abs(chunk.mesh.position.x) < 0.1;

      if (!isStart && chunk.mesh.position.z < playerZ - 50) {
        this.releaseChunk(chunk);
        this.activeChunks.splice(i, 1);
      }
    }

    let futureBlocks = 0;
    for (const c of this.activeChunks) {
      if (c.mesh.position.z > playerZ) futureBlocks++;
    }

    if (futureBlocks < 4) {
      let typeData: BlockType;

      if (this.isFirstGen) {
        typeData = this.blockTypes[0];
        this.isFirstGen = false;
      } else if (this.lastBlockType !== 'box') {
        typeData = this.blockTypes[0];
      } else {
        typeData = this.pickBlockType();
      }

      this.lastBlockType = typeData.type;

      const size = typeData.size || [3, 1, 3];
      const length = typeData.length ?? size[2];

      const gap = (InfiniteLevel.GEN_CONFIG.SPACING_BASE * (typeData.spacingMult || 1.0)) + (playerSpeed / InfiniteLevel.GEN_CONFIG.SPACING_SPEED_FACTOR);

      const spawnZ = this.lastBlockEndZ + gap + (length / 2);

      const x = (Math.random() - 0.5) * InfiniteLevel.GEN_CONFIG.X_SPREAD;
      const y = InfiniteLevel.GEN_CONFIG.Y_OFFSET;

      if (typeData.type === 'ramp') {
        const offset = typeData.extraParams?.offset || 2.0;
        const rampY = y + 1;

        // Left Ramp
        const qLeft = new THREE.Quaternion();
        this.spawnChunk('ramp', size, { x: -offset, y: rampY, z: spawnZ }, { x: qLeft.x, y: qLeft.y, z: qLeft.z, w: qLeft.w }, typeData.color);

        // Right Ramp
        const qRight = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
        this.spawnChunk('ramp', size, { x: offset, y: rampY, z: spawnZ }, { x: qRight.x, y: qRight.y, z: qRight.z, w: qRight.w }, typeData.color);

      } else if (typeData.type === 'cross') {
        // Cross
        const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
        this.spawnChunk('cross', size, { x: x, y: y, z: spawnZ }, { x: q.x, y: q.y, z: q.z, w: q.w }, typeData.color, typeData.extraParams);

      } else {
        // Box
        this.spawnChunk('box', size, { x: x, y: y, z: spawnZ }, { x: 0, y: 0, z: 0, w: 1 }, typeData.color);
      }

      this.lastBlockEndZ = spawnZ + (length / 2);
    }
  }

  private spawnChunk(
    type: 'box' | 'ramp' | 'down_ramp' | 'cross',
    size: [number, number, number],
    pos: { x: number, y: number, z: number },
    rot: { x: number, y: number, z: number, w: number },
    color: number,
    extraParams?: any
  ): Chunk {
    const chunk = this.chunkManager.spawnChunk(type, size, pos, rot, color, extraParams);
    this.activeChunks.push(chunk);
    return chunk;
  }

  private pickBlockType(): BlockType {
    const randomValue = Math.random();
    let cumulativeProbability = 0;

    for (const block of this.blockTypes) {
      cumulativeProbability += block.probability;
      if (randomValue <= cumulativeProbability) {
        return block;
      }
    }

    return this.blockTypes[0];
  }
}
