# StockLight (종목신호등)

공공데이터(금융위원회 API)로 종목 하나를 "실적 근거"와 "가격 위험"으로 나눠 신호등 한 장으로 보여주는 데스크탑 리포트 앱.

## 1단계: API 첫 호출 점검

1. `.env.example`을 복사해 `.env`를 만들고 `DATA_GO_KR_KEY`에 data.go.kr 인증키를 넣는다. (`.env`는 git에 올라가지 않는다)
2. Node.js 18 이상에서 실행한다.

```
node collector/probe.mjs 삼성전자
```

출력 화면을 그대로 복사해서 공유하면 된다. 인증키는 출력되지 않는다.

## 폴더

- `collector/` 공공데이터 API 호출 코드
- `.env.example` 환경변수 견본 (실제 키 없음)
