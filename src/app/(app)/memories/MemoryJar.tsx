"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

export type Mote = { id: string; withPhoto: boolean; photo: string | null };

const MAX_MOTES = 60;
// Each photo is its own draw call, so this is capped well below MAX_MOTES. The
// rest stay as lights, which is what they were anyway.
const MAX_PHOTOS = 18;

/** Soft radial glow, drawn once into a canvas — no asset to ship or load. */
function glowTexture(): THREE.Texture {
  const size = 64;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, "rgba(255,255,255,1)");
  grad.addColorStop(0.25, "rgba(255,255,255,0.75)");
  grad.addColorStop(0.55, "rgba(255,255,255,0.18)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** The jar's silhouette, revolved: base, shoulder, neck, lip. */
function jarProfile(): THREE.Vector2[] {
  return [
    new THREE.Vector2(0.0, -1.25),
    new THREE.Vector2(0.62, -1.25),
    new THREE.Vector2(0.78, -1.05),
    new THREE.Vector2(0.82, -0.2),
    new THREE.Vector2(0.80, 0.55),
    new THREE.Vector2(0.66, 0.92),
    new THREE.Vector2(0.50, 1.05),
    new THREE.Vector2(0.50, 1.22),
    new THREE.Vector2(0.56, 1.26),
  ];
}

// Glass without refraction: brightest where the surface turns away from you.
// Cheap, stable on a phone GPU, and it reads as glass because that is the cue
// your eye actually uses.
const FRESNEL_VERT = `
  varying vec3 vNormalW;
  varying vec3 vViewDir;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vViewDir = normalize(cameraPosition - world.xyz);
    gl_Position = projectionMatrix * viewMatrix * world;
  }`;

const FRESNEL_FRAG = `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec3 vNormalW;
  varying vec3 vViewDir;
  void main() {
    float f = 1.0 - abs(dot(normalize(vNormalW), normalize(vViewDir)));
    f = pow(clamp(f, 0.0, 1.0), 2.4);
    gl_FragColor = vec4(uColor, f * uOpacity);
  }`;

const PHOTO_VERT = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`;

// Round, soft-edged, with a rim in the couple's accent. Fragments outside the
// circle are discarded rather than drawn transparent, so depth still sorts the
// photos against each other correctly.
const PHOTO_FRAG = `
  uniform sampler2D uMap;
  uniform vec3 uRim;
  varying vec2 vUv;
  void main() {
    vec2 p = vUv - 0.5;
    float d = length(p);
    if (d > 0.5) discard;
    float edge = smoothstep(0.5, 0.42, d);
    float rim = smoothstep(0.34, 0.5, d) * 0.6;
    vec3 col = texture2D(uMap, vUv).rgb;
    col = mix(col, uRim, rim);
    gl_FragColor = vec4(col, edge);
    if (gl_FragColor.a < 0.02) discard;
  }`;

export default function MemoryJar({ motes, onSelect }: { motes: Mote[]; onSelect: (id: string) => void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  // Switching Paper/Ink has to rebuild the scene — blending mode is baked into
  // the materials, not something that can be toggled on the fly.
  const [modeTick, setModeTick] = useState(0);
  useEffect(() => {
    const ob = new MutationObserver(() => setModeTick((n) => n + 1));
    ob.observe(document.documentElement, { attributes: true, attributeFilter: ["data-mode"] });
    return () => ob.disconnect();
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "low-power" });
    } catch {
      return; // No WebGL — the list below is the whole feature anyway.
    }

    const calm = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    // Additive blending only works against darkness — on paper it washes to
    // nothing. In light mode the jar inverts: ink drawn on the page rather than
    // light held in the dark.
    const onPaper = document.documentElement.getAttribute("data-mode") !== "dark";
    // Themes expose --accent as space-separated RGB channels.
    const accent = getComputedStyle(host).getPropertyValue("--accent").trim();
    const [ar, ag, ab] = accent.split(/\s+/).map(Number);
    const accentColor = new THREE.Color(
      (Number.isFinite(ar) ? ar : 249) / 255,
      (Number.isFinite(ag) ? ag : 115) / 255,
      (Number.isFinite(ab) ? ab : 115) / 255
    );

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(host.clientWidth, host.clientHeight, false);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.touchAction = "pan-y"; // let the page scroll past it
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, host.clientWidth / host.clientHeight, 0.1, 100);
    camera.position.set(0, 0.1, 4.6);

    const group = new THREE.Group();
    scene.add(group);

    // --- jar ---
    const jarGeo = new THREE.LatheGeometry(jarProfile(), 64);
    const jarMat = new THREE.ShaderMaterial({
      vertexShader: FRESNEL_VERT,
      fragmentShader: FRESNEL_FRAG,
      uniforms: {
        uColor: {
          value: onPaper
            ? accentColor.clone().lerp(new THREE.Color(0.11, 0.1, 0.08), 0.55)
            : accentColor.clone().lerp(new THREE.Color(1, 1, 1), 0.55),
        },
        uOpacity: { value: onPaper ? 0.75 : 0.5 },
      },
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: onPaper ? THREE.NormalBlending : THREE.AdditiveBlending,
    });
    group.add(new THREE.Mesh(jarGeo, jarMat));

    // --- motes, one per memory ---
    const shown = motes.slice(0, MAX_MOTES);
    const count = shown.length;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const seeds = new Float32Array(count);
    const home = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      // Rejection-free placement inside the jar's body.
      const r = 0.68 * Math.sqrt(Math.random());
      const theta = Math.random() * Math.PI * 2;
      const y = -1.1 + Math.random() * 1.9;
      home[i * 3] = Math.cos(theta) * r;
      home[i * 3 + 1] = y;
      home[i * 3 + 2] = Math.sin(theta) * r;
      positions.set([home[i * 3], home[i * 3 + 1], home[i * 3 + 2]], i * 3);

      // Memories with a photo burn a little warmer and brighter.
      const toward = onPaper ? new THREE.Color(0.11, 0.1, 0.08) : new THREE.Color(1, 1, 1);
      const c = shown[i]!.withPhoto
        ? accentColor.clone().lerp(toward, 0.45)
        : accentColor.clone().lerp(toward, 0.12);
      colors.set([c.r, c.g, c.b], i * 3);
      sizes[i] = shown[i]!.withPhoto ? 0.3 : 0.22;
      seeds[i] = Math.random() * Math.PI * 2;
    }

    const moteGeo = new THREE.BufferGeometry();
    moteGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    moteGeo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const tex = glowTexture();
    const moteMat = new THREE.PointsMaterial({
      size: 0.26,
      map: tex,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: onPaper ? THREE.NormalBlending : THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    const points = new THREE.Points(moteGeo, moteMat);
    group.add(points);

    // --- photos ---
    // Textures come straight from the signed URL to the GPU; no canvas, so a
    // cross-origin image can never taint one. If Supabase does not send CORS
    // headers the load simply errors and that memory stays a light.
    const photoIdx: number[] = [];
    const photoMeshes: THREE.Mesh[] = [];
    const photoTextures: THREE.Texture[] = [];
    const photoGeo = new THREE.PlaneGeometry(1, 1);
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin("anonymous");

    let disposed = false;
    const rimColor = accentColor.clone().lerp(onPaper ? new THREE.Color(0.11, 0.1, 0.08) : new THREE.Color(1, 1, 1), 0.3);
    const withPhotos = shown.map((m, i) => ({ m, i })).filter((x) => x.m.photo).slice(0, MAX_PHOTOS);

    for (const { m, i } of withPhotos) {
      loader.load(
        m.photo!,
        (texture) => {
          if (disposed) { texture.dispose(); return; }
          texture.colorSpace = THREE.SRGBColorSpace;
          const mat = new THREE.ShaderMaterial({
            vertexShader: PHOTO_VERT,
            fragmentShader: PHOTO_FRAG,
            uniforms: { uMap: { value: texture }, uRim: { value: rimColor } },
            transparent: true,
          });
          const mesh = new THREE.Mesh(photoGeo, mat);
          mesh.scale.setScalar(0.3);
          // Added to the scene, not the group: billboarding is simpler when the
          // parent is not itself turning.
          scene.add(mesh);
          photoIdx.push(i);
          photoMeshes.push(mesh);
          photoTextures.push(texture);
          if (calm || !running) drawOnce();
        },
        undefined,
        () => { /* no CORS, or gone — the light underneath is the fallback */ }
      );
    }

    // --- interaction ---
    const raycaster = new THREE.Raycaster();
    raycaster.params.Points.threshold = 0.18;
    const pointer = new THREE.Vector2();
    let dragging = false;
    let moved = 0;
    let lastX = 0;
    let spin = 0;
    let spinVel = 0;

    const onDown = (e: PointerEvent) => { dragging = true; moved = 0; lastX = e.clientX; renderer.domElement.setPointerCapture(e.pointerId); };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      moved += Math.abs(dx);
      spinVel = dx * 0.004;
    };
    const onUp = (e: PointerEvent) => {
      dragging = false;
      // A drag is not a tap. Only a near-still press selects a memory.
      if (moved > 6) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObject(points, false)[0];
      if (hit?.index != null && shown[hit.index]) selectRef.current(shown[hit.index]!.id);
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("pointerup", onUp);
    renderer.domElement.addEventListener("pointercancel", () => { dragging = false; });

    // --- loop, only while it is worth running ---
    let raf = 0;
    let running = false;
    const clock = new THREE.Clock();
    const pos = moteGeo.attributes.position as THREE.BufferAttribute;

    // Photos live outside the rotating group, so apply the same turn by hand and
    // face them at the camera. Called from the loop and from every static draw,
    // because under reduced motion there is no loop to do it.
    function placePhotos() {
      if (photoMeshes.length === 0) return;
      const cos = Math.cos(spin);
      const sin = Math.sin(spin);
      for (let k = 0; k < photoMeshes.length; k++) {
        const i = photoIdx[k]!;
        const x = pos.array[i * 3]!;
        const y = pos.array[i * 3 + 1]!;
        const z = pos.array[i * 3 + 2]!;
        photoMeshes[k]!.position.set(x * cos + z * sin, y, -x * sin + z * cos);
        photoMeshes[k]!.quaternion.copy(camera.quaternion);
      }
    }

    function drawOnce() {
      placePhotos();
      renderer.render(scene, camera);
    }

    function frame() {
      const t = clock.getElapsedTime();
      if (!calm) {
        for (let i = 0; i < count; i++) {
          const s = seeds[i]!;
          pos.array[i * 3] = home[i * 3]! + Math.sin(t * 0.26 + s) * 0.05;
          pos.array[i * 3 + 1] = home[i * 3 + 1]! + Math.sin(t * 0.21 + s * 1.7) * 0.07;
          pos.array[i * 3 + 2] = home[i * 3 + 2]! + Math.cos(t * 0.24 + s) * 0.05;
        }
        pos.needsUpdate = true;
        spin += spinVel + 0.0016;
        spinVel *= 0.93;
        group.rotation.y = spin;
      }
      placePhotos();
      renderer.render(scene, camera);
      if (running && !calm) raf = requestAnimationFrame(frame);
    }

    function start() {
      if (running || calm) { if (calm) drawOnce(); return; }
      running = true;
      clock.getDelta();
      raf = requestAnimationFrame(frame);
    }
    function stop() {
      running = false;
      cancelAnimationFrame(raf);
    }

    // Off-screen or backgrounded means no frames. A render loop left running is
    // how a pretty page becomes a battery complaint.
    const io = new IntersectionObserver(([e]) => (e?.isIntersecting ? start() : stop()), { threshold: 0.05 });
    io.observe(host);
    const onVis = () => {
      if (document.hidden) stop();
      else start();
    };
    document.addEventListener("visibilitychange", onVis);

    const ro = new ResizeObserver(() => {
      const w = host.clientWidth;
      const h = host.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      if (calm || !running) drawOnce();
    });
    ro.observe(host);

    drawOnce(); // first frame immediately, even if calm

    return () => {
      stop();
      io.disconnect();
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("pointerup", onUp);
      jarGeo.dispose();
      jarMat.dispose();
      disposed = true;
      for (const mesh of photoMeshes) {
        scene.remove(mesh);
        (mesh.material as THREE.Material).dispose();
      }
      for (const t of photoTextures) t.dispose();
      photoGeo.dispose();
      moteGeo.dispose();
      moteMat.dispose();
      tex.dispose();
      renderer.dispose();
      host.removeChild(renderer.domElement);
    };
  }, [motes, modeTick]);

  return (
    <div
      ref={hostRef}
      className="rounded-xl2 overflow-hidden border border-line bg-panel aspect-[4/5] max-h-[420px]"
      role="img"
      aria-label={`A jar holding ${motes.length} ${motes.length === 1 ? "memory" : "memories"}. Each memory is listed below.`}
    />
  );
}
