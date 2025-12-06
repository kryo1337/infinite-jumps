import * as THREE from 'three';
import { BaseLevel } from './base_level';
import { Chunk } from './chunk';

interface BlockType {
  type: 'box' | 'ramp' | 'down_ramp' | 'cross' | 'damage' | 'teleport';
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
  private currentY: number = 0;
  private minChunkYThreshold: number = -Infinity;
  private nextLogicalId: number = 0;

  private static readonly CONFIG = {
    SPACING_BASE: 5.0,
    SPACING_SPEED_FACTOR: 5.0,
    X_SPREAD: 10.0,
    Y_OFFSET: 0,
    DAMAGE_COLOR: 0xff0000,
    THEME_COLOR: 0xe0b0ff,
    TELEPORT_COLOR: 0xffff00
  };

  private readonly blockTypes: BlockType[] = [
    { type: 'box', probability: 0.7, color: InfiniteLevel.CONFIG.THEME_COLOR, size: [3, 1, 3] },
    { type: 'teleport', probability: 0.05, color: InfiniteLevel.CONFIG.TELEPORT_COLOR, size: [15, 1, 3] },
    { type: 'damage', probability: 0.05, color: InfiniteLevel.CONFIG.DAMAGE_COLOR, size: [3, 1, 3] },
    { type: 'cross', probability: 0.05, color: InfiniteLevel.CONFIG.THEME_COLOR, size: [6, 6, 0.5], length: 6, extraParams: { armWidth: 1 } },
    { type: 'ramp', probability: 0.15, color: InfiniteLevel.CONFIG.THEME_COLOR, size: [4, 5, 12], spacingMult: 1.5 },
    // { type: 'down_ramp', probability: 0.00, color: InfiniteLevel.CONFIG.THEME_COLOR, size: [9, 22, 27], length: 60, spacingMult: -1, extraParams: { modelPath: '/models/rampdown.glb' } }
  ];

  public load() {
    this.chunkManager.preloadModel('/models/rampdown.glb');
    this.currentY = 0;
    this.minChunkYThreshold = -Infinity;
    this.nextLogicalId = 0;
    this.spawnChunk('box', [10, 1, 10], { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0, w: 1 }, 0x333333, this.nextLogicalId++);
    this.lastBlockEndZ = 5;
    this.isFirstGen = true;
    this.lastBlockType = 'box';
  }

  public setMinYThreshold(y: number) {
    this.minChunkYThreshold = y;
  }

  public getMinY(): number {
    let min = Infinity;
    if (this.activeChunks.length === 0) return 0;

    for (const chunk of this.activeChunks) {
      if (chunk.mesh.position.y < this.minChunkYThreshold) continue;
      if (chunk.mesh.position.y < min) {
        min = chunk.mesh.position.y;
      }
    }
    return min === Infinity ? (this.minChunkYThreshold === -Infinity ? 0 : this.minChunkYThreshold) : min;
  }

  public update(playerZ: number, playerSpeed: number, playerY: number) {
    for (let i = this.activeChunks.length - 1; i >= 0; i--) {
      const chunk = this.activeChunks[i];
      const isStart = Math.abs(chunk.mesh.position.z) < 0.1 && Math.abs(chunk.mesh.position.x) < 0.1;

      const isTooFarBehind = chunk.mesh.position.z < playerZ - 50;
      const isTooFarBelow = chunk.mesh.position.y < playerY - 50;

      if ((!isStart && isTooFarBehind) || isTooFarBelow) {
        this.releaseChunk(chunk);
        this.activeChunks.splice(i, 1);
      }
    }

    const futureLogicalIds = new Set<number>();
    for (const c of this.activeChunks) {
      if (c.mesh.position.z > playerZ) {
        if (c.logicalId !== -1) {
          futureLogicalIds.add(c.logicalId);
        }
      }
    }

    if (futureLogicalIds.size < 4) {
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

      const gap = (InfiniteLevel.CONFIG.SPACING_BASE * (typeData.spacingMult || 1.0)) + (playerSpeed / InfiniteLevel.CONFIG.SPACING_SPEED_FACTOR);

      const spawnZ = this.lastBlockEndZ + gap + (size[2] / 2);

      const x = (Math.random() - 0.5) * InfiniteLevel.CONFIG.X_SPREAD;
      const y = this.currentY + InfiniteLevel.CONFIG.Y_OFFSET;

      const currentLogicalId = this.nextLogicalId++;

      if (typeData.type === 'ramp') {
        const offset = typeData.extraParams?.offset || 2.0;
        const rampY = y + 1;

        // Left Ramp
        const qLeft = new THREE.Quaternion();
        this.spawnChunk('ramp', size, { x: -offset, y: rampY, z: spawnZ }, { x: qLeft.x, y: qLeft.y, z: qLeft.z, w: qLeft.w }, typeData.color, currentLogicalId);

        // Right Ramp
        const qRight = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
        this.spawnChunk('ramp', size, { x: offset, y: rampY, z: spawnZ }, { x: qRight.x, y: qRight.y, z: qRight.z, w: qRight.w }, typeData.color, currentLogicalId);

      } else if (typeData.type === 'cross') {
        const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
        this.spawnChunk('cross', size, { x: x, y: y, z: spawnZ }, { x: q.x, y: q.y, z: q.z, w: q.w }, typeData.color, currentLogicalId, typeData.extraParams);

      } else if (typeData.type === 'down_ramp') {
        const dropHeight = size[1];
        const spawnY = (y + 0.5) - (dropHeight / 2) + 12;
        const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
        this.spawnChunk('down_ramp', size, { x: x, y: spawnY, z: spawnZ }, { x: q.x, y: q.y, z: q.z, w: q.w }, typeData.color, currentLogicalId, typeData.extraParams);
        this.currentY -= (dropHeight - 8);

      } else if (typeData.type === 'damage') {
        const safeColor = InfiniteLevel.CONFIG.THEME_COLOR;
        const damageColor = InfiniteLevel.CONFIG.DAMAGE_COLOR;
        const offset = 3 + (Math.random() * 4);
        const isLeftSafe = Math.random() > 0.5;

        // Left Chunk
        const leftChunk = this.spawnChunk('box', size, { x: x - offset, y: y, z: spawnZ }, { x: 0, y: 0, z: 0, w: 1 }, isLeftSafe ? safeColor : damageColor, currentLogicalId);
        if (!isLeftSafe) leftChunk.isDeadly = true;

        // Right Chunk
        const rightChunk = this.spawnChunk('box', size, { x: x + offset, y: y, z: spawnZ }, { x: 0, y: 0, z: 0, w: 1 }, !isLeftSafe ? safeColor : damageColor, currentLogicalId);
        if (isLeftSafe) rightChunk.isDeadly = true;

      } else if (typeData.type === 'teleport') {
        // Teleport Source
        const sourceChunk = this.spawnChunk('box', size, { x: x, y: y, z: spawnZ }, { x: 0, y: 0, z: 0, w: 1 }, typeData.color, currentLogicalId);
        const teleportHeight = 200;
        sourceChunk.teleportOffset = new THREE.Vector3(0, teleportHeight, 0);

        // Teleport Destination
        this.spawnChunk('box', size, { x: x, y: y + teleportHeight, z: spawnZ }, { x: 0, y: 0, z: 0, w: 1 }, InfiniteLevel.CONFIG.THEME_COLOR, currentLogicalId);
        this.currentY += teleportHeight;

      } else {
        this.spawnChunk('box', size, { x: x, y: y, z: spawnZ }, { x: 0, y: 0, z: 0, w: 1 }, typeData.color, currentLogicalId);
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
    logicalId: number,
    extraParams?: any
  ): Chunk {
    const chunk = this.chunkManager.spawnChunk(type, size, pos, rot, color, extraParams);
    chunk.logicalId = logicalId;
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
