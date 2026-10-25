# Stock Compass AI - 소스 컴포넌트

주식 투자 입문자를 위한 AI 코칭 기반 투자 플랫폼 React 컴포넌트 모음입니다.

## 컴포넌트 목록

### 1. StockCompass.jsx
메인 투자 나침반 화면
- 한국주식 / 미국주식 / ETF / 암호화폐 4개 시장 탭
- Claude AI 기반 종목 분석 (점수·리스크·체크리스트)
- 7단계 주식 학습 커리큘럼
- 실시간 시세 티커 바

### 2. StockSimulator.jsx
모의투자 시뮬레이터
- 초기자금 ₩10,000,000 가상 투자
- 10개 종목 (한국·미국·ETF·암호화폐)
- SVG 스파크라인 미니차트 (4초 가격 변동)
- AI 코치 채팅 패널 (Claude API 연동)
- 매수/매도 실행, 포트폴리오 비중 바

### 3. StockCompassFull.jsx
통합 완성본 (뉴스 감성 분석 포함)
- 네이버 공식 검색 API 뉴스 연동
- Claude 웹서치 자동 폴백
- 감성 점수 (-100~+100) 기반 주문 경고
- API 설정 모달 (Client ID / Secret 입력)

## 사용 방법

각 컴포넌트는 claude.ai 아티팩트에서 직접 붙여넣기로 실행 가능합니다.

```jsx
// StockCompassFull.jsx 에서 Claude API 키 필요
// 네이버 API: https://developers.naver.com/apps/#/register
```

## 기술 스택
- React (JSX)
- Claude API (`claude-sonnet-4-20250514`)
- 네이버 검색 API
- 다크 사이버펑크 테마 (bg:#06090f)
