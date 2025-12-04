import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { Chunk } from './chunk';
import { ShapeFactory } from './shape_factory';

export class ChunkManager {
  private scene: THREE.Scene;
  private world: RAPIER.World;

  private pools: Map<string, Chunk[]> = new Map();

  private geometryCache: Map<string, THREE.BufferGeometry> = new Map();

  constructor(scene: THREE.Scene, world: RAPIER.World) {
    this.scene = scene;
    this.world = world;
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
      let geometry = this.geometryCache.get(key);
      let colliderDesc: RAPIER.ColliderDesc;

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
            colliderDesc = ShapeFactory.createCrossCollider(size[0], armW, thickness);
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
            colliderDesc = ShapeFactory.createCrossCollider(size[0], armW, thickness);
            break;
          default:
            colliderDesc = ShapeFactory.createBoxCollider(size[0], size[1], size[2]);
        }
      }

      const material = new THREE.MeshStandardMaterial();
      chunk = new Chunk(key, this.scene, this.world, geometry, material, colliderDesc);
    }

    chunk.activate(pos, rot, color);
    return chunk;
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
  }
}
