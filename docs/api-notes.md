# 금융위원회 API 규격 메모

출처: 공공데이터포털 "공공데이터 오픈API 활용가이드" 6종 (활용신청 후 받은 문서 기준).

## 호출 주소와 조회 키

| API | Call Back URL | 조회 키 | 이용허락 |
| --- | --- | --- | --- |
| KRX상장종목정보 | `.../1160100/GetKrxListedInfoService_V2/getItemInfo_V2` | itmsNm, crno, isinCd, basDt | 공공누리 4유형 |
| 기업기본정보 | `.../1160100/service/GetCorpBasicInfoService_V2/getCorpOutline_V2` | crno, corpNm | 공공누리 1유형 |
| 기업재무정보 | `.../1160100/service/GetFinaStatInfoService_V2/getSummFinaStat_V2` (+ getBs_V2, getIncoStat_V2) | crno, bizYear | 공공누리 1유형 |
| 주식시세정보 | `.../1160100/GetStockSecuritiesInfoService_V2/getStockPriceInfo_V2` | isinCd, itmsNm, srtnCd, basDt 범위 | 공공누리 4유형 |
| 주식배당정보 | `.../1160100/GetStocDiviInfoService_V2/getDiviInfo_V2` | crno, stckIssuCmpyNm | 공공누리 2유형 |
| 증권상품시세정보(ETF) | (3차 개발 때 확인) | - | 공공누리 4유형 |

주의: 서비스마다 경로에 `/service`가 있는 것과 없는 것이 섞여 있다. 공통 요청 변수는 `serviceKey`, `pageNo`, `numOfRows`, `resultType`(json 또는 xml).

## 테이블을 이어주는 방법

- 기업개요·재무·배당은 **법인등록번호(crno)**, 시세는 **ISIN코드(isinCd)** 기준이다.
- 시세 응답에는 crno가 없고, 기업개요 응답에는 종목코드가 없다.
- **KRX상장종목정보**가 `종목명 → crno + isinCd + srtnCd`를 한 번에 주므로 연결표로 쓴다. (외국회사는 crno가 없다.)

## 응답에서 쓸 항목

- 재무(요약): `enpSaleAmt` 매출, `enpBzopPft` 영업이익, `enpCrtmNpf` 당기순이익, `enpTastAmt` 총자산, `enpTdbtAmt` 총부채, `enpTcptAmt` 총자본, `fnclDebtRto` 부채비율(API가 직접 제공)
- 재무는 한 사업연도에 **연결/별도 재무제표가 함께** 나온다. `fnclDcdNm`(예: 연결요약재무제표)으로 구분한다.
- 시세: `basDt` 기준일, `clpr` 종가, `mkp` 시가, `hipr` 고가, `lopr` 저가, `fltRt` 등락률, `trqu` 거래량, `mrktTotAmt` 시가총액

## 운영 규칙

- 데이터는 실시간이 아니다. 영업일 하루 뒤 오후 1시 이후에 갱신된다. (금요일 데이터는 월요일에 제공)
- `numOfRows`는 최대 10,000건까지만 조회된다. 조회 조건 없이 호출하면 전체가 조회되어 느려진다.
- 평균 응답 500ms, 초당 최대 30건. 일일 한도를 넘으면 `API token quota exceeded`.
- 오류 메시지: `Unauthorized`(키 오류), `Forbidden`(활용신청·승인 확인), `API not found`(주소 오타 확인).

## 이용허락(공공누리) 정리

| 유형 | 의미 | 해당 API |
| --- | --- | --- |
| 1유형 | 출처표시, 상업적 이용 가능, 변형 가능 | 기업기본정보, 기업재무정보 |
| 2유형 | 출처표시, 상업적 이용 금지, 변형 가능 | 주식배당정보 |
| 4유형 | 출처표시, 상업적 이용 금지, 변경 금지 | 주식시세정보, KRX상장종목정보, 증권상품시세정보 |

**유료 서비스에 쓰려면 이 표를 먼저 해결해야 한다.** 시세와 종목 연결표가 4유형이라, 현재 조건으로는 비상업적 이용만 가능하다. 제공기관 확인이 필요하다.
