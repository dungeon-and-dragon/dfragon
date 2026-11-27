const BASE64_PADDING = /=+$/

export function toBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text)
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('')

  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(BASE64_PADDING, '')
}

export function fromBase64Url(value: string): string {
  const binary = atob(value.replaceAll('-', '+').replaceAll('_', '/'))

  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)))
}
