import { readFile } from 'node:fs/promises'
import { isAbsolute } from 'node:path'
import { createSecureContext } from 'node:tls'
import {
  type DatabaseConfiguration,
  readDatabaseConfiguration,
  readSecretInput
} from '@dfragon/database'
import { parsePort } from '@dfragon/lib/port'

const invalidConfiguration = 'Invalid API runtime configuration'

async function readLocalHttps(environment: NodeJS.ProcessEnv, port: number, apiOrigin: string) {
  const certPath = environment.LOCAL_HTTPS_CERT_FILE
  const keyPath = environment.LOCAL_HTTPS_KEY_FILE
  if (certPath === undefined && keyPath === undefined) {
    return undefined
  }

  if (
    certPath === undefined ||
    keyPath === undefined ||
    !isAbsolute(certPath) ||
    !isAbsolute(keyPath)
  ) {
    throw new Error(invalidConfiguration)
  }

  const localOrigins = [
    new URL(`https://localhost:${port}`).origin,
    new URL(`https://127.0.0.1:${port}`).origin
  ]
  if (!localOrigins.includes(apiOrigin)) {
    throw new Error(invalidConfiguration)
  }
  const cert = await readFile(certPath)
  const key = await readFile(keyPath)
  // PEM 파싱과 certificate/key 일치를 앱 시작 전에 확인한다.
  createSecureContext({ cert, key })

  return { cert, key }
}

function readOps(
  environment: NodeJS.ProcessEnv,
  port: number,
  database: DatabaseConfiguration | undefined
) {
  if (environment.OPS_PORT === undefined) {
    return undefined
  }
  const opsPort = parsePort(environment.OPS_PORT)
  if (opsPort === port || database === undefined) {
    throw new Error(invalidConfiguration)
  }

  return { port: opsPort, database }
}

export async function readRuntimeConfiguration(environment: NodeJS.ProcessEnv) {
  try {
    const port = parsePort(environment.PORT)
    const proxyMode = environment.SEARCH_TRUST_PROXY
    if (proxyMode !== undefined && proxyMode !== 'single-hop') {
      throw new Error(invalidConfiguration)
    }
    const trustedProxyHops = proxyMode === 'single-hop' ? (1 as const) : undefined
    const apiKey = readSecretInput(environment.NEOPLE_API_KEY, environment.NEOPLE_API_KEY_FILE)
    if (apiKey === undefined) {
      throw new Error(invalidConfiguration)
    }
    const database = readDatabaseConfiguration(environment)
    const ops = readOps(environment, port, database)
    const localHttps = await readLocalHttps(environment, port, environment.API_ORIGIN ?? '')
    const scoreLibraryPath = environment.SCORE_LIBRARY_FILE ?? null
    if (scoreLibraryPath !== null && !isAbsolute(scoreLibraryPath)) {
      throw new Error(invalidConfiguration)
    }

    return {
      port,
      trustedProxyHops,
      localHttps,
      apiKey,
      database,
      ops,
      scoreLibraryPath
    }
  } catch {
    // FS/JSON/crypto의 error와 cause는 파일 경로나 값을 포함할 수 있다.
    throw new Error(invalidConfiguration)
  }
}
