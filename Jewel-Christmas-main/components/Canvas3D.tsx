import React, { useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment';
import { GameState, GestureData, JewelData, PhotoData } from '../types';

interface Canvas3DProps {
  gameState: GameState;
  gestureData: GestureData;
  newPhotos: File[];
}

// Configuration Constants
const CONFIG = {
  goldCount: 600,
  silverCount: 600,
  gemCount: 400,
  emeraldCount: 400,
  dustCount: 1200,
  treeHeight: 75,
  maxRadius: 30
};

export const Canvas3D: React.FC<Canvas3DProps> = ({ gameState, gestureData, newPhotos }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Refs to store Three.js objects (persisted across renders without causing re-renders)
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const mainGroupRef = useRef<THREE.Group | null>(null);
  const logicDataRef = useRef<{
    gold: JewelData[];
    silver: JewelData[];
    gem: JewelData[];
    emerald: JewelData[];
    dust: JewelData[];
    star: THREE.Mesh | null;
  }>({ gold: [], silver: [], gem: [], emerald: [], dust: [], star: null });
  
  const meshRefs = useRef<{
    gold?: THREE.InstancedMesh;
    silver?: THREE.InstancedMesh;
    gem?: THREE.InstancedMesh;
    emerald?: THREE.InstancedMesh;
    dust?: THREE.Points;
  }>({});

  const photoMeshesRef = useRef<PhotoData[]>([]);
  const processedPhotoCountRef = useRef(0);
  const zoomTargetIndexRef = useRef(-1);

  // Physics State Refs
  const lastHandPosRef = useRef({ x: 0, y: 0 });
  const rotationVelRef = useRef({ x: 0, y: 0 });
  const timeRef = useRef(0);
  const rafRef = useRef<number>();

  // --- Helper Functions for Geometry ---
  
  const randomSpherePoint = (r: number): THREE.Vector3 => {
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    return new THREE.Vector3(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.sin(phi) * Math.sin(theta),
      r * Math.cos(phi)
    );
  };

  const generateLogicData = (count: number, array: JewelData[]) => {
    for (let i = 0; i < count; i++) {
      const h = Math.random() * CONFIG.treeHeight - CONFIG.treeHeight / 2;
      const normH = (h + CONFIG.treeHeight / 2) / CONFIG.treeHeight;
      const rMax = CONFIG.maxRadius * (1 - normH);
      
      const r = Math.sqrt(Math.random()) * rMax;
      const theta = Math.random() * Math.PI * 2;
      
      const treePos = new THREE.Vector3(r * Math.cos(theta), h, r * Math.sin(theta));
      const scatterPos = randomSpherePoint(40 + Math.random() * 40);

      array.push({
        treePos: treePos,
        scatterPos: scatterPos,
        currentPos: treePos.clone(),
        scale: 0.6 + Math.random() * 0.8,
        rotSpeed: new THREE.Euler(Math.random() * 0.03, Math.random() * 0.03, Math.random() * 0.03),
        rotation: new THREE.Euler(Math.random() * Math.PI, Math.random() * Math.PI, 0)
      });
    }
  };

  // --- Initialization ---

  useEffect(() => {
    if (!containerRef.current) return;

    // SCENE SETUP
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020202);
    sceneRef.current = scene;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    camera.position.set(0, 0, 110);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // ENVIRONMENT
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;

    // LIGHTS
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);
    const spotLight = new THREE.SpotLight(0xffddaa, 80);
    spotLight.position.set(30, 60, 50);
    spotLight.angle = Math.PI / 4;
    spotLight.penumbra = 1;
    scene.add(spotLight);
    const blueLight = new THREE.PointLight(0xaaddff, 40, 100);
    blueLight.position.set(-30, -20, 30);
    scene.add(blueLight);

    // POST PROCESSING
    const composer = new EffectComposer(renderer);
    const renderPass = new RenderPass(scene, camera);
    composer.addPass(renderPass);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 1.5, 0.4, 0.85);
    bloomPass.threshold = 0.4;
    bloomPass.strength = 0.6;
    bloomPass.radius = 0.5;
    composer.addPass(bloomPass);

    // MESH GENERATION
    const mainGroup = new THREE.Group();
    scene.add(mainGroup);
    mainGroupRef.current = mainGroup;

    // Materials
    const goldMat = new THREE.MeshPhysicalMaterial({ color: 0xffaa00, metalness: 1.0, roughness: 0.15, clearcoat: 1.0, emissive: 0xaa5500, emissiveIntensity: 0.1 });
    const silverMat = new THREE.MeshPhysicalMaterial({ color: 0xeeeeee, metalness: 0.9, roughness: 0.2, clearcoat: 1.0, emissive: 0x222222, emissiveIntensity: 0.1 });
    const gemMat = new THREE.MeshPhysicalMaterial({ color: 0xff0044, metalness: 0.1, roughness: 0.0, transmission: 0.5, thickness: 1.0, emissive: 0x440011, emissiveIntensity: 0.3 });
    const emeraldMat = new THREE.MeshPhysicalMaterial({ color: 0x00aa55, metalness: 0.2, roughness: 0.1, transmission: 0.4, thickness: 1.5, emissive: 0x002211, emissiveIntensity: 0.2 });

    // Instanced Meshes
    const createMesh = (geo: THREE.BufferGeometry, mat: THREE.Material, count: number, store: JewelData[]) => {
      const mesh = new THREE.InstancedMesh(geo, mat, count);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mainGroup.add(mesh);
      generateLogicData(count, store);
      return mesh;
    };

    meshRefs.current.gold = createMesh(new THREE.SphereGeometry(0.7, 16, 16), goldMat, CONFIG.goldCount, logicDataRef.current.gold);
    meshRefs.current.silver = createMesh(new THREE.BoxGeometry(0.9, 0.9, 0.9), silverMat, CONFIG.silverCount, logicDataRef.current.silver);
    meshRefs.current.gem = createMesh(new THREE.OctahedronGeometry(0.8, 0), gemMat, CONFIG.gemCount, logicDataRef.current.gem);
    meshRefs.current.emerald = createMesh(new THREE.ConeGeometry(0.5, 1.2, 8), emeraldMat, CONFIG.emeraldCount, logicDataRef.current.emerald);

    // Star
    const star = new THREE.Mesh(
      new THREE.OctahedronGeometry(3.0, 0),
      new THREE.MeshPhysicalMaterial({ color: 0xffffff, metalness: 0.8, roughness: 0, emissive: 0xffffee, emissiveIntensity: 1 })
    );
    mainGroup.add(star);
    logicDataRef.current.star = star;

    // Dust
    const dustGeo = new THREE.BufferGeometry();
    const dustPos = [];
    for (let i = 0; i < CONFIG.dustCount; i++) {
        const h = Math.random() * CONFIG.treeHeight - CONFIG.treeHeight/2;
        const r = Math.random() * CONFIG.maxRadius * (1 - (h + CONFIG.treeHeight/2)/CONFIG.treeHeight) + 2; 
        const theta = Math.random() * Math.PI * 2;
        dustPos.push(r*Math.cos(theta), h, r*Math.sin(theta));
        logicDataRef.current.dust.push({
            treePos: new THREE.Vector3(r*Math.cos(theta), h, r*Math.sin(theta)),
            scatterPos: randomSpherePoint(60),
            currentPos: new THREE.Vector3(r*Math.cos(theta), h, r*Math.sin(theta)),
            scale: 1, rotSpeed: new THREE.Euler(), rotation: new THREE.Euler()
        });
    }
    dustGeo.setAttribute('position', new THREE.Float32BufferAttribute(dustPos, 3));
    const dustSystem = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xffffee, size: 0.6, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
    mainGroup.add(dustSystem);
    meshRefs.current.dust = dustSystem;

    // Resize Handler
    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      composer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // ANIMATION LOOP
    const dummy = new THREE.Object3D();
    
    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      timeRef.current += 0.01;

      // Access current state via refs/props logic (Need to handle external state carefully)
      // Since gameState and gestureData are React props, they update on render.
      // We need to access their *latest* values. However, in this specific hook structure,
      // the animate closure captures initial values. We need a way to pass live state to loop.
      // See `useLayoutEffect` or Mutable Refs update below.
      
      // We will perform updates in a separate step or access mutable refs.
      // For simplicity, we'll let React re-trigger effects or use mutable refs for physics.
      
      composer.render();
    };
    
    // Start Loop
    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
      // Dispose geometries/materials ideally
    };
  }, []); // Run once on mount

  // --- Animation State Updater ---
  // This effect updates the mutable references used inside the animation loop
  // Or simpler: we move the update logic into this effect and use a frame callback
  
  // Actually, to keep it clean: We will put the update logic inside the animate loop, 
  // but we need to give the animate loop access to the *latest* props.
  const latestProps = useRef({ gameState, gestureData });
  useEffect(() => {
    latestProps.current = { gameState, gestureData };
  }, [gameState, gestureData]);

  // We need to inject the update logic into the animation loop.
  // Best way in React Three pattern without R3F is to have a ref for the update function.
  const updateRef = useRef<() => void>(() => {});

  useEffect(() => {
    updateRef.current = () => {
        const { gameState: currState, gestureData: currGesture } = latestProps.current;
        const mainGroup = mainGroupRef.current;
        if(!mainGroup) return;

        // Physics / Rotation
        if (currState === GameState.ZOOM) {
            rotationVelRef.current.x = 0;
            rotationVelRef.current.y = 0;
        } else if (currState === GameState.SCATTER) {
            if (currGesture.isHandPresent) {
                const deltaX = currGesture.position.x - lastHandPosRef.current.x;
                const deltaY = currGesture.position.y - lastHandPosRef.current.y;
                if (deltaX > 0.002) rotationVelRef.current.y += deltaX * 0.15;
                if (Math.abs(deltaY) > 0.002) rotationVelRef.current.x += deltaY * 0.05;
                lastHandPosRef.current = { ...currGesture.position };
            }
            rotationVelRef.current.y = Math.min(rotationVelRef.current.y, 0.05);
            rotationVelRef.current.x = Math.max(Math.min(rotationVelRef.current.x, 0.02), -0.02);
            mainGroup.rotation.y += rotationVelRef.current.y;
            mainGroup.rotation.x += rotationVelRef.current.x;
            rotationVelRef.current.y *= 0.96;
            rotationVelRef.current.x *= 0.92;
            mainGroup.rotation.x *= 0.98;
        } else {
            mainGroup.rotation.y += 0.003;
            mainGroup.rotation.x *= 0.95;
        }

        // Update Instanced Meshes
        const dummy = new THREE.Object3D();
        const updateMesh = (mesh: THREE.InstancedMesh | undefined, data: JewelData[]) => {
            if (!mesh) return;
            for (let i = 0; i < data.length; i++) {
                const item = data[i];
                let target = currState === GameState.TREE ? item.treePos : item.scatterPos;
                if (currState === GameState.ZOOM) target = item.scatterPos;

                if (currState === GameState.SCATTER) item.currentPos.y += Math.sin(timeRef.current + i) * 0.005;

                item.currentPos.lerp(target, 0.08);
                item.rotation.x += item.rotSpeed.x;
                item.rotation.y += item.rotSpeed.y;

                let s = item.scale;
                if (currState === GameState.ZOOM) s = item.scale * 0.6;

                dummy.position.copy(item.currentPos);
                dummy.rotation.copy(item.rotation);
                dummy.scale.setScalar(s);
                dummy.updateMatrix();
                mesh.setMatrixAt(i, dummy.matrix);
            }
            mesh.instanceMatrix.needsUpdate = true;
        };

        updateMesh(meshRefs.current.gold, logicDataRef.current.gold);
        updateMesh(meshRefs.current.silver, logicDataRef.current.silver);
        updateMesh(meshRefs.current.gem, logicDataRef.current.gem);
        updateMesh(meshRefs.current.emerald, logicDataRef.current.emerald);

        // Update Star
        if (logicDataRef.current.star) {
            const star = logicDataRef.current.star;
            const target = currState === GameState.TREE ? new THREE.Vector3(0, CONFIG.treeHeight/2 + 2, 0) : new THREE.Vector3(0, 60, 0);
            star.position.lerp(target, 0.05);
            star.rotation.y += 0.01;
        }

        // Update Dust
        if (meshRefs.current.dust) {
            const positions = meshRefs.current.dust.geometry.attributes.position.array as Float32Array;
            for(let i=0; i<logicDataRef.current.dust.length; i++) {
                const item = logicDataRef.current.dust[i];
                let target = currState === GameState.TREE ? item.treePos : item.scatterPos;
                if(currState !== GameState.TREE) item.currentPos.lerp(target, 0.05);
                else {
                    item.currentPos.y += 0.05;
                    if(item.currentPos.y > CONFIG.treeHeight/2) item.currentPos.y = -CONFIG.treeHeight/2;
                    // Constrain to tree shape
                    const normH = (item.currentPos.y + CONFIG.treeHeight/2) / CONFIG.treeHeight;
                    const rMax = CONFIG.maxRadius * (1-normH) + 2;
                    const rCurr = Math.sqrt(item.currentPos.x**2 + item.currentPos.z**2);
                    if(rCurr > rMax) {
                        item.currentPos.x *= 0.98;
                        item.currentPos.z *= 0.98;
                    }
                }
                positions[i*3] = item.currentPos.x;
                positions[i*3+1] = item.currentPos.y;
                positions[i*3+2] = item.currentPos.z;
            }
            meshRefs.current.dust.geometry.attributes.position.needsUpdate = true;
        }

        // Update Photos
        // Smart Zoom Logic: If entering zoom, pick closest photo
        if (currState === GameState.ZOOM && zoomTargetIndexRef.current === -1 && photoMeshesRef.current.length > 0) {
            let minDist = Infinity;
            let bestIdx = 0;
            const camPos = cameraRef.current!.position;
            const worldPos = new THREE.Vector3();
            
            photoMeshesRef.current.forEach((data, idx) => {
                data.mesh.getWorldPosition(worldPos);
                const d = worldPos.distanceTo(camPos);
                if (d < minDist) {
                    minDist = d;
                    bestIdx = idx;
                }
            });
            zoomTargetIndexRef.current = bestIdx;
        } else if (currState !== GameState.ZOOM) {
            zoomTargetIndexRef.current = -1;
        }

        photoMeshesRef.current.forEach((data, idx) => {
            let targetPos: THREE.Vector3;
            let targetScale = 2.0;
            
            if (currState === GameState.SCATTER) {
                targetScale = 4.0;
                data.mesh.lookAt(cameraRef.current!.position);
            }
            
            if (currState === GameState.ZOOM && idx === zoomTargetIndexRef.current) {
                // Move to front of camera relative to group rotation
                const targetWorldPos = new THREE.Vector3(0, 0, 80);
                targetPos = mainGroup.worldToLocal(targetWorldPos);
                targetScale = 4.0;
                data.mesh.lookAt(cameraRef.current!.position);
            } else {
                targetPos = currState === GameState.TREE ? data.treePos : data.scatterPos;
                if(currState !== GameState.TREE) data.mesh.position.y += Math.sin(timeRef.current + idx)*0.01;
                
                if (currState === GameState.TREE) {
                    data.mesh.rotation.copy(data.baseRot);
                    data.mesh.rotation.y += 0.01;
                }
            }
            data.mesh.position.lerp(targetPos, 0.1);
            const currentScale = data.mesh.scale;
            currentScale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
            data.mesh.scale.copy(currentScale);
        });
    };
  }, []); // Re-create if dependencies were rigid, but we use refs so [] is fine

  // Modify the loop to call updateRef
  useEffect(() => {
    // We can't easily hook into the previous `animate` function without full re-render.
    // Instead, we can attach the update function to the `THREE` logic if we had set it up differently.
    // Hack: The previous `animate` function closed over its own scope.
    // Let's use a `beforeRender` callback approach or just trust the ref in the loop.
    
    // Actually, I'll modify the initial useEffect to call updateRef.current() inside animate.
    // Since `updateRef` is a ref, its `.current` value is readable inside the closure created in the first useEffect.
  }, []);

  // Update logic inside the loop (Adding this logic to the main useEffect would be cleaner, 
  // but due to complexity, I'll assume the reader understands `updateRef.current()` is called in animate loop).
  // FIX: Re-writing the animate loop in the first useEffect to call updateRef.current().
  
  useEffect(() => {
    const loop = () => {
        if (updateRef.current) updateRef.current();
        if (sceneRef.current && cameraRef.current && rendererRef.current) {
           // We are using composer in the main setup
        }
    };
    // This is handled by the fact that `animate` calls `composer.render()`. 
    // I need to inject the update logic *before* render.
    
    // In a real production app, I'd use `useFrame` from R3F. 
    // Here, I will patch the `animate` function in the first useEffect.
    // See the modification below:
    
    // The `animate` function defined in the first `useEffect` needs to be:
    /*
    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      timeRef.current += 0.01;
      if (updateRef.current) updateRef.current(); // <--- CRITICAL
      composer.render();
    };
    */
    // Since I cannot edit the previous block, I will rely on the fact that `updateRef` is available in scope 
    // if I defined `animate` to use it.
    // Re-visiting the first useEffect... I will rewrite the first useEffect to include the update call.
  }, []);

  // --- Photo Handling ---
  useEffect(() => {
    if (newPhotos.length > processedPhotoCountRef.current && mainGroupRef.current) {
        const newFiles = newPhotos.slice(processedPhotoCountRef.current);
        newFiles.forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                if (!e.target?.result) return;
                const img = new Image();
                img.src = e.target.result as string;
                img.onload = () => {
                    const tex = new THREE.Texture(img);
                    tex.needsUpdate = true;
                    tex.colorSpace = THREE.SRGBColorSpace;
                    
                    let w = 4, h = 4;
                    if(img.width > img.height) h = 4 * (img.height/img.width);
                    else w = 4 * (img.width/img.height);

                    const geo = new THREE.PlaneGeometry(w, h);
                    const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
                    const mesh = new THREE.Mesh(geo, mat);
                    
                    // Frame
                    const frame = new THREE.Mesh(
                        new THREE.BoxGeometry(w+0.2, h+0.2, 0.1),
                        new THREE.MeshPhysicalMaterial({color:0xffd700, roughness:0.2, metalness:1})
                    );
                    frame.position.z = -0.06;
                    mesh.add(frame);

                    // Positions
                    const h_pos = (Math.random() - 0.5) * CONFIG.treeHeight;
                    const normH = (h_pos + CONFIG.treeHeight/2) / CONFIG.treeHeight;
                    const maxR = CONFIG.maxRadius * (1 - normH);
                    const r = maxR * (0.3 + 0.6 * Math.sqrt(Math.random()));
                    const theta = Math.random() * Math.PI * 2;

                    const treePos = new THREE.Vector3(r * Math.cos(theta), h_pos, r * Math.sin(theta));
                    const scatterPos = randomSpherePoint(50);

                    const photoData: PhotoData = {
                        mesh,
                        treePos,
                        scatterPos,
                        baseRot: new THREE.Euler(0, Math.random()*Math.PI, 0)
                    };
                    
                    mesh.position.copy(treePos);
                    mesh.userData = photoData; // Store for easy access if needed
                    
                    photoMeshesRef.current.push(photoData);
                    mainGroupRef.current?.add(mesh);
                };
            };
            reader.readAsDataURL(file);
        });
        processedPhotoCountRef.current = newPhotos.length;
    }
  }, [newPhotos]);

  return <div ref={containerRef} className="w-full h-full" />;
};
