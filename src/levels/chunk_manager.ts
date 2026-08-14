import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { Chunk } from './chunk';
import { ShapeFactory } from './shape_factory';
import { ModelLoader } from '../utils/model_loader';
import type { ThemeColors } from '../config';

export class ChunkManager {
  private scene: THREE.Scene;
  private world: RAPIER.World;

  private pools: Map<string, Chunk[]> = new Map();

  private geometryCache: Map<string, THREE.BufferGeometry> = new Map();

  private materialCache: Map<number, THREE.MeshStandardMaterial> = new Map();

  private themeColors: ThemeColors | null = null;

  constructor(scene: THREE.Scene, world: RAPIER.World) {
    this.scene = scene;
    this.world = world;
  }

  public preloadModel(path: string) {
    ModelLoader.load(path);
  }

  public spawnChunk(
    type: 'box' | 'ramp' | 'down_ramp' | 'cross',
    size: [number, number, number],
    pos: { x: number, y: number, z: number },
    rot: { x: number, y: number, z: number, w: number } = { x: 0, y: 0, z: 0, w: 1 },
    color: number,
    extraParams: any = {}
  ): Chunk {
    let key = `${type}_${size[0]}_${size[1]}_${size[2]}`;
    if (type === 'down_ramp' && extraParams.slopeLength) {
      key += `_${extraParams.slopeLength}`;
    } else if (type === 'cross' && extraParams.armWidth) {
      key += `_${extraParams.armWidth}`;
    }

    let pool = this.pools.get(key);
    if (!pool) {
      pool = [];
      this.pools.set(key, pool);
    }

    let chunk = pool.pop();

    if (!chunk) {
      let geometry: THREE.BufferGeometry | null = null;
      let material: THREE.Material | null = null;
      let model: THREE.Object3D | undefined = undefined;
      let colliderDesc: RAPIER.ColliderDesc | RAPIER.ColliderDesc[];

      if (type === 'down_ramp') {
        const path = extraParams.modelPath || '/models/rampdown.glb';
        model = ModelLoader.get(path);
        if (model) {
          const box = new THREE.Box3().setFromObject(model);
          const modelSize = new THREE.Vector3();
          box.getSize(modelSize);

          if (modelSize.x > 0) model.scale.x = size[0] / modelSize.x;
          if (modelSize.y > 0) model.scale.y = size[1] / modelSize.y;
          if (modelSize.z > 0) model.scale.z = size[2] / modelSize.z;

          model.updateMatrixWorld(true);

          const trimesh = ModelLoader.createTrimeshFromModel(model);
          if (trimesh) {
            colliderDesc = trimesh;
          } else {
            colliderDesc = ModelLoader.createColliderFromModel(model);
          }
        } else {
          geometry = this.geometryCache.get(key) || null;
          if (!geometry) {
            geometry = ShapeFactory.createBox(size[0], size[1], size[2]);
            this.geometryCache.set(key, geometry);
          }
          material = this.getMaterial(color);
          colliderDesc = ShapeFactory.createBoxCollider(size[0], size[1], size[2]);
        }
      } else {
        geometry = this.geometryCache.get(key) || null;

        if (!geometry) {
          switch (type) {
            case 'box':
              geometry = ShapeFactory.createBox(size[0], size[1], size[2]);
              colliderDesc = ShapeFactory.createBoxCollider(size[0], size[1], size[2]);
              break;
            case 'ramp':
              geometry = ShapeFactory.createRamp(size[0], size[1], size[2]);
              colliderDesc = ShapeFactory.createRampCollider(size[0], size[1], size[2]);
              break;
            case 'cross':
              const armW = extraParams.armWidth || size[0] / 3;
              const thickness = size[2];
              geometry = ShapeFactory.createCross(size[0], armW, thickness);
              colliderDesc = ShapeFactory.createCrossColliders(size[0], armW, thickness);
              break;
            default:
              throw new Error(`Unknown chunk type: ${type}`);
          }
          this.geometryCache.set(key, geometry);
        } else {
          switch (type) {
            case 'box':
              colliderDesc = ShapeFactory.createBoxCollider(size[0], size[1], size[2]);
              break;
            case 'ramp':
              colliderDesc = ShapeFactory.createRampCollider(size[0], size[1], size[2]);
              break;
            case 'cross':
              const armW = extraParams.armWidth || size[0] / 3;
              const thickness = size[2];
              colliderDesc = ShapeFactory.createCrossColliders(size[0], armW, thickness);
              break;
            default:
              colliderDesc = ShapeFactory.createBoxCollider(size[0], size[1], size[2]);
          }
        }
        material = this.getMaterial(color);
      }

      chunk = new Chunk(key, this.scene, this.world, geometry, material, colliderDesc, model);
    }

    chunk.activate(pos, rot, this.getMaterial(color));
    return chunk;
  }

  public getMaterial(color: number): THREE.MeshStandardMaterial {
    let material = this.materialCache.get(color);
    if (!material) {
      material = new THREE.MeshStandardMaterial({ color });
      this.materialCache.set(color, material);
    }
    return material;
  }

  public releaseChunk(chunk: Chunk) {
    chunk.deactivate();

    const key = chunk.type;
    let pool = this.pools.get(key);
    if (!pool) {
      pool = [];
      this.pools.set(key, pool);
    }
    pool.push(chunk);
  }

  public dispose() {
    this.pools.forEach((chunks) => {
      chunks.forEach(c => c.destroy());
    });
    this.pools.clear();

    this.geometryCache.forEach(g => g.dispose());
    this.geometryCache.clear();

    this.materialCache.forEach(m => m.dispose());
    this.materialCache.clear();
  }

  public setThemeColors(colors: ThemeColors): void {
    this.themeColors = colors;
  }

  public pruneMaterials(colors: ThemeColors, inUse: Set<number>): void {
    const palette = new Set(
      [colors.primary, colors.bhop, colors.surf, colors.teleport, colors.damage].map(c => parseInt(c.slice(1), 16))
    );

    this.materialCache.forEach((material, color) => {
      if (palette.has(color) || inUse.has(color)) return;
      material.dispose();
      this.materialCache.delete(color);
    });
  }

  public getThemeColors(): ThemeColors | null {
    return this.themeColors;
  }

  public getColorForBlockType(blockType: string, isDeadly: boolean = false, isTeleport: boolean = false): number {
    if (!this.themeColors) {
      if (isDeadly) return 0xff0000;
      if (isTeleport) return 0xffff00;
      return 0xe0b0ff;
    }

    if (isDeadly) {
      return parseInt(this.themeColors.damage.slice(1), 16);
    }

    if (isTeleport) {
      return parseInt(this.themeColors.teleport.slice(1), 16);
    }

    switch (blockType) {
      case 'box':
        return parseInt(this.themeColors.bhop.slice(1), 16);
      case 'ramp':
        return parseInt(this.themeColors.surf.slice(1), 16);
      default:
        return parseInt(this.themeColors.primary.slice(1), 16);
    }
  }
}
