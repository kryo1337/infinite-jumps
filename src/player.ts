import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';

export interface PlayerConfig {
  groundAcceleration: number;
  airAcceleration: number;
  groundLimit: number;
  airLimit: number;
  friction: number;
  jumpImpulse: number;
  mouseSensitivity: number;
  autoJump: boolean;
  keybindings?: { [action: string]: string[] };
}

interface PlayerInput {
  forward: number;
  right: number;
  jump: boolean;
}

export class PlayerController {
  static readonly SPAWN_POSITION = { x: 0, y: 3, z: 0 };

  static readonly GROUND_ACCELERATION = 14.0;
  static readonly AIR_ACCELERATION = 300.0;
  static readonly GROUND_SPEED_LIMIT = 10.0;
  static readonly AIR_SPEED_LIMIT = 1.5;
  static readonly FRICTION = 6.0;
  static readonly JUMP_IMPULSE = 6.0;
  static readonly EYE_HEIGHT = 0.8;
  static readonly GROUND_CHECK_DISTANCE = 1.55;
  static readonly SURF_MAX_ANGLE = Math.PI / 4;
  static readonly SURF_STICK_FORCE = 40.0;

  static readonly SENSITIVITY_SCALE = 0.0005;
  static readonly COLLISION_MASK_ALL = 0xffffffff;

  static readonly ACTIONS = {
    FORWARD: 'forward',
    BACKWARD: 'backward',
    LEFT: 'left',
    RIGHT: 'right',
    JUMP: 'jump'
  };

  public camera: THREE.PerspectiveCamera;
  public domElement: HTMLElement;
  public world: RAPIER.World;
  public body!: RAPIER.RigidBody;
  public collider!: RAPIER.Collider;
  public config: PlayerConfig;
  public groundColliderHandle: number | undefined;

  private input: PlayerInput = { forward: 0, right: 0, jump: false };
  private keys = new Set<string>();
  private transientActions = new Set<string>();
  private jumpQueued: boolean = false;
  private keybindings: { [action: string]: string[] };

  private pitch: number = 0;
  private yaw: number = 0;

  private isGrounded: boolean = false;
  private isSurfing: boolean = false;
  private surfNormal = new THREE.Vector3();

  private previousPosition = new THREE.Vector3();
  private smoothedPosition = new THREE.Vector3();

  private _tempVec = new THREE.Vector3();
  private _tempVec2 = new THREE.Vector3();
  private _tempVec3 = new THREE.Vector3();
  private _ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });

  private _euler = new THREE.Euler(0, 0, 0, 'YXZ');
  private _surfCheckShape = new RAPIER.Capsule(0.9, 0.45);
  private _downAxis = { x: 0, y: -1, z: 0 };
  private _identityRot = { x: 0, y: 0, z: 0, w: 1 };

  constructor(
    camera: THREE.PerspectiveCamera,
    domElement: HTMLElement,
    world: RAPIER.World,
    options: Partial<PlayerConfig> = {}
  ) {
    this.camera = camera;
    this.domElement = domElement;
    this.world = world;

    this.config = {
      groundAcceleration: options.groundAcceleration ?? PlayerController.GROUND_ACCELERATION,
      airAcceleration: options.airAcceleration ?? PlayerController.AIR_ACCELERATION,
      groundLimit: options.groundLimit ?? PlayerController.GROUND_SPEED_LIMIT,
      airLimit: options.airLimit ?? PlayerController.AIR_SPEED_LIMIT,
      friction: options.friction ?? PlayerController.FRICTION,
      jumpImpulse: options.jumpImpulse ?? PlayerController.JUMP_IMPULSE,
      mouseSensitivity: options.mouseSensitivity ?? 1.0,
      autoJump: options.autoJump ?? true,
    };
    this.keybindings = options.keybindings || {
      [PlayerController.ACTIONS.FORWARD]: ['KeyW'],
      [PlayerController.ACTIONS.BACKWARD]: ['KeyS'],
      [PlayerController.ACTIONS.LEFT]: ['KeyA'],
      [PlayerController.ACTIONS.RIGHT]: ['KeyD'],
      [PlayerController.ACTIONS.JUMP]: ['Space', 'WheelUp', 'WheelDown']
    };

    const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
    this.pitch = euler.x;
    this.yaw = euler.y;

    this.createPhysicsBody();
    this.setupInput();
  }

  private createPhysicsBody() {
    const bodyDesc = RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(
        PlayerController.SPAWN_POSITION.x,
        PlayerController.SPAWN_POSITION.y,
        PlayerController.SPAWN_POSITION.z
      )
      .setLinearDamping(0.0)
      .lockRotations();

    this.body = this.world.createRigidBody(bodyDesc);
    this.collider = this.world.createCollider(
      RAPIER.ColliderDesc.capsule(1.0, 0.5)
        .setFriction(0.0)
        .setFrictionCombineRule(RAPIER.CoefficientCombineRule.Min)
        .setRestitution(0.0),
      this.body
    );

    this.previousPosition.set(
      PlayerController.SPAWN_POSITION.x,
      PlayerController.SPAWN_POSITION.y,
      PlayerController.SPAWN_POSITION.z
    );
  }

  private setupInput() {
    document.addEventListener('keydown', (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      this.keys.add(e.code);

      if (this.isActionActive(PlayerController.ACTIONS.JUMP)) {
        this.jumpQueued = true;
      }
    });

    document.addEventListener('keyup', (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      this.keys.delete(e.code);
    });

    document.addEventListener('wheel', (e: WheelEvent) => {
      if (document.pointerLockElement !== this.domElement) return;
      const key = e.deltaY < 0 ? 'WheelUp' : 'WheelDown';

      for (const [action, keys] of Object.entries(this.keybindings)) {
        if (keys.includes(key)) {
          this.transientActions.add(action);
          if (action === PlayerController.ACTIONS.JUMP) {
            this.jumpQueued = true;
          }
        }
      }
    }, { passive: false });

    document.addEventListener('mousemove', (e: MouseEvent) => {
      if (document.pointerLockElement !== this.domElement) return;

      const scale = this.config.mouseSensitivity * PlayerController.SENSITIVITY_SCALE;
      this.yaw -= e.movementX * scale;
      this.pitch -= e.movementY * scale;
      this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch));
    });
  }

  public savePreviousPosition() {
    const pos = this.body.translation();
    this.previousPosition.set(pos.x, pos.y, pos.z);
  }

  public updatePhysics(dt: number) {
    this.updateInputState();
    this.scanSurroundings();

    const vel = this.body.linvel();

    const forward = this._tempVec.set(0, 0, -1).applyAxisAngle(this._tempVec3.set(0, 1, 0), this.yaw);
    const right = this._tempVec2.set(-1, 0, 0).applyAxisAngle(this._tempVec3.set(0, 1, 0), this.yaw);

    let wishDir = this._tempVec3.set(0, 0, 0)
      .addScaledVector(forward, this.input.forward)
      .addScaledVector(right, -this.input.right)
      .normalize();

    if (this.isSurfing) {
      const dot = wishDir.dot(this.surfNormal);
      wishDir.sub(this._tempVec.copy(this.surfNormal).multiplyScalar(dot)).normalize();

      this.accelerate(vel, wishDir, this.config.airLimit, this.config.airAcceleration, dt);

      const vDot = vel.x * this.surfNormal.x + vel.y * this.surfNormal.y + vel.z * this.surfNormal.z;
      if (vDot < 0) {
        const sx = this.surfNormal.x * vDot;
        const sy = this.surfNormal.y * vDot;
        const sz = this.surfNormal.z * vDot;
        vel.x -= sx;
        vel.y -= sy;
        vel.z -= sz;
      }

      const currentTotalSpeed = this._tempVec2.set(vel.x, vel.y, vel.z).length();
      if (currentTotalSpeed > 1.0) {
        const stickForceVec = this._tempVec.copy(this.surfNormal).multiplyScalar(-PlayerController.SURF_STICK_FORCE * dt);
        vel.x += stickForceVec.x;
        vel.y += stickForceVec.y;
        vel.z += stickForceVec.z;
      }

    } else if (this.isGrounded) {
      const isJumping = this.input.jump && this.config.autoJump;
      if (!isJumping) this.applyFriction(vel, dt);

      this.accelerate(vel, wishDir, this.config.groundLimit, this.config.groundAcceleration, dt);

      if (isJumping) {
        vel.y = this.config.jumpImpulse;
        this.isGrounded = false;
      }
    } else {
      this.accelerate(vel, wishDir, this.config.airLimit, this.config.airAcceleration, dt);
    }

    this.body.setLinvel(vel, true);
  }

  public updateVisuals(_dt: number) {
    this._euler.set(this.pitch, this.yaw, 0, 'YXZ');
    this.camera.quaternion.setFromEuler(this._euler);
  }

  public syncCamera(alpha: number) {
    const currentPos = this.body.translation();
    this._tempVec.set(currentPos.x, currentPos.y, currentPos.z);

    this.smoothedPosition.lerpVectors(this.previousPosition, this._tempVec, alpha);

    this.camera.position.set(
      this.smoothedPosition.x,
      this.smoothedPosition.y + PlayerController.EYE_HEIGHT,
      this.smoothedPosition.z
    );
  }

  public respawn() {
    this.body.setTranslation(PlayerController.SPAWN_POSITION, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.pitch = 0; this.yaw = Math.PI;

    this.previousPosition.set(
      PlayerController.SPAWN_POSITION.x,
      PlayerController.SPAWN_POSITION.y,
      PlayerController.SPAWN_POSITION.z
    );

    this.camera.quaternion.setFromEuler(new THREE.Euler(0, Math.PI, 0, 'YXZ'));
    this.syncCamera(1.0);
  }

  public teleport(pos: { x: number, y: number, z: number }) {
    this.body.setTranslation(pos, true);
    this.previousPosition.set(pos.x, pos.y, pos.z);
  }

  public setKeybindings(bindings: { [action: string]: string[] }) {
    this.keybindings = bindings;
  }

  private isActionActive(action: string): boolean {
    if (this.transientActions.has(action)) return true;
    const keys = this.keybindings[action];
    if (!keys) return false;
    for (const key of keys) {
      if (this.keys.has(key)) return true;
    }
    return false;
  }

  private updateInputState() {
    this.input.forward = (this.isActionActive(PlayerController.ACTIONS.FORWARD) ? 1 : 0) - (this.isActionActive(PlayerController.ACTIONS.BACKWARD) ? 1 : 0);
    this.input.right = (this.isActionActive(PlayerController.ACTIONS.RIGHT) ? 1 : 0) - (this.isActionActive(PlayerController.ACTIONS.LEFT) ? 1 : 0);
    this.input.jump = this.isActionActive(PlayerController.ACTIONS.JUMP) || this.jumpQueued;

    this.jumpQueued = false;
    this.transientActions.clear();
  }

  private scanSurroundings() {
    this.isGrounded = false;
    this.isSurfing = false;
    this.surfNormal.set(0, 0, 0);
    this.groundColliderHandle = undefined;

    const pos = this.body.translation();

    this._ray.origin.x = pos.x;
    this._ray.origin.y = pos.y;
    this._ray.origin.z = pos.z;
    this._ray.dir = this._downAxis;

    const rayHit = this.world.castRayAndGetNormal(
      this._ray,
      PlayerController.GROUND_CHECK_DISTANCE,
      true,
      undefined,
      undefined,
      undefined,
      this.body
    );

    if (rayHit) {
      const n = rayHit.normal;
      const slopeAngle = Math.acos(THREE.MathUtils.clamp(n.y, -1, 1));

      if (slopeAngle < PlayerController.SURF_MAX_ANGLE) {
        this.isGrounded = true;
        this.groundColliderHandle = rayHit.collider.handle;
        return;
      }
    }

    const shapeHit = this.world.castShape(
      pos,
      this._identityRot,
      this._downAxis,
      this._surfCheckShape,
      1.0,
      PlayerController.COLLISION_MASK_ALL,
      true,
      undefined,
      this.collider.handle
    );

    if (shapeHit) {
      const n = shapeHit.normal1;

      if (!n) return;

      if (Math.abs(n.x) < 0.0001 && Math.abs(n.y) < 0.0001 && Math.abs(n.z) < 0.0001) return;

      this.groundColliderHandle = shapeHit.collider.handle;

      const slopeAngle = Math.acos(THREE.MathUtils.clamp(n.y, -1, 1));

      if (slopeAngle >= PlayerController.SURF_MAX_ANGLE && slopeAngle < Math.PI / 2 + 0.1) {
        this.isSurfing = true;
        this.surfNormal.set(n.x, n.y, n.z);
      }
    }
  }

  private applyFriction(vel: { x: number, z: number }, dt: number) {
    const speed = Math.sqrt(vel.x * vel.x + vel.z * vel.z);
    if (speed < 0.001) return;
    const drop = Math.max(speed, 10.0) * this.config.friction * dt;
    const scale = Math.max(speed - drop, 0) / speed;
    vel.x *= scale; vel.z *= scale;
  }

  private accelerate(vel: { x: number, z: number }, wishDir: THREE.Vector3, maxSpeed: number, accel: number, dt: number) {
    const currentSpeed = vel.x * wishDir.x + vel.z * wishDir.z;
    const addSpeed = maxSpeed - currentSpeed;

    if (addSpeed <= 0) return;

    let accelSpeed = accel * dt * maxSpeed;

    if (accelSpeed > addSpeed) {
      accelSpeed = addSpeed;
    }

    vel.x += accelSpeed * wishDir.x;
    vel.z += accelSpeed * wishDir.z;
  }

  public setSensitivity(v: number) { this.config.mouseSensitivity = v; }
  public getSpeed(): number { const v = this.body.linvel(); return Math.sqrt(v.x * v.x + v.z * v.z); }
}
