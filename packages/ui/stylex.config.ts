// Keep every browser build on static CSP-safe stylesheets without runtime style injection.
// CSS layers stay off so StyleX rules stay unlayered and win over the layered Tailwind CSS.
export const stylexOptions = {
  runtimeInjection: false,
  useCSSLayers: false
}
