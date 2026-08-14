import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

export class Chunk {
  public type: string;
  public mesh: THREE.Object3D;
  public body: RAPIER.RigidBody;
  public colliders: RAPIER.Collider[] = [];
  public get collider(): RAPIER.Collider { return this.colliders[0]; }
  public isDeadly: boolean = false;
  public teleportOffset: THREE.Vector3 | null = null;
  public logicalId: number = -1;
  private scene: THREE.Scene;
  private world: RAPIER.World;
  private isModel: boolean = false;
  private ownedMaterials: THREE.Material[] = [];

  constructor(
    type: string,
    scene: THREE.Scene,
    world: RAPIER.World,
    geometry: THREE.BufferGeometry | null,
    material: THREE.Material | null,
    colliderDesc: RAPIER.ColliderDesc | RAPIER.ColliderDesc[],
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

    const descs = Array.isArray(colliderDesc) ? colliderDesc : [colliderDesc];
    descs.forEach(d => {
      this.colliders.push(this.world.createCollider(d, this.body));
    });
  }

  public activate(
    pos: { x: number, y: number, z: number },
    rot: { x: number, y: number, z: number, w: number },
    material: THREE.MeshStandardMaterial
  ) {
    this.isDeadly = false;
    this.teleportOffset = null;
    this.logicalId = -1;
    this.mesh.position.set(pos.x, pos.y, pos.z);
    this.mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);

    this.applyMaterial(material);

    this.mesh.visible = true;
    this.scene.add(this.mesh);

    this.body.setTranslation(pos, true);
    this.body.setRotation(rot, true);
    this.body.setEnabled(true);
  }

  public applyMaterial(material: THREE.MeshStandardMaterial) {
    if (this.isModel) {
      this.applyModelColor(material.color.getHex());
      return;
    }

    (this.mesh as THREE.Mesh).material = material;
  }

  private applyModelColor(color: number) {
    this.mesh.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh || !mesh.material) return;

      const wasArray = Array.isArray(mesh.material);
      const materials = (wasArray ? mesh.material as THREE.Material[] : [mesh.material as THREE.Material]).map((m) => {
        const owned = this.ownMaterial(m);
        if ((owned as any).color) (owned as any).color.setHex(color);
        return owned;
      });

      mesh.material = wasArray ? materials : materials[0];
    });
  }

  private ownMaterial(material: THREE.Material): THREE.Material {
    if (this.ownedMaterials.includes(material)) return material;

    const owned = material.clone();
    this.ownedMaterials.push(owned);
    return owned;
  }

  public deactivate() {
    this.body.setEnabled(false);
    this.mesh.visible = false;
    this.scene.remove(this.mesh);
  }

  public destroy() {
    this.deactivate();
    this.world.removeRigidBody(this.body);

    this.ownedMaterials.forEach(m => m.dispose());
    this.ownedMaterials = [];
  }
}



