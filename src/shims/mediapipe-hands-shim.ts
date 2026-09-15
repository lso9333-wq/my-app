/**
 * @tensorflow-models/hand-pose-detection statically imports `Hands` from
 * `@mediapipe/hands` to support the MediaPipeHands "mediapipe" runtime. This
 * app uses MediaPipeHands only via the "tfjs" runtime (pure TFJS ops, no
 * mediapipe WASM binary needed — see shared/lib/handDetector.ts's
 * `getHandDetector()`, `runtime: 'tfjs'`), so that real package (which ships
 * a non-ESM browser script, same problem as `@mediapipe/pose` — see
 * mediapipe-pose-shim.ts right next to this file) is aliased to this stub in
 * vite.config.ts to keep the production bundle buildable. Discovered via an
 * actual `docker compose build` failure on the deploy VM (`[MISSING_EXPORT]
 * "Hands" is not exported by "node_modules/@mediapipe/hands/hands.js"`) —
 * exactly the kind of dependency-shape issue this dev sandbox's blocked npm
 * registry access couldn't catch ahead of time (see handDetector.ts's
 * top-of-file warning).
 */
export class Hands {
  constructor() {
    throw new Error('MediaPipeHands mediapipe runtime is not enabled in this app.')
  }
}

export default { Hands }
