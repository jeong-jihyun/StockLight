// StockLight 1단계: 공공데이터 API 첫 호출 점검
// 사용법:  node collector/probe.mjs 삼성전자
// 필요한 것: Node 18 이상, .env 파일에 DATA_GO_KR_KEY (패키지 설치 없음)
//
// 이 스크립트가 알려주는 것
//  1) 인증키가 정상인지, 3개 API가 응답하는지 (해외/국내 서버 상관없이 "내 PC 기준")
//  2) 기업개요 / 주식시세 / 재무정보 응답에 어떤 항목이 들어 있는지
//  3) 종목코드와 법인등록번호를 이어줄 항목이 있는지
// 인증키는 화면에 출력하지 않습니다. 결과 화면을 그대로 복사해서 보내주셔도 안전합니다.

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

// ---------- 2. API 주소 (확인 필요) ----------
// 아래 주소는 제가 기억하는 형태입니다. 오류가 나면 data.go.kr > 마이페이지 >
// 활용신청 상세의 "요청주소"를 보고, .env 에 URL_OUTLINE / URL_PRICE / URL_FINANCE 로 덮어쓰세요.
const BASE = 'https://apis.data.go.kr/1160100/service';
const URLS = {
  outline: process.env.URL_OUTLINE || `${BASE}/GetCorpBasicInfoService_V2/getCorpOutline_V2`,
  price: process.env.URL_PRICE || `${BASE}/GetStockSecuritiesInfoService/getStockPriceInfo`,
  finance: process.env.URL_FINANCE || `${BASE}/GetFinaStatInfoService_V2/getSummFinaStat_V2`,
};

// ---------- 3. 공통 호출 함수 ----------
const OUT_DIR = 'data/raw/probe';
mkdirSync(OUT_DIR, { recursive: true });

function items(json) {
  const it = json?.response?.body?.items?.item;
  if (!it) return [];
  return Array.isArray(it) ? it : [it];
}

async function call(name, params) {
  const u = new URL(URLS[name]);
  u.searchParams.set('serviceKey', KEY);
  u.searchParams.set('pageNo', '1');
  u.searchParams.set('numOfRows', '3');
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
  const rows = items(json);
  console.log(
    `[${name}] HTTP ${res.status} | 결과코드 ${h.resultCode ?? '?'} ${h.resultMsg ?? ''} | 전체 ${json?.response?.body?.totalCount ?? '?'}건 | 받은 ${rows.length}건`,
  );
  return { ok: res.ok && rows.length > 0, rows };
}

function show(title, row) {
  console.log(`  ${title} 항목명: ${Object.keys(row).join(', ')}`);
  console.log(`  ${title} 첫 행: ${JSON.stringify(row)}`);
}

// ---------- 4. 실행 ----------
const name = process.argv[2] || '삼성전자';
console.log(`\n=== StockLight 점검: "${name}" ===\n`);

// (1) 기업개요: 이름으로 찾아서 법인등록번호(crno)를 얻는다
const outline = await call('outline', { corpNm: name });
let crno = null;
if (outline.rows[0]) {
  show('기업개요', outline.rows[0]);
  crno = outline.rows[0].crno ?? null;
}

// (2) 주식시세
const price = await call('price', { likeItmsNm: name });
if (price.rows[0]) show('주식시세', price.rows[0]);

// (3) 재무정보: 법인등록번호가 있으면 최근 사업연도부터 거꾸로 찾는다
let finance = { rows: [] };
if (crno) {
  const y = new Date().getFullYear();
  for (const bizYear of [y - 1, y - 2, y - 3]) {
    finance = await call('finance', { crno, bizYear });
    if (finance.rows.length) { console.log(`  → 사업연도 ${bizYear} 데이터 확인`); break; }
  }
  if (finance.rows[0]) show('재무정보', finance.rows[0]);
} else {
  console.log('[finance] 법인등록번호(crno)를 못 얻어서 건너뜀 (기업개요 호출 결과 확인 필요)');
}

// ---------- 5. 연결 점검 ----------
console.log('\n=== 연결 점검 (종목코드 ↔ 법인등록번호) ===');
const pKeys = price.rows[0] ? Object.keys(price.rows[0]) : [];
const oKeys = outline.rows[0] ? Object.keys(outline.rows[0]) : [];
console.log(`시세 응답에 법인등록번호(crno) 있음? ${pKeys.includes('crno') ? '예' : '아니오'}`);
console.log(`기업개요 응답에 종목코드 항목 있음? ${oKeys.filter((k) => /cd|code|isin|srtn/i.test(k)).join(', ') || '없음'}`);
console.log(`\n원본 응답은 ${OUT_DIR}/ 에 저장했습니다.`);
