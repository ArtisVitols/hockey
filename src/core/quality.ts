// `?webgl=1` forces the WebGL2 backend for fallback parity testing.
export function wantsWebGLFallback(): boolean {
  return new URLSearchParams(window.location.search).has('webgl')
}
