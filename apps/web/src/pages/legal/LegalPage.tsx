import { useId } from 'react'

const EFFECTIVE_DATE = '시행일: 2026년 11월 22일'
const CONTACT_EMAIL = 'me@dfragon.com'

export function TermsPage(): React.JSX.Element {
  return (
    <LegalPage title="이용약관">
      <ClauseSection
        title="서비스"
        clauses={[
          'Neople Open API로 받은 던전앤파이터 캐릭터 정보와 그 집계를 제공합니다.',
          '던전앤파이터에 관한 모든 저작권은 Neople에 있습니다.',
          'DFragon은 Neople의 제휴나 후원을 받지 않은 팬 사이트입니다.'
        ]}
      />
      <ClauseSection
        title="정보"
        clauses={[
          '캐릭터 정보는 실시간 정보와 다를 수 있습니다.',
          '장비점수, 버프점수는 DFragon이 계산한 값입니다.'
        ]}
      />
      <ClauseSection
        title="금지 행위"
        clauses={['자동화 도구로 대량 요청을 보내는 행위', '서비스 운영을 방해하는 행위']}
      />
      <ClauseSection
        title="변경과 중단"
        clauses={['기능은 예고 없이 바뀌거나 중단될 수 있습니다.']}
      />
      <ClauseSection
        title="책임"
        clauses={['고의 또는 중대한 과실이 없는 한 서비스 이용으로 생긴 손해를 책임지지 않습니다.']}
      />
      <FactSection title="문의" facts={[['이메일', <ContactLink key="contact" />]]} />
    </LegalPage>
  )
}

export function PrivacyPage(): React.JSX.Element {
  return (
    <LegalPage title="개인정보처리방침">
      <FactSection
        title="방문 통계"
        facts={[
          ['수집 도구', 'Google Analytics'],
          [
            '수집 항목',
            '페이지 주소와 제목, 이전 페이지, 스크롤과 링크 클릭 같은 화면 이용 기록, 브라우저와 기기 정보, 지역, 방문 시각, 쿠키에 저장한 방문자 ID'
          ],
          ['목적', '방문자 수와 화면별 이용 집계'],
          ['보관 기간', '14개월'],
          ['국외 이전', 'Google LLC(미국)'],
          [
            '거부 방법',
            <a
              key="opt-out"
              className="link underline"
              href="https://tools.google.com/dlpage/gaoptout"
            >
              Google Analytics 차단 부가 기능
            </a>
          ]
        ]}
      />
      <FactSection
        title="접속 기록"
        facts={[
          [
            '수집 항목',
            '요청 시각, 요청 주소(검색한 캐릭터 이름 포함), 브라우저 정보, 앞 두 자리만 보관한 IP 주소'
          ],
          ['목적', '장애 확인과 사용량 집계'],
          ['보관 기간', '90일']
        ]}
      />
      <ClauseSection
        title="안전성 확보조치"
        clauses={[
          '접속 기록은 운영자만 접근할 수 있는 서버에 보관합니다.',
          'IP 주소는 앞 두 자리만 보관합니다.'
        ]}
      />
      <ClauseSection title="파기" clauses={['보관 기간이 지난 기록은 자동으로 삭제합니다.']} />
      <ClauseSection
        title="권리 행사"
        clauses={['열람, 정정, 삭제, 처리 정지는 아래 이메일로 요청할 수 있습니다.']}
      />
      <FactSection
        title="개인정보 보호책임자"
        facts={[
          ['담당자', 'DFragon'],
          ['이메일', <ContactLink key="contact" />]
        ]}
      />
    </LegalPage>
  )
}

function ContactLink(): React.JSX.Element {
  return (
    <a className="link underline" href={`mailto:${CONTACT_EMAIL}`}>
      {CONTACT_EMAIL}
    </a>
  )
}

function ClauseSection({
  title,
  clauses
}: {
  title: string
  clauses: readonly string[]
}): React.JSX.Element {
  return (
    <LegalSection title={title}>
      <ul className="m-0 flex list-disc flex-col gap-1 ps-4">
        {clauses.map((clause) => (
          <li key={clause}>{clause}</li>
        ))}
      </ul>
    </LegalSection>
  )
}

function FactSection({
  title,
  facts
}: {
  title: string
  facts: ReadonlyArray<readonly [string, React.ReactNode]>
}): React.JSX.Element {
  return (
    <LegalSection title={title}>
      <dl className="m-0 grid grid-cols-[96px_minmax(0,1fr)] gap-x-4 gap-y-1">
        {facts.map(([term, description]) => (
          <div key={term} className="contents">
            <dt className="label">{term}</dt>
            <dd className="m-0">{description}</dd>
          </div>
        ))}
      </dl>
    </LegalSection>
  )
}

function LegalSection({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}): React.JSX.Element {
  const titleId = useId()

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-2">
      <h2 id={titleId} className="m-0 text-sm font-semibold">
        {title}
      </h2>
      {children}
    </section>
  )
}

function LegalPage({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}): React.JSX.Element {
  const titleId = useId()

  return (
    <article aria-labelledby={titleId} className="section">
      <h1 id={titleId} className="section-title">
        {title}
      </h1>
      <div className="flex flex-col gap-6 px-4 pt-4 text-sm">
        <p className="m-0 text-fg-muted">{EFFECTIVE_DATE}</p>
        {children}
      </div>
    </article>
  )
}
