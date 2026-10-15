// StockLight 1단계: 공공데이터 API 첫 호출 점검 (활용가이드 규격 반영판)
// 사용법:  node collector/probe.mjs 삼성전자
// 필요한 것: Node 18 이상, .env 파일에 DATA_GO_KR_KEY (패키지 설치 없음)
//
// 이 스크립트가 확인하는 것
//  1) 인증키가 정상인지, 5개 API가 내 PC에서 응답하는지
//  2) KRX상장종목정보로 "종목명 → 법인등록번호(crno) + ISIN코드" 연결이 되는지
//  3) 그 연결로 기업개요 / 재무 / 시세 / 배당을 이어서 받을 수 있는지
// 인증키는 화면에 출력하지 않습니다. 결과 화면을 그대로 복사해서 보내주셔도 안전합니다.
//
// 연결 구조 (활용가이드 기준)
//   KRX상장종목정보 : 종목명 → crno(법인등록번호) + isinCd + srtnCd   ← 연결표 역할
//   기업기본정보    : crno 로 조회
//   기업재무정보    : crno + bizYear 로 조회 (연결/별도 재무제표가 함께 나옴)
//   주식시세정보    : isinCd 로 조회 (응답에 crno 없음)
//   주식배당정보    : crno 로 조회

import { readFileSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';

// ---------- 1. .env 읽기 ----------
function loadEnv() {
  for (const p of ['.env', '../.env']) {
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && !(m[1] in process.env)) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
      }
    }
    return;
  }
}
loadEnv();

const RAW_KEY = process.env.DATA_GO_KR_KEY;
if (!RAW_KEY) {
  console.error('.env 파일에 DATA_GO_KR_KEY=인증키 를 넣어주세요.');
  process.exit(1);
}
// 포털의 "Encoding 키"를 넣어도, "Decoding 키"를 넣어도 동작하게 처리
const KEY = RAW_KEY.includes('%') ? decodeURIComponent(RAW_KEY) : RAW_KEY;

// ---------- 2. API 주소 (활용가이드 "Call Back URL" 기준) ----------
// 주의: 서비스마다 경로에 /service 가 있는 것도 있고 없는 것도 있습니다.
const B = 'https://apis.data.go.kr/1160100';
const URLS = {
  krx: `${B}/GetKrxListedInfoService_V2/getItemInfo_V2`,
  outline: `${B}/service/GetCorpBasicInfoService_V2/getCorpOutline_V2`,
  finance: `${B}/service/GetFinaStatInfoService_V2/getSummFinaStat_V2`,
  price: `${B}/GetStockSecuritiesInfoService_V2/getStockPriceInfo_V2`,
  dividend: `${B}/GetStocDiviInfoService_V2/getDiviInfo_V2`,
};

// ---------- 3. 공통 호출 함수 ----------
const OUT_DIR = 'data/raw/probe';
mkdirSync(OUT_DIR, { recursive: true });

function items(json) {
  const it = json?.response?.body?.items?.item;
  if (!it) return [];
  return Array.isArray(it) ? it : [it];
}

async function call(name, params, rows = 3) {
  const u = new URL(URLS[name]);
  u.searchParams.set('serviceKey', KEY);
  u.searchParams.set('pageNo', '1');
  u.searchParams.set('numOfRows', String(rows));
  u.searchParams.set('resultType', 'json');
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));

  let res, text;
  try {
    res = await fetch(u, { signal: AbortSignal.timeout(20000) });
    text = await res.text();
  } catch (e) {
    console.log(`[${name}] 연결 실패: ${e.message}`);
    return { ok: false, rows: [] };
  }
  writeFileSync(`${OUT_DIR}/${name}.txt`, text);

  let json = null;
  try { json = JSON.parse(text); } catch { /* JSON이 아니면 아래에서 원문 일부 출력 */ }

  if (!json) {
    console.log(`[${name}] HTTP ${res.status} | JSON이 아닌 응답 (오류 메시지일 가능성)`);
    console.log('  응답 앞부분:', text.slice(0, 300).replace(/\s+/g, ' '));
    return { ok: false, rows: [] };
  }
  const h = json?.response?.header ?? {};
  const body = json?.response?.body ?? {};
  const list = items(json);
  console.log(
    `[${name}] HTTP ${res.status} | 결과코드 ${h.resultCode ?? '?'} ${h.resultMsg ?? ''} | 전체 ${body.totalCount ?? '?'}건 | 받은 ${list.length}건`,
  );
  return { ok: res.ok && list.length > 0, rows: list };
}

const show = (title, row) => console.log(`  ${title}: ${JSON.stringify(row)}`);

// 오늘 기준 n일 전 (YYYYMMDD)
function ymd(daysAgo = 0) {
  const d = new Date(Date.now() - daysAgo * 864e5);
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

// ---------- 4. 실행 ----------
const name = process.argv[2] || '삼성전자';
console.log(`\n=== StockLight 점검: "${name}" ===\n`);

// (1) KRX상장종목정보: 종목명 → crno + isinCd (연결표)
const krx = await call('krx', { itmsNm: name }, 5);
if (krx.rows[0]) show('KRX 첫 행', krx.rows[0]);
const pick = krx.rows.find((r) => r.crno && r.isinCd) ?? null;
const crno = pick?.crno ?? null;
const isinCd = pick?.isinCd ?? null;

// (2) 기업개요: crno 로 조회
if (crno) {
  const outline = await call('outline', { crno }, 1);
  if (outline.rows[0]) {
    const o = outline.rows[0];
    show('기업개요', { corpNm: o.corpNm, sicNm: o.sicNm, enpEmpeCnt: o.enpEmpeCnt, enpEstbDt: o.enpEstbDt });
  }
} else {
  console.log('[outline] crno 를 못 얻어서 건너뜀 (KRX 호출 결과 확인 필요)');
}

// (3) 재무정보: 최근 사업연도부터 거꾸로. 연결/별도가 함께 나오므로 구분명을 출력
if (crno) {
  const y = new Date().getFullYear();
  for (const bizYear of [y - 1, y - 2, y - 3]) {
    const fin = await call('finance', { crno, bizYear }, 10);
    if (fin.rows.length) {
      console.log(`  → 사업연도 ${bizYear}: 재무제표 구분 = ${fin.rows.map((r) => r.fnclDcdNm).join(' / ')}`);
      const f = fin.rows.find((r) => /연결/.test(r.fnclDcdNm ?? '')) ?? fin.rows[0];
      show('재무(요약)', {
        구분: f.fnclDcdNm, 매출: f.enpSaleAmt, 영업이익: f.enpBzopPft, 당기순이익: f.enpCrtmNpf,
        총자산: f.enpTastAmt, 총부채: f.enpTdbtAmt, 총자본: f.enpTcptAmt, 부채비율: f.fnclDebtRto,
      });
      break;
    }
  }
}

// (4) 주식시세: isinCd 로 최근 14일치
if (isinCd) {
  const price = await call('price', { isinCd, beginBasDt: ymd(14) }, 20);
  if (price.rows.length) {
    const dates = price.rows.map((r) => r.basDt).sort();
    console.log(`  → 시세 기준일 범위: ${dates[0]} ~ ${dates.at(-1)} (${price.rows.length}건)`);
    show('시세 첫 행', price.rows[0]);
  }
} else {
  console.log('[price] isinCd 를 못 얻어서 건너뜀');
}

// (5) 배당: crno 로 조회
if (crno) {
  const div = await call('dividend', { crno }, 3);
  if (div.rows[0]) show('배당 첫 행', div.rows[0]);
}

// ---------- 5. 연결 점검 ----------
console.log('\n=== 연결 점검 ===');
console.log(`종목명 → 법인등록번호(crno): ${crno ? '성공' : '실패'}`);
console.log(`종목명 → ISIN코드:           ${isinCd ? '성공' : '실패'}`);
console.log(`\n원본 응답은 ${OUT_DIR}/ 에 저장했습니다. (git에는 올라가지 않음)`);
