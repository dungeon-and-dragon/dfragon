import type { Server } from 'node:http'

export interface HttpAppHandle {
  listen(port: number, hostname?: string): Promise<void>
  getUrl(): Promise<string>
  close(): Promise<void>
  getHttpServer(): Server
}
