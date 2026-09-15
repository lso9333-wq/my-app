/**
 * @tensorflow-models/pose-detection statically imports `Pose` from
 * `@mediapipe/pose` to support the BlazePose "mediapipe" runtime. This app
 * uses BlazePose only via the "tfjs" runtime (pure TFJS ops, no mediapipe
 * WASM binary needed), so that real package (which ships a non-ESM browser
 * script) is aliased to this stub in vite.config.ts to keep the production
 * bundle buildable and free of unused wasm assets.
 */
export class Pose {
  constructor() {
    throw new Error('BlazePose mediapipe runtime is not enabled in this app.')
  }
}

export default { Pose }
