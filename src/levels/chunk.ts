import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

export class Chunk {
  public type: string;
  public mesh: THREE.Object3D;
  public body: RAPIER.RigidBody;
  public collider: RAPIER.Collider;
  public isDeadly: boolean = false;
  public teleportOffset: THREE.Vector3 | null = null;
  public logicalId: number = -1;
  private scene: THREE.Scene;
  private world: RAPIER.World;
  private isModel: boolean = false;

  constructor(
    type: string,
    scene: THREE.Scene,
    world: RAPIER.World,
    geometry: THREE.BufferGeometry | null,
    material: THREE.Material | null,
    colliderDesc: RAPIER.ColliderDesc,
    model?: THREE.Object3D
  ) {
    this.type = type;
    this.scene = scene;
    this.world = world;

    if (model) {
      this.mesh = model;
      this.isModel = true;
    } else {
      if (!geometry || !material) {
        throw new Error('Chunk requires either a model or geometry+material');
      }
      this.mesh = new THREE.Mesh(geometry, material);
      this.isModel = false;
    }
    this.mesh.visible = false;

    const bodyDesc = RAPIER.RigidBodyDesc.fixed();
    this.body = this.world.createRigidBody(bodyDesc);
    this.body.setEnabled(false);

    this.collider = this.world.createCollider(colliderDesc, this.body);
  }

  public activate(
    pos: { x: number, y: number, z: number },
    rot: { x: number, y: number, z: number, w: number },
    color: number
  ) {
    this.isDeadly = false;
    this.teleportOffset = null;
    this.logicalId = -1;
    this.mesh.position.set(pos.x, pos.y, pos.z);
    this.mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);

    this.mesh.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => {
            if ((m as any).color) (m as any).color.setHex(color);
          });
        } else if (mesh.material && (mesh.material as any).color) {
          (mesh.material as any).color.setHex(color);
        }
      }
    });

    this.mesh.visible = true;
    this.scene.add(this.mesh);

    this.body.setTranslation(pos, true);
    this.body.setRotation(rot, true);
    this.body.setEnabled(true);
  }

  public deactivate() {
    this.body.setEnabled(false);
    this.mesh.visible = false;
    this.scene.remove(this.mesh);
  }

  public destroy() {
    this.deactivate();
    this.world.removeRigidBody(this.body);

    this.mesh.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;

        if (!this.isModel) {
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => m.dispose());
          } else if (mesh.material) {
            mesh.material.dispose();
          }
        }
      }
    });
  }
}



