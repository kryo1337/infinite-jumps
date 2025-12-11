import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { ModelLoader } from './model_loader';

export class GameLoader {
  private manager: THREE.LoadingManager;
  private scene: THREE.Scene;
  private currentSkyboxPath: string = '';

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.manager = new THREE.LoadingManager();
  }

  public checkHardwareAcceleration(renderer: THREE.WebGLRenderer): boolean {
    const context = renderer.getContext();
    const rendererString = context.getParameter(context.RENDERER);

    if (!rendererString) {
      return true;
    }

    if (
      rendererString.includes('SwiftShader') ||
      rendererString.includes('llvmpipe') ||
      rendererString.includes('Microsoft Basic Render')
    ) {
      return false;
    }

    return true;
  }

  public load(
    skyboxPath: string,
    onLoad: () => void,
    onProgress: (item: string, percent: number) => void
  ) {
    this.manager.onLoad = onLoad;

    this.manager.onProgress = (url, itemsLoaded, itemsTotal) => {
      const percent = (itemsLoaded / itemsTotal) * 100;
      const parts = url.split('/');
      const filename = parts[parts.length - 1];
      onProgress(filename, percent);
    };

    this.loadSkybox(skyboxPath);
    this.loadRampModel();
  }

  private loadSkybox(path: string) {
    this.loadSkyboxFromPath(path, this.manager);
  }

  public loadSkyboxFromPath(path: string, manager?: THREE.LoadingManager): void {
    if (path === this.currentSkyboxPath) {
      return;
    }

    const loader = manager ? new HDRLoader(manager) : new HDRLoader();

    loader.load(
      path,
      (texture) => {
        if (this.scene.background && (this.scene.background as THREE.Texture).isTexture) {
          (this.scene.background as THREE.Texture).dispose();
        }

        texture.mapping = THREE.EquirectangularReflectionMapping;
        this.scene.background = texture;
        this.scene.environment = texture;
        this.currentSkyboxPath = path;
      },
      undefined,
      (error) => {
        console.error('An error occurred loading the skybox:', error);
        this.scene.background = new THREE.Color(0x87CEEB);
        this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
      }
    );
  }

  public getCurrentSkyboxPath(): string {
    return this.currentSkyboxPath;
  }

  private loadRampModel() {
    const modelPath = '/models/rampdown.glb';
    new GLTFLoader(this.manager).load(
      modelPath,
      (gltf) => {
        const model = gltf.scene;

        model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });

        ModelLoader.add(modelPath, model);
      },
      undefined,
      (error) => {
        console.error('An error occurred loading the ramp model:', error);
      }
    );
  }
}
