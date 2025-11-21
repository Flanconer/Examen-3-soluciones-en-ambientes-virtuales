import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { StereoEffect } from 'three/addons/effects/StereoEffect.js';

let scene, camera, renderer, effectSBS, controls, mixer;
let clock = new THREE.Clock();
let currentEscenario = null;
let currentPersonaje = null;
let isPaused = false;

const stage = document.getElementById('stage');
const loaderOverlay = document.getElementById('loader');

// Controles (pueden NO existir si ocultaste el panel)
const chkSBS             = document.getElementById('chkSBS');
const btnCentrar         = document.getElementById('btnCentrar');
const btnPlayPause       = document.getElementById('btnPlayPause');
const btnCargarEscenario = document.getElementById('btnCargarEscenario');
const inputEscenario     = document.getElementById('inputEscenario');
const btnCargarPersonaje = document.getElementById('btnCargarPersonaje');
const inputPersonaje     = document.getElementById('inputPersonaje');
const btnCargarAnimacion = document.getElementById('btnCargarAnimacion');
const inputAnimacion     = document.getElementById('inputAnimacion');

init();
animate();

function init() {
  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(stage.clientWidth, stage.clientHeight);
  renderer.shadowMap.enabled = true;
  stage.appendChild(renderer.domElement);

  // WebXR - VRButton
  renderer.xr.enabled = true;
  const vrBtn = VRButton.createButton(renderer);
  document.body.appendChild(vrBtn);

  // Side-by-Side para Cardboard
  effectSBS = new StereoEffect(renderer);
  effectSBS.setSize(stage.clientWidth, stage.clientHeight);

  // Escena y cámara
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0c0f17);

  camera = new THREE.PerspectiveCamera(70, stage.clientWidth / stage.clientHeight, 0.1, 1000);
  camera.position.set(0, 1.6, 4);

  const vrCamera = new THREE.PerspectiveCamera(70, stage.clientWidth / stage.clientHeight, 0.1, 1000);
  scene.add(vrCamera);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.set(0, 1, 0);

  // Luces (más iluminación)
  const ambient = new THREE.AmbientLight(0xffffff, 1.0);
  scene.add(ambient);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x404040, 0.8);
  hemi.position.set(0, 20, 0);
  scene.add(hemi);

  const dir = new THREE.DirectionalLight(0xffffff, 1.8);
  dir.position.set(5, 12, 5);
  dir.castShadow = true;
  dir.shadow.mapSize.width = 2048;
  dir.shadow.mapSize.height = 2048;
  dir.shadow.camera.near = 0.5;
  dir.shadow.camera.far = 50;
  scene.add(dir);

  const fill = new THREE.PointLight(0xffffff, 0.9, 80);
  fill.position.set(-6, 6, -4);
  scene.add(fill);

  // Piso
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(30, 64),
    new THREE.MeshStandardMaterial({ color: 0x3a4356, roughness: 0.7, metalness: 0.1 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // UI (solo si existen los elementos)
  if (btnCentrar) {
    btnCentrar.onclick = () => {
      controls.target.set(0, 1, 0);
      camera.position.set(0, 1.6, 4);
    };
  }

  if (btnPlayPause) {
    btnPlayPause.onclick = () => {
      isPaused = !isPaused;
      btnPlayPause.textContent = isPaused ? 'Reanudar animación' : 'Pausar animación';
    };
  }

  if (btnCargarEscenario && inputEscenario) {
    btnCargarEscenario.onclick = () => {
      const url = inputEscenario.value.trim() || './1.glb';
      cargarEscenario(url);
    };
  }

  if (btnCargarPersonaje && inputPersonaje) {
    btnCargarPersonaje.onclick = () => {
      const url = inputPersonaje.value.trim();
      if (url) cargarPersonaje(url);
    };
  }

  if (btnCargarAnimacion && inputAnimacion) {
    btnCargarAnimacion.onclick = () => {
      const url = inputAnimacion.value.trim();
      if (url) cargarAnimacionFBX(url);
    };
  }

  if (chkSBS) {
    chkSBS.addEventListener('change', onResize);
  }
  window.addEventListener('resize', onResize);

  // Cargas por defecto cuando no hay panel de controles
  cargarEscenario('./1.glb');
  // cargarPersonaje('./assets/personaje.fbx');
}

function setLoading(v) { loaderOverlay.classList.toggle('d-none', !v); }

function clearObject(obj) {
  if (!obj) return;
  scene.remove(obj);
  obj.traverse?.((c) => {
    if (c.isMesh) {
      c.geometry?.dispose?.();
      if (Array.isArray(c.material)) c.material.forEach(m => m.dispose?.());
      else c.material?.dispose?.();
    }
  });
}

function getExt(url) {
  const q = url.split('?')[0];
  return q.slice(q.lastIndexOf('.') + 1).toLowerCase();
}

function cargarEscenario(url) {
  if (!url) return;
  setLoading(true);
  const ext = getExt(url);
  const useFBX = ext === 'fbx';
  const loader = useFBX ? new FBXLoader() : new GLTFLoader();

  loader.load(url, (res) => {
    clearObject(currentEscenario);
    currentEscenario = useFBX ? res : res.scene;
    currentEscenario.traverse((c) => { c.castShadow = true; c.receiveShadow = true; });

    if (useFBX) currentEscenario.scale.setScalar(0.01);

    // elevar 1 cm sobre el piso para evitar parpadeos (z-fighting)
    currentEscenario.position.set(0, 0.01, 0);

    scene.add(currentEscenario);
    fitSceneToCamera(currentEscenario);
    setLoading(false);
  }, undefined, (err) => {
    console.error('Error cargando escenario:', err);
    setLoading(false);
  });
}

function cargarPersonaje(url) {
  if (!url) return;
  setLoading(true);
  const ext = getExt(url);
  const useFBX = ext === 'fbx';
  const loader = useFBX ? new FBXLoader() : new GLTFLoader();

  loader.load(url, (res) => {
    clearObject(currentPersonaje);
    currentPersonaje = useFBX ? res : res.scene;
    currentPersonaje.traverse((c) => { c.castShadow = true; });

    if (useFBX) currentPersonaje.scale.setScalar(0.01);

    currentPersonaje.position.set(0, 0, 0);
    scene.add(currentPersonaje);

    const clips = res.animations || [];
    if (clips.length) {
      mixer?.stopAllAction?.();
      mixer = new THREE.AnimationMixer(currentPersonaje);
      const action = mixer.clipAction(clips[0]);
      action.reset().play();
    }
    setLoading(false);
  }, undefined, (err) => {
    console.error('Error cargando personaje:', err);
    setLoading(false);
  });
}

function cargarAnimacionFBX(url) {
  if (!currentPersonaje) {
    console.warn('Primero carga un personaje para aplicar la animación.');
    return;
  }
  setLoading(true);
  const loader = new FBXLoader();
  loader.load(url, (animObj) => {
    const clips = animObj.animations || [];
    if (!clips.length) {
      console.warn('La animación FBX no contiene AnimationClips.');
      setLoading(false);
      return;
    }
    if (!mixer) mixer = new THREE.AnimationMixer(currentPersonaje);
    mixer.stopAllAction();
    const action = mixer.clipAction(clips[0]);
    action.reset().play();
    setLoading(false);
  }, undefined, (err) => {
    console.error('Error cargando animación FBX:', err);
    setLoading(false);
  });
}

function fitSceneToCamera(root) {
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  controls.target.copy(center);

  const maxDim = Math.max(size.x, size.y, size.z);
  const fitDist = maxDim / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));

  camera.position.copy(center).add(new THREE.Vector3(0, 1.6, fitDist * 0.5));
  const xrCam = renderer.xr.getCamera();
  if (xrCam) xrCam.position.copy(camera.position);

  controls.update();
}

function onResize() {
  const w = stage.clientWidth;
  const h = stage.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  effectSBS.setSize(w, h);
}

function animate() {
  const dt = clock.getDelta();
  if (mixer && !isPaused) mixer.update(dt);
  controls.update();

  if (chkSBS && chkSBS.checked && !renderer.xr.isPresenting) {
    effectSBS.render(scene, camera);
  } else {
    renderer.render(scene, camera);
  }

  renderer.setAnimationLoop(animate);
}
