import { createRoot } from 'react-dom/client';
import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import {
  HtmlSurfaceManager,
  type HtmlSurfaceDebugState,
} from '../index';
import { projectDomTarget } from './demo-test-api';
import { MonitorSite } from './MonitorSite';
import './styles.css';

const canvas = requireElement<HTMLCanvasElement>('#scene');
const fallback = requireElement<HTMLDivElement>('#fallback');
const loading = requireElement<HTMLDivElement>('#loading');
const hudBackend = requireElement<HTMLElement>('#hud-backend');
const hudHit = requireElement<HTMLElement>('#hud-hit');
const hudUv = requireElement<HTMLElement>('#hud-uv');
const hudDom = requireElement<HTMLElement>('#hud-dom');
const hudCapability = requireElement<HTMLElement>('#hud-capability');
const hudFocus = requireElement<HTMLElement>('#hud-focus');
const hudCapture = requireElement<HTMLElement>('#hud-capture');
const animationButton = requireElement<HTMLButtonElement>(
  '#toggle-animation',
);
const occlusionButton = requireElement<HTMLButtonElement>(
  '#toggle-occlusion',
);
const e2eMode = new URLSearchParams(location.search).has('e2e');

let renderer: WebGLRenderer;
try {
  renderer = new WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: e2eMode,
  });
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  fallback.hidden = false;
  fallback.textContent = `WebGL renderer could not start: ${message}`;
  loading.remove();
  throw error;
}

renderer.setClearColor(0x080b0f, 1);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new Scene();
scene.background = new Color(0x080b0f);

const camera = new PerspectiveCamera(38, 1, 0.1, 100);
camera.position.set(0.8, 1.45, 7.1);

const monitor = createMonitor();
monitor.group.position.set(0.25, 0.35, 0);
monitor.group.rotation.y = -0.08;
scene.add(monitor.group);
const monitorOrigin = monitor.group.position.clone();

const secondary = createSecondaryPanel();
secondary.group.position.set(3.15, 0.1, -0.55);
secondary.group.rotation.y = -0.33;
scene.add(secondary.group);

const blocker = new Mesh(
  new BoxGeometry(0.78, 0.78, 0.78),
  new MeshStandardMaterial({
    color: 0x171b1e,
    metalness: 0.18,
    roughness: 0.68,
  }),
);
blocker.name = 'moving-occluder';
blocker.position.set(0.4, 0.72, 0.82);
scene.add(blocker);

const floor = new Mesh(
  new PlaneGeometry(30, 30),
  new MeshStandardMaterial({
    color: 0x0b1013,
    metalness: 0.12,
    roughness: 0.72,
  }),
);
floor.name = 'studio-floor';
floor.rotation.x = -Math.PI / 2;
floor.position.y = -1.55;
scene.add(floor);

const ambient = new AmbientLight(0x91a4a6, 1.55);
scene.add(ambient);

const keyLight = new DirectionalLight(0xdffcff, 3.4);
keyLight.position.set(-2, 5, 5);
scene.add(keyLight);

const rimLight = new DirectionalLight(0x65e6d4, 2.1);
rimLight.position.set(5, 2, -2);
scene.add(rimLight);

let latestDebug: HtmlSurfaceDebugState = { kind: 'none' };
const manager = new HtmlSurfaceManager({
  renderer,
  camera,
  scene,
  onDebugChange(state) {
    latestDebug = state;
  },
});

const reactElement = document.createElement('div');
reactElement.className = 'surface-source react-surface';
const reactSurface = manager.add({
  id: 'monitor-react',
  element: reactElement,
  mesh: monitor.screen,
});
const reactRoot = createRoot(reactElement);
reactRoot.render(<MonitorSite backend={manager.backendKind} />);

const vanillaElement = createVanillaPanel();
const vanillaSurface = manager.add({
  id: 'panel-vanilla',
  element: vanillaElement,
  mesh: secondary.screen,
});

let blockerPaused = false;
let occluded = false;
const blockerButton = vanillaElement.querySelector<HTMLButtonElement>(
  '[data-testid="vanilla-action"]',
);
blockerButton?.addEventListener('click', () => {
  blockerPaused = !blockerPaused;
  blockerButton.textContent = blockerPaused
    ? 'Move occluder'
    : 'Hold occluder';
  vanillaElement.querySelector<HTMLElement>('[data-occluder-state]')!
    .textContent = blockerPaused ? 'held' : 'moving';
  vanillaSurface.invalidate();
});

hudBackend.textContent = manager.backendKind;
const capabilityReport = manager.getCapabilityReport();
hudCapability.textContent = capabilityReport.warnings.length === 0
  ? 'ready'
  : `${capabilityReport.warnings.length} warning`;

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.065;
controls.enablePan = false;
controls.minDistance = 5.2;
controls.maxDistance = 9.2;
controls.target.set(0.55, 0.18, 0);

const reducedMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)',
).matches;
let animationPaused = reducedMotion || e2eMode;
let fixedAnimationTime = 0;
let currentAnimationTime = 0;
if (reducedMotion) blockerPaused = true;

let resolveReady!: () => void;
const ready = new Promise<void>((resolve) => {
  resolveReady = resolve;
});

function applyMonitorMotion(seconds: number) {
  monitor.group.position.set(
    monitorOrigin.x + Math.sin(seconds * 0.43) * 0.42,
    monitorOrigin.y + Math.sin(seconds * 0.67) * 0.18,
    monitorOrigin.z + Math.cos(seconds * 0.31) * 0.12,
  );
  monitor.group.rotation.set(
    Math.sin(seconds * 0.37) * 0.035,
    -0.08 + Math.sin(seconds * 0.29) * 0.12,
    Math.sin(seconds * 0.23) * 0.025,
  );
  monitor.group.updateMatrixWorld(true);
}

function placeOccluder(value: boolean) {
  occluded = value;
  if (!value) {
    blocker.scale.setScalar(1);
    blocker.position.set(4.6, 2.4, 1.4);
    blocker.updateMatrixWorld(true);
    return;
  }

  const center = monitor.screen.getWorldPosition(new Vector3());
  blocker.position.copy(center).lerp(camera.position, 0.18);
  blocker.scale.set(5.8, 4.2, 0.35);
  blocker.rotation.set(0, 0, 0);
  blocker.updateMatrixWorld(true);
}

function syncAnimationButton() {
  animationButton.textContent = animationPaused
    ? 'Resume motion'
    : 'Pause motion';
}

if (e2eMode) {
  placeOccluder(false);
}

function toggleAnimation() {
  const nextPaused = !animationPaused;
  if (nextPaused) fixedAnimationTime = currentAnimationTime;
  animationPaused = nextPaused;
  syncAnimationButton();
}

function toggleOcclusion() {
  placeOccluder(!occluded);
  occlusionButton.textContent = occluded
    ? 'Hide occlusion'
    : 'Show occlusion';
}

animationButton.addEventListener('click', toggleAnimation);
occlusionButton.addEventListener('click', toggleOcclusion);
syncAnimationButton();

if (e2eMode) {
  window.__HTML_SURFACE_DEMO__ = {
    ready,
    setAnimationTime(seconds) {
      fixedAnimationTime = seconds;
      applyMonitorMotion(seconds);
      if (occluded) placeOccluder(true);
    },
    setAnimationPaused(paused) {
      if (paused && !animationPaused) {
        fixedAnimationTime = currentAnimationTime;
      }
      animationPaused = paused;
      syncAnimationButton();
    },
    setOccluded(value) {
      placeOccluder(value);
      occlusionButton.textContent = occluded
        ? 'Hide occlusion'
        : 'Show occlusion';
    },
    pointFor(testId, xRatio, yRatio) {
      const reactTarget = reactElement.querySelector(
        `[data-testid="${testId}"]`,
      );
      const descriptor = reactTarget
        ? { root: reactElement, screen: monitor.screen }
        : { root: vanillaElement, screen: secondary.screen };
      return projectDomTarget({
        root: descriptor.root,
        testId,
        screen: descriptor.screen,
        camera,
        renderer,
        xRatio,
        yRatio,
      });
    },
    getState() {
      return {
        animationTime: fixedAnimationTime,
        paused: animationPaused,
        occluded,
        capabilities: manager.getCapabilityReport(),
        debug: manager.getDebugState(),
      };
    },
  };
}

let firstFrame = true;
let animationFrame = 0;
const startTime = performance.now();

function render(time: number) {
  const elapsed = (time - startTime) / 1000;
  const animationTime = animationPaused
    ? fixedAnimationTime
    : elapsed;
  currentAnimationTime = animationTime;
  applyMonitorMotion(animationTime);
  if (!e2eMode && !occluded && !blockerPaused) {
    blocker.position.x = 0.25 + Math.sin(elapsed * 0.62) * 1.62;
    blocker.position.y = 0.72;
    blocker.position.z = 0.82;
    blocker.scale.setScalar(1);
    blocker.rotation.x = elapsed * 0.17;
    blocker.rotation.y = elapsed * 0.23;
    blocker.updateMatrixWorld(true);
  }

  controls.update();
  manager.update();
  updateHud(latestDebug);
  renderer.render(scene, camera);

  if (firstFrame) {
    firstFrame = false;
    loading.remove();
    resolveReady();
  }

  animationFrame = requestAnimationFrame(render);
}

function resize() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  renderer.setSize(width, height, false);
  const aspect = width / height;
  const compact = aspect < 0.8;
  camera.aspect = aspect;
  camera.fov = compact ? 50 : 38;
  camera.position.set(
    compact ? 0.45 : 0.8,
    compact ? 1.25 : 1.45,
    compact ? 10.5 : 7.1,
  );
  controls.target.set(
    compact ? 0.25 : 0.55,
    0.18,
    0,
  );
  camera.updateProjectionMatrix();
}

window.addEventListener('resize', resize);
resize();
animationFrame = requestAnimationFrame(render);

window.addEventListener('beforeunload', () => {
  cancelAnimationFrame(animationFrame);
  window.removeEventListener('resize', resize);
  controls.dispose();
  animationButton.removeEventListener('click', toggleAnimation);
  occlusionButton.removeEventListener('click', toggleOcclusion);
  reactRoot.unmount();
  reactSurface.dispose();
  vanillaSurface.dispose();
  manager.dispose();
  renderer.dispose();
  delete window.__HTML_SURFACE_DEMO__;
});

function createMonitor() {
  const group = new Group();
  group.name = 'main-monitor';

  const frameMaterial = new MeshStandardMaterial({
    color: 0x171c1f,
    metalness: 0.54,
    roughness: 0.46,
  });
  const frame = new Mesh(
    new BoxGeometry(4.35, 3.02, 0.24),
    frameMaterial,
  );
  frame.name = 'monitor-frame';
  group.add(frame);

  const screen = new Mesh(
    new PlaneGeometry(3.82, 2.51),
    new MeshBasicMaterial({
      color: 0xffffff,
      toneMapped: false,
    }),
  );
  screen.name = 'monitor-screen';
  screen.position.z = 0.126;
  group.add(screen);

  const standMaterial = frameMaterial.clone();
  for (const x of [-1.42, 1.42]) {
    const leg = new Mesh(
      new BoxGeometry(0.26, 0.82, 0.22),
      standMaterial,
    );
    leg.name = 'monitor-leg';
    leg.position.set(x, -1.86, 0);
    leg.userData.htmlSurfaceRaycast = 'ignore';
    group.add(leg);

    const foot = new Mesh(
      new BoxGeometry(0.72, 0.16, 0.62),
      standMaterial,
    );
    foot.name = 'monitor-foot';
    foot.position.set(x, -2.22, 0.08);
    foot.userData.htmlSurfaceRaycast = 'ignore';
    group.add(foot);
  }

  return { group, screen };
}

function createSecondaryPanel() {
  const group = new Group();
  group.name = 'secondary-panel';

  const frame = new Mesh(
    new BoxGeometry(1.82, 1.38, 0.16),
    new MeshStandardMaterial({
      color: 0x171c1f,
      metalness: 0.48,
      roughness: 0.5,
    }),
  );
  frame.name = 'secondary-frame';
  group.add(frame);

  const screen = new Mesh(
    new PlaneGeometry(1.56, 1.04),
    new MeshBasicMaterial({
      color: 0xffffff,
      toneMapped: false,
    }),
  );
  screen.name = 'secondary-screen';
  screen.position.z = 0.086;
  group.add(screen);

  return { group, screen };
}

function createVanillaPanel(): HTMLDivElement {
  const element = document.createElement('div');
  element.className = 'surface-source vanilla-surface';
  element.innerHTML = `
    <section class="vanilla-panel">
      <h2>Vanilla surface</h2>
      <p>One manager, another HTMLElement.</p>
      <dl>
        <div><dt>Source</dt><dd>HTMLElement</dd></div>
        <div><dt>Target</dt><dd>Mesh</dd></div>
        <div><dt>Occluder</dt><dd data-occluder-state>moving</dd></div>
      </dl>
      <button data-testid="vanilla-action" type="button">Hold occluder</button>
    </section>
  `;
  return element;
}

function updateHud(state: HtmlSurfaceDebugState) {
  hudHit.textContent = state.surfaceId
    ?? state.objectName
    ?? state.kind;
  hudUv.textContent = state.uv
    ? `${state.uv.x.toFixed(3)}, ${state.uv.y.toFixed(3)}`
    : '—';
  hudDom.textContent = state.domPoint
    ? `${Math.round(state.domPoint.x)}, ${Math.round(state.domPoint.y)}`
    : '—';
  hudFocus.textContent = state.focusTarget ?? '—';
  hudCapture.textContent = state.capturedPointerId === undefined
    ? '—'
    : String(state.capturedPointerId);
}

function requireElement<ElementType extends Element>(
  selector: string,
): ElementType {
  const element = document.querySelector<ElementType>(selector);
  if (!element) {
    throw new Error(`Missing required element: ${selector}`);
  }
  return element;
}
