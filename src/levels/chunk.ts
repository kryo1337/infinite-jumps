import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

export class Chunk {
  public type: string;
  public mesh: THREE.Mesh;
  public body: RAPIER.RigidBody;
  public collider: RAPIER.Collider;
  private scene: THREE.Scene;
  private world: RAPIER.World;

  constructor(
    type: string,
    scene: THREE.Scene,
    world: RAPIER.World,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    colliderDesc: RAPIER.ColliderDesc
  ) {
    this.type = type;
    this.scene = scene;
    this.world = world;

    this.mesh = new THREE.Mesh(geometry, material);
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
    this.mesh.position.set(pos.x, pos.y, pos.z);
    this.mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);

    if (Array.isArray(this.mesh.material)) {
      this.mesh.material.forEach((m) => {
        if (m instanceof THREE.MeshStandardMaterial) m.color.setHex(color);
      });
    } else if (this.mesh.material instanceof THREE.MeshStandardMaterial) {
      this.mesh.material.color.setHex(color);
    }

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

    if (Array.isArray(this.mesh.material)) {
      this.mesh.material.forEach(m => m.dispose());
    } else if (this.mesh.material) {
      this.mesh.material.dispose();
    }
  }
}



