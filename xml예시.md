# AI-powered Wealth Management MVP XML 예시

아래 XML은 [상세서.md](<C:/Users/dbcdk/Desktop/AI-powered Wealth Management/상세서.md>)의 구조를 1:1로 매핑한 예시다. 테이블 항목은 반복 노드로 풀었고, 수치·문구·enum 값은 그대로 유지했다.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<aiPoweredWealthManagementSpec version="1.0" language="ko-KR">
  <documentMeta>
    <title>AI-powered Wealth Management MVP 상세 명세서</title>
    <purpose>개발 및 디자인 구현 기준 문서</purpose>
    <scope>회원 서비스, 관리자 서비스, AI 챗봇 자산 등록, 포트폴리오 대시보드, 가치평가 시각화, 외부 데이터 연동</scope>
    <status>구현 기준안</status>
    <changeRule>본 문서의 수치, 명칭, 상태값은 별도 승인 없으면 고정값으로 사용</changeRule>
  </documentMeta>

  <section id="1" name="documentPurpose">
    <rule>본 문서는 AI 기반 주식 자산 관리 핀테크 서비스 MVP의 화면, 동작, 데이터, UI 시스템, 예외 처리 기준을 고정한다.</rule>
    <rule>디자이너는 본 문서를 기준으로 화면 설계 파일을 작성한다.</rule>
    <rule>개발자는 본 문서를 기준으로 라우팅, API, 상태값, 컴포넌트, 반응형, 접근성, 관리자 기능을 구현한다.</rule>
    <rule>본 문서에 없는 항목은 임의 확장하지 않는다. 필요한 경우 변경 요청 항목으로 분리한다.</rule>
  </section>

  <section id="2" name="productScopeAndAssumptions">
    <goals>
      <goal>사용자가 자연어 채팅으로 보유 자산을 입력하면 시스템이 종목, 수량, 평균단가를 해석하여 포트폴리오에 등록 또는 수정한다.</goal>
      <goal>등록된 자산의 현재 가치와 구성 비중을 조회할 수 있어야 한다.</goal>
      <goal>클라이언트 고유 가치평가 로직을 엔진 형태로 적용하고 결과를 시각화할 수 있어야 한다.</goal>
      <goal>회원/관리자 기능을 통해 서비스 운영이 가능해야 한다.</goal>
    </goals>
    <mvpIncluded>
      <item>이메일 기반 회원가입, 로그인, 로그아웃, 마이페이지</item>
      <item>회원 포트폴리오 대시보드</item>
      <item>보유 자산 목록/상세/수정/삭제</item>
      <item>OpenAI 기반 자연어 자산 명령 해석</item>
      <item>Yahoo Finance 계열 시세 조회 연동</item>
      <item>가치평가 결과 시각화</item>
      <item>관리자 대시보드, 회원 관리, 데이터 동기화 상태 확인, 가치평가 규칙 버전 관리</item>
    </mvpIncluded>
    <mvpExcluded>
      <item>실제 주문/매매 실행</item>
      <item>증권사 계좌 직접 연동</item>
      <item>실시간 체결 데이터 보장</item>
      <item>세금 계산, 배당 스케줄, 재무제표 전문 분석</item>
      <item>소셜 로그인</item>
      <item>모바일 앱 네이티브 개발</item>
    </mvpExcluded>
    <uncertainInformation>
      <item certainty="none">클라이언트의 고유 가치평가 수식 자체는 현재 확실한 정보 없음.</item>
      <item certainty="fixed">따라서 본 문서는 가치평가 엔진의 입력값, 출력값, 버전 관리 구조, UI 표시 규칙만 고정한다.</item>
      <item certainty="fixed">Yahoo Finance는 공식 공개 엔터프라이즈 SLA가 명확하지 않으므로, MVP에서는 캐시와 장애 대체 표시를 필수로 둔다.</item>
    </uncertainInformation>
  </section>

  <section id="3" name="rolesAndPermissions">
    <roles>
      <role key="guest">
        <label>비회원</label>
        <description>인증 전 사용자</description>
        <accessibleScreens>
          <screen>랜딩</screen>
          <screen>로그인</screen>
          <screen>회원가입</screen>
        </accessibleScreens>
        <permissions>
          <permission>계정 생성</permission>
          <permission>로그인</permission>
        </permissions>
      </role>
      <role key="member">
        <label>회원</label>
        <description>일반 서비스 이용자</description>
        <accessibleScreens>
          <screen>대시보드</screen>
          <screen>자산</screen>
          <screen>가치평가</screen>
          <screen>마이페이지</screen>
        </accessibleScreens>
        <permissions>
          <permission>본인 자산 등록/수정/삭제</permission>
          <permission>챗봇 사용</permission>
          <permission>가치평가 조회</permission>
        </permissions>
      </role>
      <role key="admin">
        <label>관리자</label>
        <description>운영자</description>
        <accessibleScreens>
          <screen>관리자 로그인</screen>
          <screen>관리자 대시보드</screen>
          <screen>회원 관리</screen>
          <screen>데이터 관리</screen>
        </accessibleScreens>
        <permissions>
          <permission>회원 상태 변경</permission>
          <permission>시세 동기화 상태 조회</permission>
          <permission>가치평가 룰 버전 전환</permission>
        </permissions>
      </role>
    </roles>
  </section>

  <section id="4" name="recommendedTechnology">
    <frontend>
      <framework>Next.js App Router + React + TypeScript</framework>
      <styling>Tailwind CSS</styling>
      <stateManagement>
        <server>TanStack Query</server>
        <local>Zustand 또는 React Context</local>
      </stateManagement>
      <chart>Recharts 또는 동급 라이브러리</chart>
      <formValidation>react-hook-form + zod</formValidation>
    </frontend>
    <backend>
      <runtime>Node.js</runtime>
      <framework>Express + TypeScript</framework>
      <validation>Zod</validation>
      <authentication>JWT 또는 세션 쿠키 기반 인증</authentication>
      <recommendedPolicy>
        <accessToken ttl="15m"/>
        <refreshToken ttl="7d"/>
        <cookie httpOnly="true" secure="true" sameSite="lax"/>
      </recommendedPolicy>
    </backend>
    <dataAndInfrastructure>
      <mainDatabase>PostgreSQL 16</mainDatabase>
      <cache recommended="true">Redis</cache>
      <priceCacheTtl>
        <item type="장중 현재가" ttl="60s"/>
        <item type="장후 현재가" ttl="15m"/>
        <item type="일봉 차트" ttl="24h"/>
      </priceCacheTtl>
      <loggingAndErrorTracking>Sentry</loggingAndErrorTracking>
      <deployment>
        <web>Vercel 또는 동급</web>
        <api>AWS ECS/Fargate, Render, Railway 중 1개</api>
        <database>관리형 PostgreSQL</database>
      </deployment>
      <ci>GitHub Actions</ci>
    </dataAndInfrastructure>
    <integrations>
      <integration key="openai">
        <purpose>자연어 명령 해석</purpose>
        <implementation>구조화 JSON 출력 또는 함수 호출</implementation>
        <rule>모델 ID는 코드 하드코딩 금지, 환경 변수로 관리</rule>
      </integration>
      <integration key="yahooFinance">
        <purpose>종목 메타데이터, 시세, 과거 가격, 환율 페어 조회</purpose>
        <failurePolicy>마지막 캐시값 제공 + stale 상태 표시</failurePolicy>
      </integration>
    </integrations>
  </section>

  <section id="5" name="informationArchitectureAndRoutes">
    <routes>
      <route path="/" screenName="랜딩" access="guest,member" note="로그인 상태면 /dashboard로 리다이렉트"/>
      <route path="/login" screenName="로그인" access="guest" note="로그인 상태면 /dashboard"/>
      <route path="/signup" screenName="회원가입" access="guest" note="가입 완료 후 /dashboard"/>
      <route path="/dashboard" screenName="회원 대시보드" access="member" note="기본 진입 화면"/>
      <route path="/portfolio/assets" screenName="보유 자산 목록" access="member" note="테이블 중심"/>
      <route path="/portfolio/assets/:assetId" screenName="자산 상세" access="member" note="차트/가치평가 상세"/>
      <route path="/portfolio/valuation" screenName="가치평가" access="member" note="평가 결과/비교 시각화"/>
      <route path="/mypage" screenName="마이페이지" access="member" note="프로필/보안"/>
      <route path="/admin/login" screenName="관리자 로그인" access="admin" note="별도 진입"/>
      <route path="/admin" screenName="관리자 대시보드" access="admin" note="요약 통계"/>
      <route path="/admin/users" screenName="회원 관리" access="admin" note="조회/상태 변경"/>
      <route path="/admin/data" screenName="데이터 관리" access="admin" note="시세 동기화/가치평가 룰 버전"/>
    </routes>
    <memberAppShell>
      <leftFixedSidebar widthDesktopPx="264"/>
      <topHeader heightPx="72"/>
      <content maxWidthPx="1440" horizontalPaddingPx="32"/>
      <chatbotFloatingButton visibility="member-app-shell-only"/>
      <hiddenAreas>
        <area>로그인</area>
        <area>회원가입</area>
        <area>관리자 영역</area>
      </hiddenAreas>
    </memberAppShell>
    <adminAppShell>
      <leftFixedSidebar widthDesktopPx="248"/>
      <topHeader heightPx="64"/>
      <backgroundTone>회원 영역보다 더 중성 톤 사용</backgroundTone>
      <accentUsageLimit>관리자 영역은 회원 영역과 색상은 공유하되 강조색 사용량을 50% 이하로 제한</accentUsageLimit>
    </adminAppShell>
  </section>

  <section id="6" name="coreDataModel">
    <entities>
      <entity name="users">
        <field>id</field>
        <field>email</field>
        <field>password_hash</field>
        <field>name</field>
        <field>role</field>
        <field>status</field>
        <field>created_at</field>
        <field>last_login_at</field>
      </entity>
      <entity name="portfolios">
        <field>id</field>
        <field>user_id</field>
        <field>base_currency</field>
        <field>created_at</field>
        <field>updated_at</field>
      </entity>
      <entity name="portfolio_assets">
        <field>id</field>
        <field>portfolio_id</field>
        <field>ticker</field>
        <field>market</field>
        <field>asset_name</field>
        <field>quantity</field>
        <field>avg_price</field>
        <field>currency</field>
        <field>status</field>
        <field>last_price</field>
        <field>last_synced_at</field>
      </entity>
      <entity name="price_snapshots">
        <field>id</field>
        <field>ticker</field>
        <field>market</field>
        <field>price</field>
        <field>currency</field>
        <field>source</field>
        <field>captured_at</field>
        <field>is_stale</field>
      </entity>
      <entity name="valuation_results">
        <field>id</field>
        <field>asset_id</field>
        <field>rule_version_id</field>
        <field>score</field>
        <field>fair_value</field>
        <field>gap_percent</field>
        <field>band</field>
        <field>generated_at</field>
      </entity>
      <entity name="valuation_rule_versions">
        <field>id</field>
        <field>version_name</field>
        <field>status</field>
        <field>input_schema</field>
        <field>output_schema</field>
        <field>effective_at</field>
      </entity>
      <entity name="chat_intents">
        <field>id</field>
        <field>user_id</field>
        <field>raw_text</field>
        <field>intent_type</field>
        <field>parsed_payload</field>
        <field>confidence</field>
        <field>status</field>
        <field>confirmed_at</field>
      </entity>
      <entity name="admin_audit_logs">
        <field>id</field>
        <field>admin_user_id</field>
        <field>action_type</field>
        <field>target_type</field>
        <field>target_id</field>
        <field>payload</field>
        <field>created_at</field>
      </entity>
    </entities>
    <assetInputFieldRules>
      <field name="ticker" type="string" rule="대문자 저장, 공백 제거"/>
      <field name="market" type="enum" values="US,KR"/>
      <field name="quantity" type="decimal(18,4)" rule="0 초과, 소수 4자리까지"/>
      <field name="avg_price" type="decimal(18,4)" rule="0 이상, 미입력 허용"/>
      <field name="currency" type="enum" values="USD,KRW"/>
      <field name="status" type="enum" values="ACTIVE,ARCHIVED,ERROR"/>
    </assetInputFieldRules>
    <valuationOutputSchema>
      <field name="score" type="number" description="0~100, 높을수록 저평가 또는 기준 충족"/>
      <field name="fair_value" type="decimal" description="엔진 계산 적정가"/>
      <field name="gap_percent" type="number" description="(fair_value - current_price) / current_price * 100"/>
      <field name="band" type="enum" values="UNDERVALUED,FAIR,OVERVALUED,UNKNOWN"/>
      <field name="reason_codes" type="string[]" description="룰 엔진 설명 코드"/>
    </valuationOutputSchema>
  </section>

  <section id="7" name="aiChatbotInterpretationSpec">
    <supportedIntents>
      <intent code="ADD_ASSET" description="신규 자산 추가" example="애플 주식 10주 보유"/>
      <intent code="UPDATE_ASSET" description="기존 자산 수량/단가 수정" example="애플 5주 더 샀어"/>
      <intent code="REMOVE_ASSET" description="자산 제거" example="테슬라 전량 매도"/>
      <intent code="QUERY_PORTFOLIO" description="포트폴리오 질의" example="내 포트폴리오 비중 보여줘"/>
    </supportedIntents>
    <openAiOutputSchemaExample>
      <intentType>ADD_ASSET</intentType>
      <confidence>0.94</confidence>
      <requiresConfirmation>true</requiresConfirmation>
      <items>
        <item>
          <ticker>AAPL</ticker>
          <assetName>Apple Inc.</assetName>
          <market>US</market>
          <quantity>10</quantity>
          <avgPrice nil="true"/>
          <currency>USD</currency>
        </item>
      </items>
      <warnings/>
    </openAiOutputSchemaExample>
    <confirmationRules>
      <rule expression="confidence &lt; 0.85">자동 확정 금지, 확인 단계 강제</rule>
      <rule>종목 코드가 다중 매칭되면 사용자가 선택할 때까지 저장 금지</rule>
      <rule>수량 누락 시 저장 금지</rule>
      <rule>평균단가 누락은 저장 가능하나 UI에 미입력 표시</rule>
      <rule>삭제 명령은 항상 확인 모달 1회 추가</rule>
    </confirmationRules>
    <commitFlow>
      <step order="1">사용자가 메시지 입력</step>
      <step order="2">서버가 OpenAI로 파싱 요청</step>
      <step order="3">파싱 결과를 확인 카드로 렌더링</step>
      <step order="4">사용자가 확인 클릭 시 DB 반영</step>
      <step order="5">DB 반영 후 현재가 재조회</step>
      <step order="6">대시보드 캐시 무효화 후 새 값 반영</step>
    </commitFlow>
  </section>

  <section id="8" name="designSystem">
    <visualDirection>
      <concept>Executive Wealth Console</concept>
      <tone>고급 자산관리 콘솔, 차갑고 신뢰감 있는 네이비 기반, 포인트는 브론즈 골드</tone>
      <baseTheme>라이트 테마 고정</baseTheme>
      <darkMode>MVP 범위 제외</darkMode>
    </visualDirection>
    <colorPalette>
      <token name="--color-bg-app" value="#F6F4EE" usage="전체 앱 배경"/>
      <token name="--color-bg-surface" value="#FFFFFF" usage="카드/모달/패널"/>
      <token name="--color-bg-subtle" value="#F1EEE7" usage="섹션 구분 배경"/>
      <token name="--color-ink-900" value="#0F1728" usage="주요 텍스트, 사이드바 배경"/>
      <token name="--color-ink-800" value="#16233B" usage="Primary 버튼 배경"/>
      <token name="--color-ink-700" value="#223554" usage="헤더/서브 강조"/>
      <token name="--color-line" value="#D6DEE8" usage="기본 보더"/>
      <token name="--color-line-strong" value="#B8C4D3" usage="활성 테두리"/>
      <token name="--color-text-primary" value="#111827" usage="본문 텍스트"/>
      <token name="--color-text-secondary" value="#4B5565" usage="보조 텍스트"/>
      <token name="--color-text-muted" value="#7A8696" usage="캡션"/>
      <token name="--color-accent-gold" value="#C49A46" usage="핵심 지표 강조, 활성 탭 하이라이트"/>
      <token name="--color-success" value="#138A6B" usage="상승, 성공"/>
      <token name="--color-warning" value="#B7791F" usage="경고"/>
      <token name="--color-danger" value="#C84B41" usage="하락, 삭제, 오류"/>
      <token name="--color-info" value="#2C6BED" usage="정보, 포커스"/>
    </colorPalette>
    <statusColorRules>
      <status name="Success" background="#EAF7F2" text="#116D56" usage="저장 성공, 상승률"/>
      <status name="Warning" background="#FFF5E7" text="#9A6115" usage="stale 데이터, 주의"/>
      <status name="Error" background="#FCECEA" text="#A63E35" usage="실패, 삭제 경고"/>
      <status name="Info" background="#EAF1FF" text="#1F56C2" usage="동기화 중, 안내"/>
    </statusColorRules>
    <fontSystem>
      <font role="Heading" family="IBM Plex Sans KR" usage="페이지 제목, 카드 제목"/>
      <font role="Body" family="SUIT Variable, Pretendard Variable, Noto Sans KR, sans-serif" usage="본문, 라벨, 버튼"/>
      <font role="Numeric" family="IBM Plex Mono, JetBrains Mono, monospace" usage="금액, 수량, 비율, 차트 툴팁"/>
    </fontSystem>
    <typographyScale>
      <style name="display-lg" sizeLineHeight="32/40" weight="700" usage="랜딩 Hero 제목"/>
      <style name="heading-xl" sizeLineHeight="28/36" weight="700" usage="페이지 제목"/>
      <style name="heading-lg" sizeLineHeight="24/32" weight="700" usage="섹션 제목"/>
      <style name="heading-md" sizeLineHeight="20/28" weight="600" usage="카드 제목"/>
      <style name="body-lg" sizeLineHeight="16/24" weight="500" usage="본문 강조"/>
      <style name="body-md" sizeLineHeight="14/22" weight="400" usage="기본 본문"/>
      <style name="body-sm" sizeLineHeight="13/20" weight="400" usage="보조 설명"/>
      <style name="caption" sizeLineHeight="12/18" weight="500" usage="메타데이터, 헬퍼 텍스트"/>
    </typographyScale>
    <spacingAndRadius>
      <token name="--space-4" value="4px"/>
      <token name="--space-8" value="8px"/>
      <token name="--space-12" value="12px"/>
      <token name="--space-16" value="16px"/>
      <token name="--space-20" value="20px"/>
      <token name="--space-24" value="24px"/>
      <token name="--space-32" value="32px"/>
      <token name="--space-40" value="40px"/>
      <token name="--radius-sm" value="8px"/>
      <token name="--radius-md" value="12px"/>
      <token name="--radius-lg" value="18px"/>
      <token name="--radius-xl" value="24px"/>
    </spacingAndRadius>
    <shadowRules>
      <shadow target="기본 카드" value="0 8px 24px rgba(15, 23, 40, 0.06)"/>
      <shadow target="모달" value="0 24px 64px rgba(15, 23, 40, 0.20)"/>
      <shadow target="플로팅 버튼" value="0 18px 32px rgba(15, 23, 40, 0.24)"/>
      <rule>큰 그림자 사용 금지. 카드 계층은 그림자보다 보더와 배경색으로 구분한다.</rule>
    </shadowRules>
  </section>

  <section id="9" name="layoutRules">
    <gridRules>
      <breakpoint name="desktop" range="1280px 이상" columns="12" gutterPx="24"/>
      <breakpoint name="notebook" range="1024px ~ 1279px" columns="12" gutterPx="20"/>
      <breakpoint name="tablet" range="768px ~ 1023px" columns="8" gutterPx="16"/>
      <breakpoint name="mobile" range="360px ~ 767px" columns="4" gutterPx="16"/>
    </gridRules>
    <appWidthRules>
      <contentMaxWidth px="1440"/>
      <dashboardKpiCardMinWidth px="220"/>
      <dataTableMinWidth px="960" fallback="그 이하에서는 가로 스크롤 허용"/>
    </appWidthRules>
    <screenSpacingRules>
      <padding target="데스크톱 본문" px="32"/>
      <padding target="태블릿 본문" px="24"/>
      <padding target="모바일 본문" px="16"/>
      <sectionGap px="24"/>
      <cardInnerPadding desktopPx="24" mobilePx="16"/>
    </screenSpacingRules>
    <sidebarRules>
      <expandedWidth px="264"/>
      <collapsedWidth px="88"/>
      <iconSize px="20"/>
      <menuItemHeight px="44"/>
      <activeMenuStyle>좌측 3px 골드 바 + 잉크 배경색 강조</activeMenuStyle>
    </sidebarRules>
  </section>

  <section id="10" name="commonComponentSpec">
    <buttons>
      <button type="Primary" heightPx="44" horizontalPaddingPx="16" background="#16233B" text="#FFFFFF" rule="기본 액션"/>
      <button type="Secondary" heightPx="44" horizontalPaddingPx="16" background="#FFFFFF" text="#16233B" rule="1px 보더 필수"/>
      <button type="Tertiary" heightPx="40" horizontalPaddingPx="12" background="transparent" text="#16233B" rule="텍스트 중심"/>
      <button type="Danger" heightPx="44" horizontalPaddingPx="16" background="#C84B41" text="#FFFFFF" rule="삭제/정지"/>
      <button type="Icon" heightPx="40" horizontalPaddingPx="0" background="#FFFFFF" text="#16233B" rule="정사각형, 1px 보더"/>
      <states>
        <hover>명도 -6%</hover>
        <active>명도 -10%</active>
        <disabled>opacity 0.4, pointer-events 없음</disabled>
        <focus>2px 외곽선 #2C6BED</focus>
      </states>
    </buttons>
    <inputField>
      <height px="44"/>
      <background>#FFFFFF</background>
      <border>1px solid #D6DEE8</border>
      <radius px="12"/>
      <horizontalPadding px="12"/>
      <labelSpacingTop px="6"/>
      <helperOrErrorText sizePx="12" marginTopPx="6"/>
      <rules>
        <rule>라벨은 항상 입력창 위에 배치</rule>
        <rule>필수값은 라벨 우측에 * 표기, 색상 #C84B41</rule>
        <rule>숫자 입력은 우측 정렬</rule>
        <rule>에러 시 보더 #C84B41, 보조 텍스트 동일 색상</rule>
        <rule>성공 체크 아이콘 자동 노출 금지</rule>
      </rules>
    </inputField>
    <selectAndAutocomplete>
      <inputHeight px="44"/>
      <dropdownMaxHeight px="280"/>
      <optionRowHeight px="40"/>
      <searchAutocompleteUsage>종목 검색에서 사용</searchAutocompleteUsage>
      <searchResultTemplate>
        <line order="1">AAPL + Apple Inc.</line>
        <line order="2">NASDAQ / USD</line>
      </searchResultTemplate>
    </selectAndAutocomplete>
    <cards>
      <base background="#FFFFFF" radiusPx="18" border="1px solid #D6DEE8" paddingPx="24" titleGapPx="16"/>
      <type name="KPI 카드" fixedHeightPx="132"/>
      <type name="차트 카드" minHeightPx="360"/>
      <type name="리스트 카드" height="auto" header="fixed"/>
    </cards>
    <table>
      <headerHeight px="44"/>
      <rowHeight px="52"/>
      <cellHorizontalPadding px="12"/>
      <headerBackground>#F8FAFC</headerBackground>
      <hoverBackground>#F4F7FB</hoverBackground>
      <rowBorder>1px solid #EEF2F6</rowBorder>
      <rules>
        <rule>숫자 열은 우측 정렬</rule>
        <rule>상태 열은 배지 사용</rule>
        <rule>헤더는 sticky 적용</rule>
        <rule>정렬 가능한 컬럼은 헤더 우측 12px 정렬 아이콘 노출</rule>
      </rules>
    </table>
    <badges>
      <badge key="ACTIVE" text="사용 중" colorRule="Success"/>
      <badge key="STALE" text="지연 데이터" colorRule="Warning"/>
      <badge key="ERROR" text="오류" colorRule="Error"/>
      <badge key="SYNCING" text="동기화 중" colorRule="Info"/>
      <badge key="SUSPENDED" text="정지" colorRule="Error"/>
    </badges>
    <modal>
      <size name="Small" widthPx="480"/>
      <size name="Medium" widthPx="720"/>
      <size name="Large" widthPx="960"/>
      <rules>
        <rule>상단 헤더 56px</rule>
        <rule>본문 패딩 24px</rule>
        <rule>하단 액션 바 고정</rule>
        <rule>오버레이 색상 rgba(15, 23, 40, 0.48)</rule>
        <rule>ESC 닫기 지원</rule>
        <rule>포커스 트랩 필수</rule>
      </rules>
    </modal>
    <drawer>
      <animation>우측 슬라이드 인</animation>
      <width px="480"/>
      <usage>자산 편집, 상세 보조 정보에 사용</usage>
      <tabletFallback>태블릿 이하에서는 전체 화면 시트로 전환</tabletFallback>
    </drawer>
    <toast>
      <position>우상단</position>
      <width px="360"/>
      <autoClose>
        <success seconds="4"/>
        <info seconds="5"/>
        <error manualCloseOnly="true"/>
      </autoClose>
      <maxVisible count="3"/>
    </toast>
    <chart>
      <commonRules>
        <rule>기본 높이 320px</rule>
        <rule>Y축 라벨 12px</rule>
        <rule>툴팁은 수치와 날짜를 동일 줄에 배치하지 않는다</rule>
        <rule>색상 수는 5개 이하</rule>
        <rule>금액 데이터는 font-variant-numeric: tabular-nums</rule>
      </commonRules>
      <types>
        <type name="포트폴리오 추이">면적 포함 라인 차트</type>
        <type name="자산 비중">도넛 차트</type>
        <type name="가치평가 비교">세로 막대 차트</type>
      </types>
    </chart>
    <chatbotFloatingButton>
      <size widthPx="64" heightPx="64"/>
      <position rightPx="24" bottomPx="24"/>
      <background>#16233B</background>
      <iconSize px="24"/>
      <badge>10px 원형, #C49A46</badge>
      <visibilityRules>
        <rule>회원 페이지에서만 노출</rule>
        <rule>스크롤해도 고정</rule>
        <rule>모바일에서는 56x56px</rule>
      </visibilityRules>
    </chatbotFloatingButton>
    <chatbotPanel>
      <width px="420"/>
      <maxHeight px="680"/>
      <headerHeight px="64"/>
      <inputAreaMinHeight px="84"/>
      <messageGap px="12"/>
      <structure>
        <part order="1">헤더: 제목, 연결 상태, 닫기</part>
        <part order="2">본문: 대화 버블, 확인 카드, 시스템 안내</part>
        <part order="3">입력부: 텍스트 입력, 전송 버튼, 예시 프롬프트 2개</part>
      </structure>
    </chatbotPanel>
  </section>

  <section id="11" name="globalStateDefinitions">
    <serverRequestStates>
      <state key="idle" meaning="미요청" ui="빈 상태"/>
      <state key="loading" meaning="최초 로딩" ui="스켈레톤"/>
      <state key="refreshing" meaning="재조회" ui="기존 값 유지 + 우상단 로더"/>
      <state key="success" meaning="성공" ui="데이터 표시"/>
      <state key="empty" meaning="데이터 없음" ui="empty state 표시"/>
      <state key="error" meaning="실패" ui="에러 패널 표시"/>
    </serverRequestStates>
    <authenticationStates>
      <state key="anonymous" meaning="비로그인"/>
      <state key="authenticated" meaning="로그인 유지"/>
      <state key="expired" meaning="세션 만료"/>
      <state key="locked" meaning="관리자 잠금"/>
    </authenticationStates>
    <assetStates>
      <state key="ACTIVE" meaning="정상 보유" badge="사용 중"/>
      <state key="ARCHIVED" meaning="사용자가 제거" badge="보관됨"/>
      <state key="ERROR" meaning="데이터 불일치" badge="오류"/>
    </assetStates>
    <priceStates>
      <state key="LIVE" meaning="최신 시세" displayRule="기본 표시"/>
      <state key="CACHED" meaning="캐시 시세" displayRule="시세 시간 표기"/>
      <state key="STALE" meaning="지연 시세" displayRule="Warning 배지"/>
      <state key="FAILED" meaning="조회 실패" displayRule="마지막 성공 값 + 오류 배지"/>
    </priceStates>
    <chatIntentStates>
      <state key="PARSING" meaning="모델 해석 중"/>
      <state key="CONFIRM_REQUIRED" meaning="사용자 확인 필요"/>
      <state key="COMMITTING" meaning="DB 반영 중"/>
      <state key="DONE" meaning="완료"/>
      <state key="FAILED" meaning="처리 실패"/>
    </chatIntentStates>
    <valuationStates>
      <state key="PENDING" meaning="계산 대기"/>
      <state key="COMPLETED" meaning="계산 완료"/>
      <state key="PARTIAL" meaning="일부 자산 계산 성공"/>
      <state key="FAILED" meaning="계산 실패"/>
      <state key="UNKNOWN" meaning="룰 미정의"/>
    </valuationStates>
  </section>

  <section id="12" name="userFlows">
    <flow key="signup">
      <step order="1">사용자는 /signup 진입</step>
      <step order="2">이름, 이메일, 비밀번호, 비밀번호 확인 입력</step>
      <step order="3">프런트에서 형식 검증</step>
      <step order="4">서버 성공 시 자동 로그인</step>
      <step order="5">첫 진입 사용자는 /dashboard로 이동</step>
      <step order="6">포트폴리오가 비어 있으면 챗봇 온보딩 카드 자동 노출</step>
    </flow>
    <flow key="chatbotAssetRegistration">
      <step order="1">사용자가 챗봇 버튼 클릭</step>
      <step order="2">예시 메시지 또는 직접 입력</step>
      <step order="3">시스템이 파싱 결과 카드 표시</step>
      <step order="4">사용자가 확인 시 저장</step>
      <step order="5">대시보드 KPI, 자산 목록, 가치평가 영역 동시 갱신</step>
    </flow>
    <flow key="assetModification">
      <step order="1">자산 목록에서 행 클릭</step>
      <step order="2">상세 페이지 또는 편집 드로어 진입</step>
      <step order="3">수량, 평균단가 수정</step>
      <step order="4">저장 시 즉시 시세 재계산</step>
      <step order="5">값 변경 이력은 admin_audit_logs에 남기지 않고 사용자 액션 로그 테이블 별도 확장 가능</step>
    </flow>
    <flow key="adminValuationRuleSwitch">
      <step order="1">관리자가 /admin/data 진입</step>
      <step order="2">활성 룰 버전 확인</step>
      <step order="3">신규 버전을 Draft에서 Active로 전환</step>
      <step order="4">시스템이 재계산 작업 큐 시작</step>
      <step order="5">완료 후 모든 자산 평가 결과 갱신</step>
    </flow>
  </section>

  <section id="13" name="screenSpecifications">
    <screen key="landing" path="/">
      <purpose>서비스 소개와 로그인/회원가입 진입</purpose>
      <header heightPx="72">
        <left>로고</left>
        <right>
          <action>로그인</action>
          <action>회원가입</action>
        </right>
      </header>
      <hero>
        <left columns="7">제목, 서브카피, CTA 2개</left>
        <right columns="5">대시보드 미리보기 목업</right>
      </hero>
      <bodySections>
        <sectionName>AI 자산 등록</sectionName>
        <sectionName>포트폴리오 추적</sectionName>
        <sectionName>가치평가 시각화</sectionName>
      </bodySections>
      <footer>회사명, 문의 이메일, 약관 링크 2개</footer>
      <ctaRules>
        <primary>지금 시작하기</primary>
        <secondary>데모 보기</secondary>
      </ctaRules>
    </screen>

    <screen key="login" path="/login">
      <formWidth px="420"/>
      <inputs>
        <input>이메일</input>
        <input>비밀번호</input>
      </inputs>
      <actions>
        <primary>로그인</primary>
        <secondaryLink>회원가입</secondaryLink>
      </actions>
      <errorMessages>
        <message type="invalidCredentials">이메일 또는 비밀번호가 일치하지 않습니다.</message>
        <message type="lockedAccount">관리자에 의해 접근이 제한되었습니다.</message>
      </errorMessages>
    </screen>

    <screen key="signup" path="/signup">
      <formWidth px="480"/>
      <inputOrder>
        <field order="1">이름</field>
        <field order="2">이메일</field>
        <field order="3">비밀번호</field>
        <field order="4">비밀번호 확인</field>
      </inputOrder>
      <passwordRules>
        <rule>최소 8자</rule>
        <rule>영문/숫자 조합 필수</rule>
      </passwordRules>
      <successMessage>가입이 완료되었습니다. 포트폴리오를 설정해보세요.</successMessage>
    </screen>

    <screen key="dashboard" path="/dashboard">
      <purpose>전체 자산 요약, 시세 반영 결과, 가치평가 상태 한 번에 조회</purpose>
      <topBar>
        <left>페이지 제목 포트폴리오 대시보드</left>
        <right>
          <action>자산 추가</action>
          <action>내보내기</action>
        </right>
      </topBar>
      <row index="1" type="kpi">
        <card>총 평가금액</card>
        <card>총 손익</card>
        <card>오늘 변동</card>
        <card>가치평가 평균 점수</card>
      </row>
      <row index="2">
        <left columns="8">포트폴리오 가치 추이 라인 차트</left>
        <right columns="4">자산 비중 도넛 차트</right>
      </row>
      <row index="3">
        <left columns="8">보유 자산 Top 5</left>
        <right columns="4">가치평가 알림</right>
      </row>
      <bottom>최근 등록/수정 내역 리스트 5건</bottom>
      <kpiCardRules>
        <rule>라벨은 상단 좌측</rule>
        <rule>수치는 IBM Plex Mono</rule>
        <rule>전일 대비는 수치 아래 12px 메타 행으로 배치</rule>
        <rule>상승은 초록, 하락은 빨강, 보합은 회색이 아닌 #7A8696</rule>
      </kpiCardRules>
      <emptyState>
        <condition>자산이 없으면 KPI 카드 대신 온보딩 카드 1개 표시</condition>
        <text>아직 등록된 자산이 없습니다. 챗봇으로 보유 종목을 먼저 등록하세요.</text>
        <cta>AI로 자산 등록</cta>
      </emptyState>
    </screen>

    <screen key="assetsList" path="/portfolio/assets">
      <topArea>
        <title>보유 자산</title>
        <searchInput widthPx="280"/>
        <filters>
          <filter>시장</filter>
          <filter>상태</filter>
          <filter>가치평가 밴드</filter>
        </filters>
        <actions>
          <action>AI로 등록</action>
          <action>수동 등록</action>
        </actions>
      </topArea>
      <tableColumns>
        <column>종목명</column>
        <column>티커</column>
        <column>시장</column>
        <column>보유수량</column>
        <column>평균단가</column>
        <column>현재가</column>
        <column>평가금액</column>
        <column>손익률</column>
        <column>가치평가</column>
        <column>상태</column>
        <column>수정일</column>
      </tableColumns>
      <rowClickAction>상세 페이지 이동</rowClickAction>
      <sortDropdown default="평가금액 내림차순 기본"/>
      <manualRegistrationModal>
        <field>종목 검색</field>
        <field>시장</field>
        <field>보유수량</field>
        <field>평균단가</field>
        <postSave>저장 후 목록 새로고침</postSave>
      </manualRegistrationModal>
    </screen>

    <screen key="assetDetail" path="/portfolio/assets/:assetId">
      <summaryCard>
        <left>종목명, 티커, 시장, 상태 배지</left>
        <right>현재가, 평가금액, 손익률</right>
      </summaryCard>
      <body columns="2">
        <left columns="8">
          <item>가격 추이 차트</item>
          <item>보유 정보 카드</item>
        </left>
        <right columns="4">
          <item>가치평가 결과 카드</item>
          <item>메타데이터 카드</item>
        </right>
      </body>
      <holdingInfoCard>
        <field>수량</field>
        <field>평균단가</field>
        <field>통화</field>
        <field>마지막 시세 반영 시간</field>
      </holdingInfoCard>
      <valuationCard>
        <field>점수</field>
        <field>적정가</field>
        <field>괴리율</field>
        <field>밴드</field>
        <field>설명 코드 목록 3개까지</field>
      </valuationCard>
      <actions>
        <action>편집</action>
        <action>삭제</action>
      </actions>
      <deleteRules>
        <rule>삭제는 soft delete</rule>
        <confirmationMessage>이 자산을 포트폴리오에서 제거합니다. 삭제 후에도 감사 로그는 유지됩니다.</confirmationMessage>
      </deleteRules>
    </screen>

    <screen key="valuation" path="/portfolio/valuation">
      <purpose>가치평가 엔진 결과를 자산 단위/포트폴리오 단위로 해석</purpose>
      <topBar>
        <title>가치평가</title>
        <filters>
          <filter>시장</filter>
          <filter>밴드</filter>
          <filter>점수 구간</filter>
        </filters>
      </topBar>
      <row index="1" type="cards">
        <card>평균 점수</card>
        <card>저평가 자산 수</card>
        <card>룰 버전</card>
      </row>
      <row index="2">
        <left columns="7">자산별 점수 막대 차트</left>
        <right columns="5">밴드 분포 도넛 차트</right>
      </row>
      <row index="3">
        <content>평가 테이블</content>
      </row>
      <valuationTableColumns>
        <column>종목명</column>
        <column>현재가</column>
        <column>적정가</column>
        <column>괴리율</column>
        <column>점수</column>
        <column>밴드</column>
        <column>계산시각</column>
      </valuationTableColumns>
      <rules>
        <rule>UNKNOWN 밴드는 항상 테이블 하단 정렬</rule>
        <rule>평가 실패 자산은 별도 섹션으로 분리</rule>
      </rules>
    </screen>

    <screen key="mypage" path="/mypage">
      <sectionGroup name="기본 정보">
        <field>이름</field>
        <field>이메일</field>
        <field>가입일</field>
      </sectionGroup>
      <sectionGroup name="보안">
        <field>비밀번호 변경</field>
        <field>최근 로그인 시각</field>
      </sectionGroup>
      <sectionGroup name="환경 설정">
        <field>기준 통화</field>
        <field>데이터 새로고침 기본 주기 표시 전용</field>
      </sectionGroup>
      <sectionGroup name="계정 작업">
        <field>로그아웃</field>
        <field>회원 탈퇴</field>
      </sectionGroup>
      <withdrawalRules>
        <rule>2단계 확인</rule>
        <rule>탈퇴 즉시 로그인 세션 폐기</rule>
        <rule>포트폴리오 데이터는 30일 soft delete 후 파기</rule>
      </withdrawalRules>
    </screen>

    <screen key="commonChatbotPanel" path="global-member-pages">
      <openTrigger>모든 회원 페이지 우하단 플로팅 버튼 클릭으로 열림</openTrigger>
      <defaultGuide>보유 자산을 자연어로 입력하세요. 예: 애플 주식 10주 보유</defaultGuide>
      <recommendedPrompts>
        <prompt>애플 주식 10주 보유</prompt>
        <prompt>테슬라 3주 추가 매수</prompt>
      </recommendedPrompts>
      <messageTypes>
        <type>사용자 메시지</type>
        <type>시스템 메시지</type>
        <type>확인 카드</type>
        <type>오류 메시지</type>
      </messageTypes>
      <confirmationCard>
        <title>등록 내용을 확인하세요</title>
        <item>종목명/티커</item>
        <item>수량</item>
        <item>평균단가</item>
        <item>시장</item>
        <buttons>
          <button>확인 후 저장</button>
          <button>수정</button>
          <button>취소</button>
        </buttons>
      </confirmationCard>
      <errorMessageTypes>
        <type>종목 미식별</type>
        <type>수량 누락</type>
        <type>처리 중 네트워크 오류</type>
        <type>외부 데이터 조회 실패</type>
      </errorMessageTypes>
    </screen>

    <screen key="adminLogin" path="/admin/login">
      <separateFromMemberLogin>true</separateFromMemberLogin>
      <formWidth px="420"/>
      <title>관리자 로그인</title>
      <invalidRoleMessage>관리자 권한이 없는 계정입니다.</invalidRoleMessage>
    </screen>

    <screen key="adminDashboard" path="/admin">
      <kpiCards>
        <card>총 회원 수</card>
        <card>활성 회원 수</card>
        <card>오늘 챗봇 파싱 성공률</card>
        <card>외부 데이터 장애 건수</card>
      </kpiCards>
      <row index="2">
        <left columns="8">일별 가입/활성 추이</left>
        <right columns="4">시스템 상태 카드</right>
      </row>
      <systemStatusCardItems>
        <item>OpenAI API</item>
        <item>Yahoo Finance 조회</item>
        <item>가치평가 작업 큐</item>
        <item>DB 연결</item>
      </systemStatusCardItems>
    </screen>

    <screen key="adminUsers" path="/admin/users">
      <topFilters>
        <filter>검색</filter>
        <filter>상태</filter>
        <filter>가입일 기간</filter>
      </topFilters>
      <tableColumns>
        <column>회원명</column>
        <column>이메일</column>
        <column>가입일</column>
        <column>최근 로그인</column>
        <column>보유 자산 수</column>
        <column>상태</column>
        <column>액션</column>
      </tableColumns>
      <actionMenu>
        <item>상세 보기</item>
        <item>정지</item>
        <item>활성화</item>
      </actionMenu>
      <suspensionRules>
        <rule>정지 즉시 로그인 차단</rule>
        <rule>기존 세션 강제 만료</rule>
        <rule>이유 입력 모달 필수</rule>
      </suspensionRules>
    </screen>

    <screen key="adminData" path="/admin/data">
      <sectionGroup name="시세 동기화 상태">
        <item>마지막 성공 시각</item>
        <item>현재 실패 건수</item>
        <item>강제 재동기화 버튼</item>
      </sectionGroup>
      <sectionGroup name="가치평가 룰 버전">
        <item>버전명</item>
        <item>상태</item>
        <item>적용 시작 시각</item>
        <item>설명</item>
      </sectionGroup>
      <sectionGroup name="시스템 작업 로그">
        <item>최근 20건</item>
      </sectionGroup>
      <ruleVersionStates>
        <state>DRAFT</state>
        <state>ACTIVE</state>
        <state>DEPRECATED</state>
      </ruleVersionStates>
      <transitionRules>
        <rule>동시에 ACTIVE는 1개만 허용</rule>
        <confirmationMessage>활성 룰을 변경하면 모든 가치평가 결과가 재계산됩니다. 계속하시겠습니까?</confirmationMessage>
      </transitionRules>
    </screen>
  </section>

  <section id="14" name="responsiveRules">
    <breakpoint name="desktop" range="1440px 이상">
      <rule>사이드바 고정</rule>
      <rule>KPI 4열</rule>
      <rule>차트 2열 구성 유지</rule>
    </breakpoint>
    <breakpoint name="notebook" range="1024px ~ 1439px">
      <rule>KPI 2x2</rule>
      <rule>상세 페이지 우측 패널 높이 자동</rule>
      <rule>자산 목록 상단 필터는 2줄 허용</rule>
    </breakpoint>
    <breakpoint name="tablet" range="768px ~ 1023px">
      <rule>사이드바는 오프캔버스 드로어</rule>
      <rule>차트는 세로 스택</rule>
      <rule>챗봇 패널 폭 100%, 높이 80vh</rule>
    </breakpoint>
    <breakpoint name="mobile" range="360px ~ 767px">
      <rule>회원 기능은 사용 가능해야 하나 우선순위는 조회와 등록</rule>
      <rule>테이블은 카드 리스트로 변환하지 않는다. 핵심 컬럼만 남기고 가로 스크롤 허용</rule>
      <rule>KPI는 1열</rule>
      <rule>챗봇은 전체 화면 시트</rule>
    </breakpoint>
  </section>

  <section id="15" name="accessibilityPrinciples">
    <rule>모든 텍스트 대비는 WCAG AA 기준 4.5:1 이상</rule>
    <rule>키보드만으로 전 기능 접근 가능해야 한다</rule>
    <rule>포커스 링은 제거 금지</rule>
    <rule>아이콘 버튼은 aria-label 필수</rule>
    <rule>모달/드로어 열림 시 포커스 이동 필수</rule>
    <rule>토스트는 aria-live="polite"</rule>
    <rule>오류 메시지는 입력창과 aria-describedby 연결</rule>
    <rule>차트는 시각 정보 외에 표 형식 대체 데이터 제공</rule>
    <rule>색상만으로 상태를 구분하지 않는다. 배지 텍스트 병행</rule>
    <rule>prefers-reduced-motion 환경에서는 카드 진입 애니메이션 제거</rule>
  </section>

  <section id="16" name="exceptionHandlingRules">
    <authenticationAndAuthorization>
      <case situation="세션 만료">현재 페이지 유지, 로그인 모달 또는 /login 이동, 저장 전이던 입력값은 메모리 유지</case>
      <case situation="관리자 페이지 무권한 접근">403 페이지 또는 /admin/login 리다이렉트</case>
      <case situation="정지 계정 로그인">로그인 차단, 사유 안내</case>
    </authenticationAndAuthorization>
    <chatbotParsing>
      <case situation="종목 식별 실패">종목을 식별하지 못했습니다. 티커 또는 시장명을 함께 입력하세요.</case>
      <case situation="수량 누락">저장 금지, 수량 재입력 요청</case>
      <case situation="중복 자산">신규 추가 대신 수정 의도 확인 카드 표시</case>
      <case situation="낮은 신뢰도">확인 단계 강제</case>
    </chatbotParsing>
    <externalData>
      <case situation="Yahoo 시세 실패">마지막 캐시값 표시 + 지연 데이터 배지</case>
      <case situation="OpenAI 응답 실패">챗봇 패널 내 재시도 버튼 노출</case>
      <case situation="환율 조회 실패">원화 환산값 숨기지 않고 마지막 성공 환율 기준 표시 + 시각 명시</case>
    </externalData>
    <valuationEngine>
      <case situation="룰 버전 없음">평가 영역에 룰 미설정 표시</case>
      <case situation="일부 계산 실패">성공 항목 우선 표시, 실패 항목 별도 섹션</case>
      <case situation="입력 데이터 누락">UNKNOWN 밴드 지정</case>
    </valuationEngine>
    <formValidation>
      <validation field="이메일" rule="RFC 형식 검증" message="올바른 이메일 형식이 아닙니다."/>
      <validation field="비밀번호" rule="8자 이상, 영문+숫자" message="비밀번호는 영문과 숫자를 포함한 8자 이상이어야 합니다."/>
      <validation field="수량" rule="0 초과" message="보유 수량은 0보다 커야 합니다."/>
      <validation field="평균단가" rule="0 이상" message="평균단가는 0 이상이어야 합니다."/>
    </formValidation>
  </section>

  <section id="17" name="apiContracts">
    <authenticationApis>
      <api method="POST" path="/api/auth/signup" description="회원가입"/>
      <api method="POST" path="/api/auth/login" description="로그인"/>
      <api method="POST" path="/api/auth/logout" description="로그아웃"/>
      <api method="GET" path="/api/auth/me" description="현재 사용자"/>
    </authenticationApis>
    <portfolioApis>
      <api method="GET" path="/api/dashboard/summary" description="KPI/차트 요약"/>
      <api method="GET" path="/api/assets" description="자산 목록"/>
      <api method="POST" path="/api/assets" description="수동 자산 추가"/>
      <api method="GET" path="/api/assets/:assetId" description="자산 상세"/>
      <api method="PATCH" path="/api/assets/:assetId" description="자산 수정"/>
      <api method="DELETE" path="/api/assets/:assetId" description="자산 삭제"/>
      <api method="GET" path="/api/valuation/overview" description="가치평가 요약"/>
    </portfolioApis>
    <chatbotApis>
      <api method="POST" path="/api/chat/intents" description="자연어 파싱"/>
      <api method="POST" path="/api/chat/intents/:intentId/confirm" description="파싱 결과 확정"/>
      <api method="POST" path="/api/chat/intents/:intentId/cancel" description="파싱 결과 취소"/>
    </chatbotApis>
    <adminApis>
      <api method="GET" path="/api/admin/stats" description="관리자 KPI"/>
      <api method="GET" path="/api/admin/users" description="회원 목록"/>
      <api method="PATCH" path="/api/admin/users/:userId/status" description="회원 상태 변경"/>
      <api method="GET" path="/api/admin/data/status" description="외부 연동 상태"/>
      <api method="POST" path="/api/admin/data/sync" description="강제 동기화"/>
      <api method="GET" path="/api/admin/valuation-rules" description="룰 버전 목록"/>
      <api method="PATCH" path="/api/admin/valuation-rules/:ruleId/activate" description="활성 룰 전환"/>
    </adminApis>
    <commonResponseFormat>
      <successResponse>
        <success>true</success>
        <data>{}</data>
        <error nil="true"/>
        <timestamp>2026-04-23T09:00:00.000Z</timestamp>
      </successResponse>
      <errorResponse>
        <success>false</success>
        <data nil="true"/>
        <error>
          <code>ASSET_NOT_FOUND</code>
          <message>해당 자산을 찾을 수 없습니다.</message>
        </error>
        <timestamp>2026-04-23T09:00:00.000Z</timestamp>
      </errorResponse>
    </commonResponseFormat>
  </section>

  <section id="18" name="implementationPriority">
    <phase name="1차 구현">
      <item>인증</item>
      <item>회원 대시보드</item>
      <item>보유 자산 목록/상세</item>
      <item>챗봇 파싱 및 자산 반영</item>
      <item>Yahoo 시세 연동</item>
    </phase>
    <phase name="2차 구현">
      <item>가치평가 페이지</item>
      <item>관리자 대시보드</item>
      <item>회원 관리</item>
      <item>룰 버전 관리</item>
    </phase>
  </section>

  <section id="19" name="acceptanceCriteria">
    <criterion>회원은 자연어 입력으로 최소 1개 자산을 등록할 수 있어야 한다.</criterion>
    <criterion>등록 자산은 대시보드와 자산 목록에 3초 이내 반영되어야 한다.</criterion>
    <criterion>외부 시세 실패 시 화면이 비지 않아야 하며 마지막 성공 값과 상태 배지가 보여야 한다.</criterion>
    <criterion>관리자 페이지에서 회원 상태 변경과 가치평가 룰 활성 전환이 가능해야 한다.</criterion>
    <criterion>모든 핵심 액션은 로딩, 성공, 실패 상태를 UI에 표시해야 한다.</criterion>
  </section>
</aiPoweredWealthManagementSpec>
```
