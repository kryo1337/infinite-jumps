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
}

interface PlayerInput {
  forward: number;
  right: number;
  jump: boolean;
}

export class PlayerController {
  static readonly SPAWN_POSITION = { x: 0, y: 5, z: 0 };

  static readonly GROUND_ACCELERATION = 14.0;
  static readonly AIR_ACCELERATION = 200.0;
  static readonly GROUND_SPEED_LIMIT = 10.0;
  static readonly AIR_SPEED_LIMIT = 0.9;
  static readonly FRICTION = 6.0;
  static readonly JUMP_IMPULSE = 6.0;
  static readonly EYE_HEIGHT = 0.8;
  static readonly GROUND_CHECK_DISTANCE = 1.55;

  static readonly SENSITIVITY_SCALE = 0.0005;

  public camera: THREE.PerspectiveCamera;
  public domElement: HTMLElement;
  public world: RAPIER.World;
  public body!: RAPIER.RigidBody;
  public collider!: RAPIER.Collider;
  public config: PlayerConfig;

  private input: PlayerInput = { forward: 0, right: 0, jump: false };
  private keys = new Set<string>();

  private pitch: number = 0;
  private yaw: number = 0;

  private isGrounded: boolean = false;

  private _tempVec = new THREE.Vector3();
  private _tempVec2 = new THREE.Vector3();
  private _tempVec3 = new THREE.Vector3();
  private _ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });

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
  }

  private setupInput() {
    const keyMap: Record<string, string> = {
      keyw: 'forward', keys: 'backward', keya: 'left', keyd: 'right', space: 'jump',
    };

    document.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.code === 'KeyR') { this.respawn(); return; }
      const action = keyMap[e.code.toLowerCase()];
      if (action) this.keys.add(action);
    });

    document.addEventListener('keyup', (e: KeyboardEvent) => {
      const action = keyMap[e.code.toLowerCase()];
      if (action) this.keys.delete(action);
    });

    document.addEventListener('click', () => this.domElement.requestPointerLock());

    document.addEventListener('mousemove', (e: MouseEvent) => {
      if (document.pointerLockElement !== this.domElement) return;

      const scale = this.config.mouseSensitivity * PlayerController.SENSITIVITY_SCALE;
      this.yaw -= e.movementX * scale;
      this.pitch -= e.movementY * scale;
      this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch));
    });
  }

  public update(dt: number) {
    this.updateInputState();
    this.camera.quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));
    this.checkGrounded();

    if (this.body.translation().y < -20.0) {
      this.respawn();
      return;
    }

    const vel = this.body.linvel();

    const forward = this._tempVec.set(0, 0, -1).applyAxisAngle(this._tempVec3.set(0, 1, 0), this.yaw);
    const right = this._tempVec2.set(-1, 0, 0).applyAxisAngle(this._tempVec3.set(0, 1, 0), this.yaw);

    const wishDir = this._tempVec3.set(0, 0, 0)
      .addScaledVector(forward, this.input.forward)
      .addScaledVector(right, -this.input.right)
      .normalize();

    const hVel = { x: vel.x, z: vel.z };
    let vVel = vel.y;

    if (this.isGrounded) {
      const isJumping = this.input.jump && this.config.autoJump;
      if (!isJumping) this.applyFriction(hVel, dt);

      this.accelerate(hVel, wishDir, this.config.groundLimit, this.config.groundAcceleration, dt);

      if (isJumping) {
        vVel = this.config.jumpImpulse;
        this.isGrounded = false;
      }
    } else {
      this.accelerate(hVel, wishDir, this.config.airLimit, this.config.airAcceleration, dt);
    }

    this.body.setLinvel({ x: hVel.x, y: vVel, z: hVel.z }, true);
  }

  public syncCamera() {
    const pos = this.body.translation();
    this.camera.position.set(pos.x, pos.y + PlayerController.EYE_HEIGHT, pos.z);
  }

  public respawn() {
    this.body.setTranslation(PlayerController.SPAWN_POSITION, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    this.pitch = 0; this.yaw = 0;
    this.camera.quaternion.setFromEuler(new THREE.Euler(0, 0, 0, 'YXZ'));
    this.syncCamera();
  }

  private updateInputState() {
    this.input.forward = (this.keys.has('forward') ? 1 : 0) - (this.keys.has('backward') ? 1 : 0);
    this.input.right = (this.keys.has('right') ? 1 : 0) - (this.keys.has('left') ? 1 : 0);
    this.input.jump = this.keys.has('jump');
  }

  private checkGrounded() {
    const pos = this.body.translation();
    this._ray.origin.x = pos.x;
    this._ray.origin.y = pos.y;
    this._ray.origin.z = pos.z;

    const hit = this.world.castRay(
      this._ray,
      PlayerController.GROUND_CHECK_DISTANCE,
      true,
      undefined,
      undefined,
      this.collider
    );
    this.isGrounded = !!hit;
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
    const accelSpeed = Math.min(accel * dt * maxSpeed, addSpeed);
    vel.x += accelSpeed * wishDir.x;
    vel.z += accelSpeed * wishDir.z;
  }

  public setSensitivity(v: number) { this.config.mouseSensitivity = v; }
  public getSpeed(): number { const v = this.body.linvel(); return Math.sqrt(v.x * v.x + v.z * v.z); }
}
