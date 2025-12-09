import * as THREE from 'three';

export enum GameState {
  TREE = 'TREE',
  SCATTER = 'SCATTER',
  ZOOM = 'ZOOM'
}

export interface GestureData {
  isHandPresent: boolean;
  isFist: boolean;
  isPinch: boolean;
  isOpen: boolean;
  position: { x: number; y: number };
}

export interface JewelData {
  treePos: THREE.Vector3;
  scatterPos: THREE.Vector3;
  currentPos: THREE.Vector3;
  scale: number;
  rotSpeed: THREE.Euler;
  rotation: THREE.Euler;
}

export interface PhotoData {
  mesh: THREE.Mesh;
  treePos: THREE.Vector3;
  scatterPos: THREE.Vector3;
  baseRot: THREE.Euler;
}
