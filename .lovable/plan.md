
# AI Wealth Management MVP 구현 계획

상세서.md 스펙 기반으로 회원/관리자/AI챗봇/가치평가 기능까지 1차에 모두 구현합니다.

## 1. 디자인 시스템 (Executive Wealth Console)
- **색상**: 네이비 잉크(#0F1728/#16233B) + 브론즈 골드(#C49A46) 강조, 라이트 테마 고정, 베이지 앱 배경(#F6F4EE)
- **타이포**: IBM Plex Sans KR(제목), Pretendard(본문), JetBrains Mono(숫자)
- **컴포넌트 토큰**: 라운드 8/12/18/24, 카드 그림자 최소화(보더 중심), 상태 색상(success/warning/error/info) 정의
- 모든 색상을 `src/styles.css`의 oklch 토큰으로 등록

## 2. 인증 & 권한
- Lovable Cloud 이메일/비밀번호 인증
- `profiles` 테이블 + `user_roles` 테이블(`user`/`admin` enum) 분리, `has_role()` security definer 함수
- 회원/관리자 라우트 가드 (`_authenticated`, `_authenticated/_admin`)
- 관리자 별도 로그인 페이지 `/admin/login`

## 3. 데이터베이스 (Supabase)
스펙의 엔티티를 그대로 매핑:
- `profiles`, `user_roles`
- `portfolios`, `portfolio_assets` (ticker, market US/KR, quantity, avg_price, currency, status)
- `price_snapshots` (모킹 시드 데이터로 시작)
- `valuation_rule_versions` (v1 기본 룰 시드)
- `valuation_results` (score, fair_value, gap_percent, band)
- `chat_intents` (raw_text, parsed_payload, confidence, status)
- `admin_audit_logs`
- 모든 테이블 RLS 적용 (본인 데이터만, 관리자는 has_role 통과)

## 4. 회원 화면 (앱 셸: 좌측 사이드바 264px + 헤더 72px)
- **`/`** 랜딩: Hero + 서비스 소개, 로그인 시 `/dashboard` 리다이렉트
- **`/login`, `/signup`**: 이메일 가입/로그인
- **`/dashboard`**: KPI 카드(총자산/일변동/종목수/현금가중치), 자산 비중 도넛, 가치평가 밴드 분포, 최근 챗봇 활동
- **`/portfolio/assets`**: 자산 테이블 (티커/종목명/수량/평단가/현재가/평가금액/손익률), 정렬/필터/CSV 내보내기
- **`/portfolio/assets/:id`**: 자산 상세 — 가격 추이 라인차트, 가치평가 결과(밴드/score/gap%/근거 코드), 수정/삭제
- **`/portfolio/valuation`**: 보유 종목별 fair_value vs current_price 비교 바차트, 밴드별 그룹핑
- **`/mypage`**: 프로필/비밀번호 변경/로그아웃

## 5. AI 챗봇 (Lovable AI Gateway)
- 회원 앱 셸 우하단 플로팅 버튼 → 채팅 패널
- 자연어 입력 → 서버 함수가 Lovable AI(google/gemini-3-flash-preview)에 **tool calling**으로 구조화 JSON 추출 (intentType / items / confidence)
- **확인 카드 흐름**: 파싱 결과를 카드로 표시 → 사용자 "확인" 클릭 시에만 DB 반영
- confidence < 0.85 또는 다중 매칭 시 자동 확정 차단, 삭제는 모달 1회
- 4개 인텐트: ADD_ASSET / UPDATE_ASSET / REMOVE_ASSET / QUERY_PORTFOLIO
- 429/402 에러 토스트 처리

## 6. 가치평가 엔진 (룰 v1, 시각화 중심)
- 룰 버전 테이블 기반, 입력(현재가/모의 EPS/PER)→ fair_value 계산
- 출력: score(0~100), gap_percent, band(UNDERVALUED/FAIR/OVERVALUED/UNKNOWN), reason_codes
- 자산 등록/수정 시 자동 재계산 트리거(서버 함수)

## 7. 시세 (모킹)
- `price_snapshots` 테이블에 주요 더미 종목(AAPL/MSFT/TSLA/005930/035720 등) 시드
- 1회 동기화 서버 함수: 랜덤 워크로 가격 갱신, `last_synced_at`/`is_stale` 표시
- 추후 Yahoo Finance 연동 가능한 구조로 분리

## 8. 관리자 화면 (사이드바 248px, 강조색 절제)
- **`/admin/login`**: 관리자 로그인
- **`/admin`**: 요약 KPI(가입자수/활성 자산수/오늘 챗봇 호출수/stale 종목수)
- **`/admin/users`**: 회원 목록, 상태(active/suspended) 변경, 감사로그 기록
- **`/admin/data`**:
  - 시세 동기화 상태 패널 + 수동 동기화 버튼
  - 가치평가 룰 버전 목록 / 활성 버전 전환

## 9. 공통/품질
- react-hook-form + zod 폼 검증
- TanStack Query로 서버 상태 캐싱, 자산 변경 시 대시보드/평가 invalidate
- Recharts로 차트
- 반응형(데스크톱 우선, 태블릿/모바일은 사이드바 드로어)
- 접근성: 라벨/포커스링/키보드 내비
- 토스트(Sonner)로 성공/에러 안내

## 구현 순서
1. 디자인 토큰 + 앱 셸/사이드바 + 라우팅 골격
2. DB 스키마 + RLS + 인증 + 역할
3. 회원 대시보드/자산 CRUD + 모킹 시세
4. 가치평가 엔진 + 시각화
5. AI 챗봇 (Lovable AI 서버 함수 + 확인 흐름)
6. 관리자 영역 + 감사 로그

승인하시면 위 순서대로 한 번에 구축하겠습니다.
