const NOT_UPLOADED_STATUS = 404

// 그림 경로는 데이터 파일 기준의 상대 경로라, 화면이 데이터 위치를 몰라도 되게 절대 주소로 바꿔 둔다.
export function absoluteUrl(path: string, fileUrl: string): string {
  return new URL(path, fileUrl).href
}

async function jsonOf(response: Response): Promise<unknown> {
  if (!response.ok) {
    throw new Error(`게임 데이터를 받지 못했습니다(HTTP ${response.status}).`)
  }

  return response.json()
}

export async function fetchStaticJson(url: string): Promise<unknown> {
  return jsonOf(await fetch(url))
}

// 스킬 창, 서약 데이터는 사이트 배포와 따로 올리므로, 아직 올리지 않은 곳은 실패가 아니라 데이터가 없는 상태다.
export async function fetchUploadedStaticJson(url: string): Promise<unknown> {
  const response = await fetch(url)
  if (response.status === NOT_UPLOADED_STATUS) {
    return null
  }

  return jsonOf(response)
}
