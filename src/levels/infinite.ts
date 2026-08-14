import * as THREE from 'three';
import { BaseLevel } from './base_level';
import { Chunk } from './chunk';
import { GAME_CONFIG, type BlockType, GAME_STATE, DIFFICULTY_SETTINGS, MODE_SETTINGS, MODE_DIFFICULTY_OVERRIDES } from '../config';

const AXIS_X = new THREE.Vector3(1, 0, 0);
const AXIS_Y = new THREE.Vector3(0, 1, 0);
const TMP_QUAT = new THREE.Quaternion();

export class InfiniteLevel extends BaseLevel {
  private lastBlockEndZ: number = 5;
  private isFirstGen: boolean = true;
  private lastBlockType: string = 'box';
  private currentY: number = 0;
  private minChunkYThreshold: number = -Infinity;
  private nextLogicalId: number = 0;
  private futureLogicalIds: Set<number> = new Set<number>();

  public load() {
    // this.chunkManager.preloadModel('/models/rampdown.glb');
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

    this.futureLogicalIds.clear();
    for (const c of this.activeChunks) {
      if (c.mesh.position.z > playerZ) {
        if (c.logicalId !== -1) {
          this.futureLogicalIds.add(c.logicalId);
        }
      }
    }

    if (this.futureLogicalIds.size < 4) {
      const isGeneratingFirstBlock = this.isFirstGen;
      let typeData: BlockType;

      if (this.isFirstGen && GAME_STATE.currentMode !== 'only_surf' && GAME_STATE.currentMode !== 'only_bhop') {
        typeData = GAME_CONFIG.Level.BLOCK_TYPES[0];
        this.isFirstGen = false;
      } else if (this.isFirstGen) {
        typeData = this.pickBlockType();
        this.isFirstGen = false;
      } else if (this.lastBlockType !== 'box' && (GAME_STATE.currentMode === 'obstacles' || GAME_STATE.currentMode === 'bhop_surf')) {
        typeData = GAME_CONFIG.Level.BLOCK_TYPES[0];
      } else {
        typeData = this.pickBlockType();
      }

      this.lastBlockType = typeData.type;

      let sizeMult = 1.0;
      if (GAME_STATE.currentMode !== 'obstacles') {
        const diffSettings = DIFFICULTY_SETTINGS[GAME_STATE.currentDifficulty as keyof typeof DIFFICULTY_SETTINGS];
        if (diffSettings) {
          sizeMult = diffSettings.sizeMult;
        }
      }

      const baseSize = typeData.size || [3, 1, 3];
      let size: [number, number, number];

      if (typeData.type === 'ramp') {
        size = [
          baseSize[0],
          baseSize[1],
          baseSize[2] * sizeMult
        ];
      } else {
        size = [
          baseSize[0] * sizeMult,
          baseSize[1],
          baseSize[2] * sizeMult
        ];
      }

      const length = typeData.length ?? size[2];

      let spacingMult = 1.0;
      let speedSpacingMult = 0.2;
      let distSpacingMult = 0.0;

      if (GAME_STATE.currentMode !== 'obstacles') {
        const diffSettings = DIFFICULTY_SETTINGS[GAME_STATE.currentDifficulty as keyof typeof DIFFICULTY_SETTINGS];
        if (diffSettings) {
          spacingMult = diffSettings.spacingMult;
          speedSpacingMult = diffSettings.speedSpacingMult;
          distSpacingMult = diffSettings.distSpacingMult;
        }

        const overrides = MODE_DIFFICULTY_OVERRIDES[GAME_STATE.currentMode]?.[GAME_STATE.currentDifficulty];
        if (overrides) {
          if (overrides.spacingMult !== undefined) spacingMult = overrides.spacingMult;
          if (overrides.speedSpacingMult !== undefined) speedSpacingMult = overrides.speedSpacingMult;
          if (overrides.distSpacingMult !== undefined) distSpacingMult = overrides.distSpacingMult;
        }
      }

      const distFromStart = Math.max(0, this.lastBlockEndZ);
      let gap = (GAME_CONFIG.Level.SPACING_BASE * (typeData.spacingMult || 1.0) * spacingMult) +
        (playerSpeed * speedSpacingMult) +
        (distFromStart * distSpacingMult);

      if (isGeneratingFirstBlock) {
        const fixedGap = GAME_CONFIG.Level.FIXED_FIRST_GAP?.[GAME_STATE.currentMode];
        if (fixedGap !== undefined) {
          gap = fixedGap;
        }
      }

      const spawnZ = this.lastBlockEndZ + gap + (size[2] / 2);

      const x = (Math.random() - 0.5) * GAME_CONFIG.Level.X_SPREAD;
      const y = this.currentY + GAME_CONFIG.Level.Y_OFFSET;

      const currentLogicalId = this.nextLogicalId++;

      if (typeData.type === 'ramp') {
        const offset = typeData.extraParams?.offset || 2.0;
        const rampY = y + 1;

        // Left Ramp
        const qLeft = TMP_QUAT.identity();
        this.spawnChunk('ramp', size, { x: x - offset, y: rampY, z: spawnZ }, { x: qLeft.x, y: qLeft.y, z: qLeft.z, w: qLeft.w }, typeData.color, currentLogicalId);

        // Right Ramp
        const qRight = TMP_QUAT.setFromAxisAngle(AXIS_Y, Math.PI);
        this.spawnChunk('ramp', size, { x: x + offset, y: rampY, z: spawnZ }, { x: qRight.x, y: qRight.y, z: qRight.z, w: qRight.w }, typeData.color, currentLogicalId);

      } else if (typeData.type === 'cross') {
        const q = TMP_QUAT.setFromAxisAngle(AXIS_X, Math.PI / 2);
        this.spawnChunk('cross', size, { x: x, y: y, z: spawnZ }, { x: q.x, y: q.y, z: q.z, w: q.w }, typeData.color, currentLogicalId, typeData.extraParams);

      } else if (typeData.type === 'down_ramp') {
        const dropHeight = size[1];
        const spawnY = (y + 0.5) - (dropHeight / 2) + 12;
        const q = TMP_QUAT.setFromAxisAngle(AXIS_Y, Math.PI);
        this.spawnChunk('down_ramp', size, { x: x, y: spawnY, z: spawnZ }, { x: q.x, y: q.y, z: q.z, w: q.w }, typeData.color, currentLogicalId, typeData.extraParams);
        this.currentY -= (dropHeight - 8);

      } else if (typeData.type === 'damage') {
        const safeColor = GAME_CONFIG.Level.COLORS.THEME;
        const damageColor = GAME_CONFIG.Level.COLORS.DAMAGE;
        const offset = 3 + (Math.random() * 4);
        const isLeftSafe = Math.random() > 0.5;

        // Left Chunk
        const leftChunk = this.spawnChunk('box', size, { x: x - offset, y: y, z: spawnZ }, { x: 0, y: 0, z: 0, w: 1 }, isLeftSafe ? safeColor : damageColor, currentLogicalId, undefined, !isLeftSafe, false);
        if (!isLeftSafe) leftChunk.isDeadly = true;

        // Right Chunk
        const rightChunk = this.spawnChunk('box', size, { x: x + offset, y: y, z: spawnZ }, { x: 0, y: 0, z: 0, w: 1 }, !isLeftSafe ? safeColor : damageColor, currentLogicalId, undefined, isLeftSafe, false);
        if (isLeftSafe) rightChunk.isDeadly = true;

      } else if (typeData.type === 'teleport') {
        // Teleport Source
        const sourceChunk = this.spawnChunk('box', size, { x: x, y: y, z: spawnZ }, { x: 0, y: 0, z: 0, w: 1 }, typeData.color, currentLogicalId, undefined, false, true);
        const teleportHeight = 200;
        sourceChunk.teleportOffset = new THREE.Vector3(0, teleportHeight, 0);

        // Teleport Destination
        this.spawnChunk('box', size, { x: x, y: y + teleportHeight, z: spawnZ }, { x: 0, y: 0, z: 0, w: 1 }, GAME_CONFIG.Level.COLORS.THEME, currentLogicalId);
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
    extraParams?: any,
    isDeadly: boolean = false,
    isTeleport: boolean = false
  ): Chunk {
    const themeColors = this.chunkManager.getThemeColors();
    let finalColor = color;

    if (themeColors) {
      if (isDeadly) {
        finalColor = parseInt(themeColors.damage.slice(1), 16);
      } else if (isTeleport) {
        finalColor = parseInt(themeColors.teleport.slice(1), 16);
      } else if (type === 'box' || type === 'cross') {
        finalColor = parseInt(themeColors.bhop.slice(1), 16);
      } else if (type === 'ramp') {
        finalColor = parseInt(themeColors.surf.slice(1), 16);
      } else {
        finalColor = parseInt(themeColors.primary.slice(1), 16);
      }
    }

    const chunk = this.chunkManager.spawnChunk(type, size, pos, rot, finalColor, extraParams);
    chunk.logicalId = logicalId;
    this.activeChunks.push(chunk);
    return chunk;
  }

  private pickBlockType(): BlockType {
    let allowedTypes: string[] = [];

    if (GAME_STATE.currentMode === 'obstacles') {
      allowedTypes = MODE_SETTINGS['obstacles'];
    } else {
      allowedTypes = MODE_SETTINGS[GAME_STATE.currentMode] || MODE_SETTINGS['bhop_surf'];
    }

    const availableBlocks = GAME_CONFIG.Level.BLOCK_TYPES.filter(b => allowedTypes.includes(b.type));

    const randomValue = Math.random();
    let cumulativeProbability = 0;

    const modeSettings = GAME_CONFIG.Level.PROBABILITY_SETTINGS[GAME_STATE.currentMode];
    const difficultySettings = modeSettings ? modeSettings[GAME_STATE.currentDifficulty] : null;

    const totalProbability = availableBlocks.reduce((sum, b) => {
      let prob = b.probability || 0;
      if (difficultySettings && difficultySettings[b.type] !== undefined) {
        prob = difficultySettings[b.type];
      }
      return sum + prob;
    }, 0);

    if (totalProbability <= 0) {
      const randomIndex = Math.floor(Math.random() * availableBlocks.length);
      return availableBlocks[randomIndex] || GAME_CONFIG.Level.BLOCK_TYPES[0];
    }

    for (const block of availableBlocks) {
      let prob = block.probability || 0;
      if (difficultySettings && difficultySettings[block.type] !== undefined) {
        prob = difficultySettings[block.type];
      }

      cumulativeProbability += (prob / totalProbability);
      if (randomValue <= cumulativeProbability) {
        return block;
      }
    } return availableBlocks[0] || GAME_CONFIG.Level.BLOCK_TYPES[0];
  }
}
