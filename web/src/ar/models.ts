import type { Object3D } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

const loader = new GLTFLoader();

/** Loads a .glb and returns its scene graph. */
export async function loadModel(url: string): Promise<Object3D> {
  const gltf = await loader.loadAsync(url);
  return gltf.scene;
}
