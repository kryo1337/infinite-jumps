import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import RAPIER from '@dimforge/rapier3d-compat';

export class ModelLoader {
  private static cache: Map<string, THREE.Group> = new Map();
  private static loader = new GLTFLoader();

  public static async load(path: string): Promise<THREE.Group> {
    if (this.cache.has(path)) {
      return this.cache.get(path)!.clone();
    }

    return new Promise((resolve, reject) => {
      this.loader.load(
        path,
        (gltf) => {
          const model = gltf.scene;

          const box = new THREE.Box3().setFromObject(model);
          const size = new THREE.Vector3();
          box.getSize(size);

          model.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });

          this.cache.set(path, model);
          resolve(model.clone());
        },
        undefined,
        (error) => {
          console.error(`An error occurred loading the model at ${path}:`, error);
          reject(error);
        }
      );
    });
  }

  public static add(path: string, model: THREE.Group) {
    this.cache.set(path, model);
  }

  public static get(path: string): THREE.Group | undefined {
    const model = this.cache.get(path);
    return model ? model.clone() : undefined;
  }

  public static createColliderFromModel(model: THREE.Object3D): RAPIER.ColliderDesc {
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);

    const collider = RAPIER.ColliderDesc.cuboid(size.x / 2, size.y / 2, size.z / 2);
    collider.setTranslation(center.x, center.y, center.z);

    return collider;
  }

  public static createTrimeshFromModel(model: THREE.Object3D): RAPIER.ColliderDesc | null {
    let vertices: number[] = [];
    let indices: number[] = [];

    model.updateMatrixWorld(true);

    model.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const geometry = mesh.geometry;
        const attr = geometry.attributes.position;
        const index = geometry.index;

        if (!attr) return;

        const offset = vertices.length / 3;

        for (let i = 0; i < attr.count; i++) {
          const v = new THREE.Vector3().fromBufferAttribute(attr, i);
          v.applyMatrix4(mesh.matrixWorld);
          vertices.push(v.x, v.y, v.z);
        }

        if (index) {
          for (let i = 0; i < index.count; i++) {
            indices.push(index.getX(i) + offset);
          }
        } else {
          for (let i = 0; i < attr.count; i++) {
            indices.push(i + offset);
          }
        }
      }
    });

    if (vertices.length === 0) return null;

    return RAPIER.ColliderDesc.trimesh(
      new Float32Array(vertices),
      new Uint32Array(indices)
    );
  }
}
