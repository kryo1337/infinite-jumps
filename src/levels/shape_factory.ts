import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import RAPIER from '@dimforge/rapier3d-compat';

export class ShapeFactory {
  static createBox(width: number, height: number, depth: number): THREE.BoxGeometry {
    return new THREE.BoxGeometry(width, height, depth);
  }

  static createBoxCollider(width: number, height: number, depth: number): RAPIER.ColliderDesc {
    return RAPIER.ColliderDesc.cuboid(width / 2.0, height / 2.0, depth / 2.0);
  }

  static createRamp(width: number, height: number, depth: number): THREE.ExtrudeGeometry {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(width, 0);
    shape.lineTo(width, height);
    shape.closePath();

    const extrudeSettings = {
      depth: depth,
      bevelEnabled: false
    };

    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    geometry.center();
    return geometry;
  }

  static createRampCollider(width: number, height: number, depth: number): RAPIER.ColliderDesc {
    const vertices = new Float32Array([
      -width / 2, -height / 2, -depth / 2,
      width / 2, -height / 2, -depth / 2,
      width / 2, height / 2, -depth / 2,
      -width / 2, -height / 2, depth / 2,
      width / 2, -height / 2, depth / 2,
      width / 2, height / 2, depth / 2
    ]);

    return RAPIER.ColliderDesc.convexHull(vertices) as RAPIER.ColliderDesc;
  }

  static createCross(size: number, armWidth: number, thickness: number): THREE.BufferGeometry {
    // box1: Horizontal arm
    const box1 = new THREE.BoxGeometry(size, armWidth, thickness);
    // box2: Vertical arm
    const box2 = new THREE.BoxGeometry(armWidth, size, thickness);

    const merged = BufferGeometryUtils.mergeGeometries([box1, box2]);
    return merged;
  }

  static createCrossCollider(size: number, armWidth: number, thickness: number): RAPIER.ColliderDesc {
    const geometry = ShapeFactory.createCross(size, armWidth, thickness);
    const posAttribute = geometry.attributes.position;
    const vertices = posAttribute.array as Float32Array;
    const indices = geometry.index ? geometry.index.array as Uint32Array : undefined;

    let finalIndices: Uint32Array;
    if (indices) {
      finalIndices = indices;
    } else {
      const count = posAttribute.count;
      finalIndices = new Uint32Array(count);
      for (let i = 0; i < count; i++) finalIndices[i] = i;
    }

    geometry.dispose();

    return RAPIER.ColliderDesc.trimesh(vertices, finalIndices);
  }
}

