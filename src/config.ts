export interface BlockType {
  type: 'box' | 'ramp' | 'down_ramp' | 'cross' | 'damage' | 'teleport';
  probability: number;
  color: number;
  size?: [number, number, number];
  length?: number;
  extraParams?: any;
  spacingMult?: number;
}

const COLORS = {
  DAMAGE: 0xff0000,
  THEME: 0xe0b0ff,
  TELEPORT: 0xffff00
};

export const GAME_CONFIG = {
  World: {
    initialLevel: 'infinite' as const,
    fov: 90,
    defaultSensitivity: 1.0,
    gravity: { x: 0.0, y: -16.0, z: 0.0 },
    deathThreshold: -10.0,
    skyboxPath: '/textures/skybox/DayInTheClouds4k.hdr',
    physicsStep: 1 / 60
  },
  Player: {
    GROUND_ACCELERATION: 14.0,
    AIR_ACCELERATION: 300.0,
    GROUND_SPEED_LIMIT: 10.0,
    AIR_SPEED_LIMIT: 1.5,
    FRICTION: 6.0,
    JUMP_IMPULSE: 6.0,
    EYE_HEIGHT: 0.8,
    GROUND_CHECK_DISTANCE: 1.55,
    SURF_MAX_ANGLE: Math.PI / 4,
    SURF_STICK_FORCE: 40.0,
    SENSITIVITY_SCALE: 0.0005
  },
  Level: {
    SPACING_BASE: 5.0,
    SPACING_SPEED_FACTOR: 5.0,
    X_SPREAD: 10.0,
    Y_OFFSET: 0,
    COLORS,
    BLOCK_TYPES: [
      { type: 'box', probability: 0.7, color: COLORS.THEME, size: [3, 1, 3] },
      { type: 'teleport', probability: 0.05, color: COLORS.TELEPORT, size: [15, 1, 3] },
      { type: 'damage', probability: 0.05, color: COLORS.DAMAGE, size: [3, 1, 3] },
      { type: 'cross', probability: 0.05, color: COLORS.THEME, size: [6, 6, 0.5], length: 6, extraParams: { armWidth: 1 } },
      { type: 'ramp', probability: 0.15, color: COLORS.THEME, size: [4, 5, 12], spacingMult: 1.5 },
      // { type: 'down_ramp', probability: 0.00, color: COLORS.THEME, size: [9, 22, 27], length: 60, spacingMult: -1, extraParams: { modelPath: '/models/rampdown.glb' } }
    ] as BlockType[]
  }
};
