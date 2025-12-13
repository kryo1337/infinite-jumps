export interface BlockType {
  type: 'box' | 'ramp' | 'down_ramp' | 'cross' | 'damage' | 'teleport';
  probability?: number;
  color: number;
  size?: [number, number, number];
  length?: number;
  extraParams?: any;
  spacingMult?: number;
}

export interface ThemeColors {
  primary: string;
  bhop: string;
  surf: string;
  teleport: string;
  damage: string;
  crosshairOutline: string;
  crosshairInner: string;
}

export interface Theme {
  id?: string;
  name: string;
  authorUid: string;
  author?: string;
  skyboxPath: string;
  colors: ThemeColors;
}

export const DEFAULT_THEME: Theme = {
  name: 'Default',
  authorUid: 'system',
  skyboxPath: '/textures/skybox/DayInTheClouds4k.hdr',
  colors: {
    primary: '#e0b0ff',
    bhop: '#e0b0ff',
    surf: '#e0b0ff',
    teleport: '#ffff00',
    damage: '#ff0000',
    crosshairOutline: '#000000',
    crosshairInner: '#ffffff'
  }
};

export const SKYBOX_OPTIONS = [
  'AmbienceExposure4k.hdr',
  'CasualDay4K.hdr',
  'CloudedSunGlow4k.hdr',
  'Cloudymorning4k.hdr',
  'CoriolisNight4k.hdr',
  'DarkStorm4K.hdr',
  'DayInTheClouds4k.hdr',
  'HighFantasy4k.hdr',
  'PlanetaryEarth4k.hdr',
  'SkyhighFluffycloudField4k.hdr',
  'SunlessCirruscover4k.hdr',
  'UnderTheSea4k.hdr',
  'UnearthlyRed4k.hdr'
];

const COLORS = {
  DAMAGE: 0xff0000,
  THEME: 0xe0b0ff,
  TELEPORT: 0xffff00
};

export const GAME_STATE = {
  currentMode: 'bhop_surf',
  currentDifficulty: 'normal'
};

export const DIFFICULTY_SETTINGS = {
  easy: { sizeMult: 1.5, spacingMult: 0.5, speedSpacingMult: 0.1, distSpacingMult: 0.0 },
  normal: { sizeMult: 1.0, spacingMult: 1.0, speedSpacingMult: 0.2, distSpacingMult: 0.002 },
  hard: { sizeMult: 0.6, spacingMult: 1.5, speedSpacingMult: 0.3, distSpacingMult: 0.004 }
};

export const MODE_DIFFICULTY_OVERRIDES: { [mode: string]: { [difficulty: string]: Partial<typeof DIFFICULTY_SETTINGS.normal> } } = {
  'only_surf': {
    'hard': { spacingMult: 1.1 }
  }
};

export const MODE_SETTINGS: { [key: string]: string[] } = {
  'only_bhop': ['box'],
  'only_surf': ['ramp'],
  'bhop_surf': ['box', 'ramp'],
  'obstacles': ['box', 'ramp', 'cross', 'damage', 'teleport']
};

export const MODE_DISPLAY_NAMES: { [key: string]: string } = {
  'only_bhop': 'Only Bhop',
  'only_surf': 'Only Surf',
  'bhop_surf': 'Bhop & Surf',
  'obstacles': 'Obstacles'
};

export const DIFFICULTY_DISPLAY_NAMES: { [key: string]: string } = {
  'easy': 'Easy',
  'normal': 'Normal',
  'hard': 'Hard'
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
    FIXED_FIRST_GAP: {
      'only_surf': 6.0
    } as { [key: string]: number },
    COLORS,
    PROBABILITY_SETTINGS: {
      'only_bhop': {
        'easy': { 'box': 1.0 },
        'normal': { 'box': 1.0 },
        'hard': { 'box': 1.0 }
      },
      'only_surf': {
        'easy': { 'ramp': 1.0 },
        'normal': { 'ramp': 1.0 },
        'hard': { 'ramp': 1.0 }
      },
      'bhop_surf': {
        'easy': { 'box': 0.8, 'ramp': 0.2 },
        'normal': { 'box': 0.8, 'ramp': 0.2 },
        'hard': { 'box': 0.8, 'ramp': 0.2 }
      },
      'obstacles': {
        'normal': { 'box': 0.65, 'ramp': 0.2, 'damage': 0.05, 'cross': 0.05, 'teleport': 0.05 }
      }
    } as { [mode: string]: { [diff: string]: { [type: string]: number } } },
    BLOCK_TYPES: [
      { type: 'box', color: COLORS.THEME, size: [3, 1, 3] },
      { type: 'teleport', color: COLORS.TELEPORT, size: [15, 1, 3] },
      { type: 'damage', color: COLORS.DAMAGE, size: [3, 1, 3] },
      { type: 'cross', color: COLORS.THEME, size: [6, 6, 0.5], length: 6, extraParams: { armWidth: 1 } },
      { type: 'ramp', color: COLORS.THEME, size: [4, 5, 12], spacingMult: 1.5 },
      // { type: 'down_ramp', color: COLORS.THEME, size: [9, 22, 27], length: 60, spacingMult: -1, extraParams: { modelPath: '/models/rampdown.glb' } }
    ] as BlockType[]
  }
};
