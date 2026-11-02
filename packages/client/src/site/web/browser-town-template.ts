import type { DNFParticipantFrame } from '@dfragon/lib'
import { decodeBrowserPng } from './browser-png'
import townIndicatorUrl from './town-indicator.png'

let template: Promise<DNFParticipantFrame> | null = null

async function loadTemplate(): Promise<DNFParticipantFrame> {
  const response = await fetch(townIndicatorUrl)
  if (!response.ok) {
    throw new Error('TOWN_TEMPLATE_UNAVAILABLE')
  }

  return decodeBrowserPng(new Uint8Array(await response.arrayBuffer()))
}

export function readTownIndicatorTemplate(): Promise<DNFParticipantFrame> {
  if (template === null) {
    const loading = loadTemplate()
    template = loading
    loading.catch(() => {
      template = null
    })
  }

  return template
}
