import type { CharacterImage } from '../../../../preload/common/types/character'

const IMAGE_READ_ERROR = 'Could not read the character image.'

export async function decodeBrowserPng(bytes: Uint8Array): Promise<CharacterImage> {
  // Desktop의 pngjs처럼 파일의 픽셀 값을 그대로 비교하도록 색 공간 변환과 alpha 미리 곱하기를 끈다.
  const bitmap = await createImageBitmap(new Blob([bytes.slice()], { type: 'image/png' }), {
    colorSpaceConversion: 'none',
    premultiplyAlpha: 'none'
  })
  try {
    return { width: bitmap.width, height: bitmap.height, rgba: readBitmapPixels(bitmap) }
  } finally {
    bitmap.close()
  }
}

// 2D canvas는 alpha를 미리 곱해 저장하므로 반투명 픽셀의 RGB가 pngjs와 달라진다. WebGL 텍스처는 곱하지 않은 값을 그대로 읽는다.
function readBitmapPixels(bitmap: ImageBitmap): Uint8Array {
  const gl = new OffscreenCanvas(1, 1).getContext('webgl')
  if (gl == null) {
    throw new Error(IMAGE_READ_ERROR)
  }
  try {
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE)
    const texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap)
    gl.bindFramebuffer(gl.FRAMEBUFFER, gl.createFramebuffer())
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0)
    const rgba = new Uint8Array(bitmap.width * bitmap.height * 4)
    gl.readPixels(0, 0, bitmap.width, bitmap.height, gl.RGBA, gl.UNSIGNED_BYTE, rgba)
    if (gl.getError() !== gl.NO_ERROR) {
      throw new Error(IMAGE_READ_ERROR)
    }

    return rgba
  } finally {
    gl.getExtension('WEBGL_lose_context')?.loseContext()
  }
}
