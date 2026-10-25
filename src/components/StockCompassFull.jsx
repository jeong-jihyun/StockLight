import { useState, useEffect, useRef } from "react";

const C = {
  bg:"#06090f", bg2:"#0c1420", surface:"#111d2e", border:"#1a2d44",
  accent:"#00c8f0", accent2:"#00e8a0", gold:"#f5c842",
  danger:"#ff4455", warn:"#ff8c42",
  text:"#ddeeff", text2:"#6a90b0", text3:"#2e4a62",
};

const STOCKS = {
  "삼성전자":  { ticker:"005930", market:"KR", price:74200,  sector:"반도체",   kw:"삼성전자 주가" },
  "SK하이닉스":{ ticker:"000660", market:"KR", price:198500, sector:"반도체",   kw:"SK하이닉스 주가" },
  "카카오":    { ticker:"035720", market:"KR", price:41800,  sector:"IT플랫폼", kw:"카카오 주가" },
  "현대차":    { ticker:"005380", market:"KR", price:217000, sector:"자동차",   kw:"현대차 주가" },
  "NVIDIA":   { ticker:"NVDA",   market:"US", price:118.4,  sector:"AI반도체", kw:"NVIDIA 주가" },
  "APPLE":    { ticker:"AAPL",   market:"US", price:221.3,  sector:"빅테크",   kw:"애플 주가" },
  "TESLA":    { ticker:"TSLA",   market:"US", price:248.7,  sector:"전기차",   kw:"테슬라 주가" },
  "QQQ":      { ticker:"QQQ",    market:"ETF",price:441.3,  sector:"나스닥ETF",kw:"나스닥 ETF 동향" },
  "KODEX200": { ticker:"069500", market:"ETF",price:37850,  sector:"코스피ETF",kw:"코스피 ETF" },
  "비트코인":  { ticker:"BTC",  market:"CRYPTO",price:87432, sector:"암호화폐", kw:"비트코인 시세" },
};

const INITIAL_CASH = 10_000_000;
const fmt = n => n?.toLocaleString("ko-KR") ?? "—";

// ── Claude API (웹서치 ON) ──
async function callClaude(prompt, useSearch = false) {
  const body = {
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    messages: [{ role: "user", content: prompt }],
  };
  if (useSearch) body.tools = [{ type: "web_search_20250305", name: "web_search" }];
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  return data.content?.filter(b => b.type === "text").map(b => b.text).join("") || "";
}

// ── 네이버 뉴스 API (CORS 프록시 경유) ──
async function fetchNaverNews(clientId, clientSecret, query, display = 7) {
  const encoded = encodeURIComponent(query);
  // allorigins: 무료 CORS 프록시 (실제 서비스엔 자체 백엔드 권장)
  const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(
    `https://openapi.naver.com/v1/search/news.json?query=${encoded}&display=${display}&sort=date`
  )}`;
  const res = await fetch(proxyUrl, {
    headers: {
      // 프록시 경유 시 헤더는 백엔드에서 처리해야 함 — 여기선 시뮬레이션
    },
  });
  if (!res.ok) throw new Error("프록시 요청 실패");
  const wrapper = await res.json();
  const data = JSON.parse(wrapper.contents);
  if (data.errorCode) throw new Error(data.errorMessage || "네이버 API 오류");
  return data.items || [];
}

// HTML 태그 제거
const stripHtml = s => s?.replace(/<[^>]+>/g, "").replace(/&quot;/g,'"').replace(/&amp;/g,"&").replace(/&#[0-9]+;/g,"") || "";

// ── API 설정 저장소 (세션 내 메모리) ──
let _apiConfig = { clientId: "", clientSecret: "", mode: "claude" }; // mode: claude | naver

// ────────────────────────────────
//  설정 모달
// ────────────────────────────────
function ApiSetupModal({ onSave, onClose, current }) {
  const [cid, setCid]   = useState(current.clientId || "");
  const [csec, setCsec] = useState(current.clientSecret || "");
  const [mode, setMode] = useState(current.mode || "claude");
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState("");

  async function testConnection() {
    if (mode === "naver" && (!cid || !csec)) { setTestMsg("❌ Client ID와 Secret을 입력하세요."); return; }
    setTesting(true); setTestMsg("");
    try {
      if (mode === "naver") {
        const items = await fetchNaverNews(cid, csec, "삼성전자", 1);
        setTestMsg(items.length > 0 ? "✅ 네이버 API 연결 성공!" : "⚠️ 결과 없음 — 키를 확인하세요.");
      } else {
        const msg = await callClaude("테스트: '연결 성공'이라고만 답해.");
        setTestMsg(msg.includes("연결") ? "✅ Claude AI 연결 성공!" : "⚠️ 응답 이상 — 다시 시도하세요.");
      }
    } catch (e) {
      setTestMsg(`❌ 오류: ${e.message}`);
    }
    setTesting(false);
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.8)", zIndex:999, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ background:C.bg2, border:`1px solid ${C.border}`, borderRadius:16, padding:"1.8rem", width:440, maxWidth:"90vw", boxShadow:`0 0 60px rgba(0,200,240,0.15)` }}>
        
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"1.4rem" }}>
          <div>
            <div style={{ fontFamily:"monospace", fontSize:"1rem", fontWeight:800, color:C.accent, letterSpacing:2 }}>⚙️ API 설정</div>
            <div style={{ fontSize:"0.7rem", color:C.text3, marginTop:3 }}>뉴스 데이터 소스를 선택하세요</div>
          </div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:C.text3, fontSize:"1.2rem", cursor:"pointer" }}>✕</button>
        </div>

        {/* 모드 선택 */}
        <div style={{ marginBottom:"1.2rem" }}>
          <div style={{ fontSize:"0.65rem", color:C.text3, fontFamily:"monospace", letterSpacing:1.5, marginBottom:8 }}>데이터 소스</div>
          <div style={{ display:"flex", gap:8 }}>
            {[
              { key:"claude", label:"🤖 Claude 웹서치", desc:"API 키 불필요 · 즉시 사용" },
              { key:"naver",  label:"📰 네이버 공식 API", desc:"정확한 실시간 뉴스" },
            ].map(opt => (
              <div key={opt.key} onClick={() => setMode(opt.key)} style={{
                flex:1, padding:"0.8rem", borderRadius:10, cursor:"pointer",
                border:`2px solid ${mode===opt.key ? C.accent : C.border}`,
                background: mode===opt.key ? `rgba(0,200,240,0.06)` : C.surface,
                transition:"all 0.2s",
              }}>
                <div style={{ fontSize:"0.78rem", fontWeight:700, marginBottom:3, color: mode===opt.key ? C.accent : C.text }}>{opt.label}</div>
                <div style={{ fontSize:"0.62rem", color:C.text3 }}>{opt.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 네이버 API 키 입력 */}
        {mode === "naver" && (
          <div style={{ marginBottom:"1.2rem" }}>
            <div style={{ background:`rgba(255,140,66,0.07)`, border:`1px solid ${C.warn}30`, borderRadius:8, padding:"0.7rem 0.9rem", marginBottom:"1rem", fontSize:"0.68rem", color:C.warn, lineHeight:1.8 }}>
              ⚠️ <strong>CORS 제한 안내</strong><br/>
              브라우저 보안 정책상 클라이언트에서 네이버 API를 직접 호출하면 차단됩니다.<br/>
              실제 서비스에는 <strong>백엔드 프록시 서버</strong>가 필요합니다.<br/>
              지금은 데모용 공개 프록시로 테스트하며, 키가 노출될 수 있으니 <strong>테스트 키만 사용</strong>하세요.
            </div>

            <div style={{ marginBottom:"0.9rem" }}>
              <div style={{ fontSize:"0.65rem", color:C.text3, fontFamily:"monospace", letterSpacing:1.5, marginBottom:6 }}>CLIENT ID</div>
              <input
                value={cid} onChange={e => setCid(e.target.value)}
                placeholder="네이버 개발자센터에서 발급받은 Client ID"
                style={{ width:"100%", background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, color:C.text, padding:"0.65rem 0.9rem", fontSize:"0.8rem", outline:"none", fontFamily:"monospace" }}
              />
            </div>
            <div style={{ marginBottom:"0.9rem" }}>
              <div style={{ fontSize:"0.65rem", color:C.text3, fontFamily:"monospace", letterSpacing:1.5, marginBottom:6 }}>CLIENT SECRET</div>
              <input
                type="password" value={csec} onChange={e => setCsec(e.target.value)}
                placeholder="Client Secret"
                style={{ width:"100%", background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, color:C.text, padding:"0.65rem 0.9rem", fontSize:"0.8rem", outline:"none", fontFamily:"monospace" }}
              />
            </div>

            {/* 발급 안내 */}
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:"0.8rem", fontSize:"0.68rem", color:C.text2, lineHeight:1.9 }}>
              📌 <strong style={{color:C.accent}}>네이버 API 키 발급 방법</strong><br/>
              1. <span style={{color:C.accent}}>developers.naver.com</span> 접속<br/>
              2. 로그인 → Application → 애플리케이션 등록<br/>
              3. 사용 API: <strong>검색 (뉴스)</strong> 선택<br/>
              4. 환경: <strong>WEB</strong>, URL: <strong>localhost</strong> 입력<br/>
              5. Client ID / Secret 복사 후 위에 입력
            </div>
          </div>
        )}

        {/* 테스트 + 저장 */}
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={testConnection} disabled={testing} style={{
            flex:1, padding:"0.65rem", borderRadius:10, border:`1px solid ${C.border}`,
            background:C.surface, color:C.text2, fontSize:"0.78rem", cursor:"pointer", fontFamily:"'Noto Sans KR',sans-serif",
          }}>
            {testing ? "테스트 중..." : "🔌 연결 테스트"}
          </button>
          <button onClick={() => onSave({ clientId:cid, clientSecret:csec, mode })} style={{
            flex:2, padding:"0.65rem", borderRadius:10, border:"none",
            background:`linear-gradient(135deg,${C.accent},#0099cc)`, color:C.bg,
            fontSize:"0.82rem", fontWeight:800, cursor:"pointer", fontFamily:"'Noto Sans KR',sans-serif",
          }}>
            ✅ 저장하고 시작
          </button>
        </div>
        {testMsg && (
          <div style={{ marginTop:8, padding:"0.5rem 0.7rem", borderRadius:6, background:C.surface, border:`1px solid ${C.border}`, fontSize:"0.72rem", fontFamily:"monospace", color: testMsg.startsWith("✅")?C.accent2:testMsg.startsWith("⚠️")?C.warn:C.danger }}>
            {testMsg}
          </div>
        )}
      </div>
    </div>
  );
}

// ── 감성 미터 ──
function SentiMeter({ score }) {
  const color = score > 20 ? C.accent2 : score < -20 ? C.danger : C.gold;
  const label = score > 40?"매우 긍정":score > 10?"긍정":score < -40?"매우 부정":score < -10?"부정":"중립";
  return (
    <div style={{ marginBottom:"1rem" }}>
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
        <span style={{ fontSize:"0.62rem", color:C.text3, fontFamily:"monospace", letterSpacing:1.5 }}>뉴스 감성 지수</span>
        <span style={{ fontFamily:"monospace", fontSize:"0.75rem", fontWeight:800, color }}>{score>0?"+":""}{score} · {label}</span>
      </div>
      <div style={{ position:"relative", height:10, background:C.surface, borderRadius:20, overflow:"hidden", border:`1px solid ${C.border}` }}>
        <div style={{ position:"absolute", left:"50%", top:0, bottom:0, width:1, background:C.border, zIndex:2 }}/>
        <div style={{
          position:"absolute",
          left: score >= 0 ? "50%" : `${((score+100)/200)*100}%`,
          width:`${Math.abs(score)/2}%`,
          top:0, bottom:0, background:color, borderRadius:20, transition:"width 1s ease",
        }}/>
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", fontSize:"0.55rem", color:C.text3, fontFamily:"monospace", marginTop:3 }}>
        <span>-100 극악재</span><span>0 중립</span><span>+100 극호재</span>
      </div>
    </div>
  );
}

// ── 뉴스 카드 ──
function NewsCard({ item, idx }) {
  const [open, setOpen] = useState(false);
  const sentColor = item.sentiment==="호재"?C.accent2:item.sentiment==="악재"?C.danger:C.gold;
  return (
    <div style={{
      background:C.surface, border:`1px solid ${C.border}`, borderRadius:10,
      padding:"0.9rem", marginBottom:"0.65rem",
      borderLeft:`3px solid ${sentColor}`,
      animation:`fadeUp 0.3s ease ${idx*0.06}s both`,
    }}>
      <div style={{ fontSize:"0.82rem", fontWeight:600, lineHeight:1.55, marginBottom:6, color:C.text }}>
        {item.title}
      </div>
      <div style={{ display:"flex", gap:6, flexWrap:"wrap", alignItems:"center", marginBottom:6 }}>
        <span style={{ padding:"2px 8px", borderRadius:20, fontSize:"0.6rem", fontFamily:"monospace", fontWeight:800, background:`${sentColor}18`, color:sentColor, border:`1px solid ${sentColor}40` }}>
          {item.sentiment==="호재"?"▲":item.sentiment==="악재"?"▼":"◆"} {item.sentiment}
        </span>
        <span style={{ fontSize:"0.6rem", color:C.text3, fontFamily:"monospace" }}>{item.source}</span>
        <span style={{ fontSize:"0.6rem", color:C.text3, fontFamily:"monospace" }}>{item.pubDate}</span>
        <span style={{ fontSize:"0.6rem", fontFamily:"monospace", fontWeight:700, color:item.impact==="상"?C.danger:item.impact==="중"?C.gold:C.text3 }}>영향도 {item.impact}</span>
      </div>
      <div style={{ fontSize:"0.76rem", color:C.text2, lineHeight:1.75 }}>
        {open ? item.summary : item.summary?.slice(0, 90) + (item.summary?.length > 90 ? "…" : "")}
      </div>
      {item.summary?.length > 90 && (
        <button onClick={() => setOpen(!open)} style={{ background:"none", border:"none", color:C.accent, fontSize:"0.65rem", cursor:"pointer", fontFamily:"monospace", padding:"2px 0", marginTop:2 }}>
          {open ? "접기 ▲" : "더보기 ▼"}
        </button>
      )}
      {item.coachComment && (
        <div style={{ marginTop:8, padding:"0.45rem 0.7rem", background:`rgba(0,200,240,0.05)`, borderRadius:6, border:`1px solid ${C.accent}20`, fontSize:"0.7rem", color:C.accent, lineHeight:1.65 }}>
          🤖 {item.coachComment}
        </div>
      )}
    </div>
  );
}

// ── 코치 채팅 ──
function CoachChat({ messages, loading }) {
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages, loading]);
  return (
    <div style={{ flex:1, overflowY:"auto", padding:"0.8rem", display:"flex", flexDirection:"column", gap:8 }}>
      {messages.map((m, i) => (
        <div key={i} style={{ display:"flex", gap:7, flexDirection:m.role==="coach"?"row":"row-reverse", animation:"fadeUp 0.3s ease" }}>
          <div style={{ width:25, height:25, borderRadius:"50%", flexShrink:0, background:m.role==="coach"?`linear-gradient(135deg,${C.accent},${C.accent2})`:C.surface, border:m.role==="user"?`1px solid ${C.border}`:"none", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"0.72rem" }}>
            {m.role==="coach"?"🤖":"👤"}
          </div>
          <div style={{ maxWidth:"83%", padding:"0.6rem 0.8rem", borderRadius:m.role==="coach"?"4px 12px 12px 12px":"12px 4px 12px 12px", background:m.role==="coach"?C.surface:`rgba(0,200,240,0.07)`, border:`1px solid ${m.role==="coach"?C.border:"rgba(0,200,240,0.2)"}`, fontSize:"0.74rem", lineHeight:1.8, color:C.text, whiteSpace:"pre-wrap" }}>
            {m.tag && <div style={{ fontSize:"0.58rem", fontFamily:"monospace", color:m.tag==="warn"?C.warn:m.tag==="good"?C.accent2:C.accent, letterSpacing:1, marginBottom:3 }}>
              {m.tag==="warn"?"⚠️ 주의":m.tag==="good"?"✅ 좋아요!":"💡 코치"}
            </div>}
            {m.content}
          </div>
        </div>
      ))}
      {loading && (
        <div style={{ display:"flex", gap:7 }}>
          <div style={{ width:25, height:25, borderRadius:"50%", background:`linear-gradient(135deg,${C.accent},${C.accent2})`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"0.72rem" }}>🤖</div>
          <div style={{ display:"flex", gap:3, padding:"0.55rem 0.8rem", background:C.surface, borderRadius:"4px 12px 12px 12px", border:`1px solid ${C.border}`, alignItems:"center" }}>
            {[0,1,2].map(i => <div key={i} style={{ width:5, height:5, borderRadius:"50%", background:C.accent, animation:`pulse 1.1s ${i*0.18}s infinite` }}/>)}
          </div>
        </div>
      )}
      <div ref={endRef}/>
    </div>
  );
}

// ══════════════════════════════════
//  메인
// ══════════════════════════════════
export default function App() {
  const [apiConfig, setApiConfig] = useState({ clientId:"", clientSecret:"", mode:"claude" });
  const [showSetup, setShowSetup]   = useState(true);
  const [selectedStock, setSelectedStock] = useState("삼성전자");
  const [activeTab, setActiveTab]   = useState("news");
  const [newsItems, setNewsItems]   = useState([]);
  const [newsLoading, setNewsLoading] = useState(false);
  const [sentiScore, setSentiScore] = useState(null);
  const [sentiSummary, setSentiSummary] = useState("");
  const [newsSource, setNewsSource] = useState(""); // 어떤 소스로 가져왔는지
  const [newsError, setNewsError]   = useState("");

  const [cash, setCash]         = useState(INITIAL_CASH);
  const [holdings, setHoldings] = useState({});
  const [prices, setPrices]     = useState(() => Object.fromEntries(Object.entries(STOCKS).map(([n,s]) => [n, s.price])));
  const [orderType, setOrderType] = useState("buy");
  const [qty, setQty]           = useState(1);
  const [tradeHistory, setTradeHistory] = useState([]);

  const [coachMsgs, setCoachMsgs]   = useState([
    { role:"coach", tag:"tip", content:"안녕하세요! AI 투자 코치입니다 🎯\n\n⚙️ 먼저 우상단 설정 버튼에서 API 모드를 선택해주세요.\n\n✅ Claude 웹서치 — 즉시 사용 가능\n📰 네이버 공식 API — 키 입력 후 사용" }
  ]);
  const [coachLoading, setCoachLoading] = useState(false);

  const addCoach = (content, tag="tip") => setCoachMsgs(p => [...p, { role:"coach", tag, content }]);
  const addUser  = (content)            => setCoachMsgs(p => [...p, { role:"user",  content }]);

  // 가격 변동
  useEffect(() => {
    const id = setInterval(() => {
      setPrices(prev => {
        const next = { ...prev };
        Object.keys(STOCKS).forEach(n => { next[n] = Math.max(next[n] * (1 + (Math.random()-0.495)*0.007), 0.01); });
        return next;
      });
    }, 4000);
    return () => clearInterval(id);
  }, []);

  // 종목 변경 → 뉴스 로드 (설정 완료 후)
  useEffect(() => {
    if (!showSetup) fetchNews(selectedStock);
  }, [selectedStock, showSetup]);

  // ── 뉴스 수집 ──
  async function fetchNews(stockName) {
    setNewsLoading(true); setNewsError(""); setNewsItems([]); setSentiScore(null); setSentiSummary("");
    const s = STOCKS[stockName];

    try {
      let rawNews = [];
      let sourceLabel = "";

      // ① 네이버 공식 API 모드
      if (apiConfig.mode === "naver" && apiConfig.clientId && apiConfig.clientSecret) {
        try {
          const items = await fetchNaverNews(apiConfig.clientId, apiConfig.clientSecret, s.kw, 7);
          rawNews = items.map(it => ({
            title:   stripHtml(it.title),
            summary: stripHtml(it.description),
            pubDate: it.pubDate?.slice(0,16) || "",
            source:  it.link?.includes("news.naver") ? "네이버뉴스" : new URL(it.link).hostname.replace("www.",""),
            link:    it.link,
          }));
          sourceLabel = "네이버 공식 API";
        } catch (e) {
          // 네이버 실패 시 Claude 폴백
          sourceLabel = "Claude 웹서치 (네이버 API 오류로 전환)";
        }
      }

      // ② Claude 웹서치 모드 (또는 네이버 실패 폴백)
      if (rawNews.length === 0) {
        sourceLabel = apiConfig.mode === "claude" ? "Claude 웹서치" : sourceLabel || "Claude 웹서치";
      }

      // ③ Claude AI 감성 분석
      const newsContext = rawNews.length > 0
        ? `다음은 네이버 API로 수집된 실제 뉴스입니다:\n${rawNews.map((n,i)=>`${i+1}. [${n.title}] ${n.summary}`).join("\n")}`
        : `웹 검색으로 "${s.kw}" 관련 최신 뉴스를 찾아주세요.`;

      const prompt = `당신은 주식 뉴스 분석 AI 코치입니다.
${newsContext}

위 정보를 바탕으로 ${rawNews.length===0?"웹 검색 후 ":""}아래 JSON 형식으로만 응답하세요 (마크다운 없이):
{
  "sentiScore": 35,
  "sentiSummary": "전반적 감성 요약 2문장",
  "coachOverall": "AI 코치 종합 코멘트 60자. 이모지 포함.",
  "news": [
    {
      "title": "뉴스 제목",
      "source": "언론사",
      "pubDate": "날짜 또는 시간",
      "sentiment": "호재",
      "impact": "상",
      "summary": "초보자용 요약 100자",
      "coachComment": "투자 영향 한줄 코멘트 40자"
    }
  ]
}
규칙: sentiment는 호재/악재/중립, impact는 상/중/하, sentiScore는 -100~+100, news는 5~7개.`;

      const raw = await callClaude(prompt, rawNews.length === 0);
      const matched = raw.match(/\{[\s\S]*\}/);
      if (!matched) throw new Error("JSON 파싱 실패");
      const result = JSON.parse(matched[0]);

      // 네이버 원본 데이터가 있으면 title/source/pubDate는 원본 우선 사용
      const merged = (result.news || []).map((aiItem, i) => ({
        ...aiItem,
        title:   rawNews[i]?.title   || aiItem.title,
        source:  rawNews[i]?.source  || aiItem.source,
        pubDate: rawNews[i]?.pubDate || aiItem.pubDate,
        link:    rawNews[i]?.link,
      }));

      setSentiScore(result.sentiScore ?? 0);
      setSentiSummary(result.sentiSummary ?? "");
      setNewsItems(merged);
      setNewsSource(sourceLabel);

      addUser(`${stockName} 뉴스 분석 요청`);
      addCoach(result.coachOverall || `${stockName} 분석 완료!`,
        result.sentiScore > 20 ? "good" : result.sentiScore < -20 ? "warn" : "tip");

    } catch (e) {
      setNewsError(`뉴스 수집 오류: ${e.message}`);
    }
    setNewsLoading(false);
  }

  // ── 매수/매도 ──
  async function executeTrade() {
    const name = selectedStock;
    const price = prices[name];
    const total = price * qty;
    if (orderType === "buy") {
      if (total > cash) { addCoach("💰 현금이 부족합니다. 수량을 줄여보세요.", "warn"); return; }
      setCash(c => c - total);
      setHoldings(prev => {
        const h = prev[name];
        if (h) { const nq=h.qty+qty; return {...prev,[name]:{qty:nq,avgPrice:(h.avgPrice*h.qty+price*qty)/nq}}; }
        return {...prev,[name]:{qty,avgPrice:price}};
      });
      setTradeHistory(p => [{ type:"buy",name,qty,price,total,time:new Date().toLocaleTimeString("ko-KR") },...p]);
      setCoachLoading(true); addUser(`${name} ${qty}주 매수`);
      try {
        const sc = sentiScore ?? 0;
        const msg = await callClaude(`주식 초보자가 ${name} ${qty}주 매수. 뉴스감성: ${sc}. 50자 이내 격려+조언. 이모지 포함.`);
        addCoach(msg, sc > 0 ? "good" : "warn");
      } catch { addCoach(`${name} ${qty}주 매수 완료! 👍`, "good"); }
      setCoachLoading(false);
    } else {
      const h = holdings[name];
      if (!h || h.qty < qty) { addCoach("보유 수량이 부족합니다!", "warn"); return; }
      const pnl = (price - h.avgPrice) * qty;
      setCash(c => c + total);
      setHoldings(prev => {
        const nq = prev[name].qty - qty;
        if (nq === 0) { const next={...prev}; delete next[name]; return next; }
        return {...prev,[name]:{...prev[name],qty:nq}};
      });
      setTradeHistory(p => [{ type:"sell",name,qty,price,total,pnl,time:new Date().toLocaleTimeString("ko-KR") },...p]);
      setCoachLoading(true); addUser(`${name} ${qty}주 매도`);
      try {
        const msg = await callClaude(`주식 초보자가 ${name} ${qty}주 매도. 손익 ${pnl>=0?"+":""}${fmt(Math.round(pnl))}원. 50자 이내 조언. 이모지 포함.`);
        addCoach(msg, pnl >= 0 ? "good" : "tip");
      } catch { addCoach(`매도 완료. 손익: ${pnl>=0?"+":""}${fmt(Math.round(pnl))}원`, pnl>=0?"good":"tip"); }
      setCoachLoading(false);
    }
  }

  const totalEval = cash + Object.entries(holdings).reduce((s,[n,h]) => s+h.qty*prices[n], 0);
  const totalPnl  = totalEval - INITIAL_CASH;
  const selStock  = STOCKS[selectedStock];
  const selPrice  = prices[selectedStock];
  const selHeld   = holdings[selectedStock];
  const hoiN = newsItems.filter(n=>n.sentiment==="호재").length;
  const akN  = newsItems.filter(n=>n.sentiment==="악재").length;
  const junN = newsItems.filter(n=>n.sentiment==="중립").length;

  const S = {
    wrap: { fontFamily:"'Noto Sans KR',sans-serif", background:C.bg, color:C.text, height:"100vh", display:"flex", flexDirection:"column", overflow:"hidden" },
    hdr: { background:C.bg2, borderBottom:`1px solid ${C.border}`, padding:"0.55rem 1rem", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 },
    body: { flex:1, display:"flex", overflow:"hidden" },
    leftCol: { width:185, borderRight:`1px solid ${C.border}`, display:"flex", flexDirection:"column", background:C.bg2, flexShrink:0 },
    midCol: { flex:1, display:"flex", flexDirection:"column", overflow:"hidden" },
    rightCol: { width:268, borderLeft:`1px solid ${C.border}`, display:"flex", flexDirection:"column", background:C.bg2, flexShrink:0 },
    tabBtn: a => ({ padding:"0.6rem 1rem", fontSize:"0.7rem", fontFamily:"monospace", letterSpacing:1, border:"none", background:"transparent", color:a?C.accent:C.text2, borderBottom:`2px solid ${a?C.accent:"transparent"}`, cursor:"pointer", transition:"all 0.2s" }),
    stockItem: a => ({ padding:"0.6rem 0.75rem", cursor:"pointer", borderLeft:`3px solid ${a?C.accent:"transparent"}`, background:a?`rgba(0,200,240,0.05)`:"transparent", borderBottom:`1px solid ${C.border}`, transition:"all 0.15s" }),
    secTitle: { fontSize:"0.6rem", color:C.accent, fontFamily:"monospace", letterSpacing:2, borderLeft:`2px solid ${C.accent}`, paddingLeft:6, marginBottom:"0.75rem" },
    orderCard: { background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:"0.9rem", marginBottom:"0.8rem" },
    oTab: (a,buy) => ({ flex:1, padding:"0.42rem", fontSize:"0.74rem", fontWeight:800, border:"none", cursor:"pointer", background:a?(buy?C.accent2:C.danger):"transparent", color:a?C.bg:C.text2, transition:"all 0.2s" }),
    qInput: { flex:1, background:C.bg, border:`1px solid ${C.border}`, borderRadius:7, color:C.text, padding:"0.4rem 0.6rem", fontSize:"0.88rem", fontFamily:"monospace", outline:"none", textAlign:"center" },
    execBtn: buy => ({ width:"100%", padding:"0.6rem", borderRadius:8, border:"none", background:buy?`linear-gradient(135deg,${C.accent2},#00a055)`:`linear-gradient(135deg,${C.danger},#bb1530)`, color:C.bg, fontSize:"0.8rem", fontWeight:800, fontFamily:"'Noto Sans KR',sans-serif", cursor:"pointer", marginTop:6 }),
    qBtn: { padding:"3px 8px", borderRadius:20, fontSize:"0.6rem", border:`1px solid ${C.border}`, background:C.surface, color:C.text2, cursor:"pointer", fontFamily:"'Noto Sans KR',sans-serif" },
  };

  return (
    <div style={S.wrap}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap');
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.25}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:3px;} ::-webkit-scrollbar-thumb{background:${C.border};border-radius:2px;}
        input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none;}
        input::placeholder{color:${C.text3};}
      `}</style>

      {/* 설정 모달 */}
      {showSetup && (
        <ApiSetupModal
          current={apiConfig}
          onSave={cfg => { setApiConfig(cfg); _apiConfig = cfg; setShowSetup(false); }}
          onClose={() => setShowSetup(false)}
        />
      )}

      {/* HEADER */}
      <header style={S.hdr}>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          <div style={{ fontFamily:"monospace", fontWeight:800, fontSize:"0.95rem", letterSpacing:3, color:C.accent }}>
            STOCK<span style={{color:C.accent2}}>COMPASS</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:5, padding:"2px 8px", borderRadius:20, background:`${C.accent2}15`, border:`1px solid ${C.accent2}30` }}>
            <div style={{ width:5, height:5, borderRadius:"50%", background:C.accent2, animation:"pulse 1.5s infinite" }}/>
            <span style={{ fontSize:"0.58rem", fontFamily:"monospace", color:C.accent2, letterSpacing:1 }}>
              {apiConfig.mode === "naver" ? "NAVER API" : "CLAUDE AI"}
            </span>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:"1.2rem" }}>
          {[
            { label:"현금", val:`₩${fmt(Math.round(cash))}`, color:C.accent },
            { label:"총평가", val:`₩${fmt(Math.round(totalEval))}`, color:C.text },
            { label:"손익", val:`${totalPnl>=0?"+":""}${fmt(Math.round(totalPnl))}`, color:totalPnl>=0?C.accent2:C.danger },
          ].map(s => (
            <div key={s.label} style={{ textAlign:"right" }}>
              <div style={{ fontSize:"0.5rem", color:C.text3, fontFamily:"monospace", letterSpacing:1.5 }}>{s.label}</div>
              <div style={{ fontSize:"0.82rem", fontFamily:"monospace", fontWeight:700, color:s.color }}>{s.val}</div>
            </div>
          ))}
          <button onClick={() => setShowSetup(true)} style={{ padding:"4px 10px", borderRadius:8, border:`1px solid ${C.border}`, background:C.surface, color:C.text2, fontSize:"0.65rem", cursor:"pointer", fontFamily:"monospace" }}>
            ⚙️ API 설정
          </button>
        </div>
      </header>

      <div style={S.body}>

        {/* 좌: 종목 리스트 */}
        <div style={S.leftCol}>
          <div style={{ padding:"0.55rem 0.75rem", borderBottom:`1px solid ${C.border}`, fontSize:"0.58rem", color:C.text3, fontFamily:"monospace", letterSpacing:1.5 }}>📋 종목</div>
          <div style={{ flex:1, overflowY:"auto" }}>
            {Object.entries(STOCKS).map(([name, s]) => {
              const cur = prices[name];
              const isUp = cur >= s.price;
              const chg = ((cur-s.price)/s.price*100).toFixed(2);
              return (
                <div key={name} style={S.stockItem(selectedStock===name)} onClick={() => setSelectedStock(name)}>
                  <div style={{ fontSize:"0.78rem", fontWeight:600, marginBottom:1 }}>{name}</div>
                  <div style={{ fontSize:"0.58rem", color:C.text3, fontFamily:"monospace", marginBottom:3 }}>{s.ticker}</div>
                  <div style={{ display:"flex", justifyContent:"space-between" }}>
                    <span style={{ fontSize:"0.7rem", fontFamily:"monospace", fontWeight:700 }}>
                      {s.market==="US"?"$"+cur.toFixed(1):fmt(Math.round(cur))}
                    </span>
                    <span style={{ fontSize:"0.62rem", fontFamily:"monospace", color:isUp?C.accent2:C.danger }}>
                      {isUp?"▲":"▼"}{Math.abs(chg)}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 중앙 */}
        <div style={S.midCol}>
          {/* 종목 바 */}
          <div style={{ padding:"0.55rem 1rem", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", justifyContent:"space-between", background:C.bg2, flexShrink:0 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:"0.95rem", fontWeight:800, fontFamily:"monospace" }}>{selectedStock}</span>
              <span style={{ fontSize:"0.58rem", color:C.text3, fontFamily:"monospace" }}>{selStock?.sector}</span>
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ fontFamily:"monospace", fontSize:"0.95rem", fontWeight:800 }}>
                {selStock?.market==="US"?"$"+selPrice.toFixed(2):fmt(Math.round(selPrice))}
              </span>
              <span style={{ fontFamily:"monospace", fontSize:"0.7rem", color:selPrice>=(selStock?.price||1)?C.accent2:C.danger }}>
                {selPrice>=(selStock?.price||1)?"▲":"▼"} {Math.abs(((selPrice-(selStock?.price||1))/(selStock?.price||1)*100)).toFixed(2)}%
              </span>
              <button onClick={() => fetchNews(selectedStock)} disabled={newsLoading} style={{ padding:"3px 9px", borderRadius:6, border:`1px solid ${C.border}`, background:C.surface, color:C.accent, fontSize:"0.62rem", cursor:"pointer", fontFamily:"monospace" }}>
                {newsLoading ? "⏳" : "🔄"} 새로고침
              </button>
            </div>
          </div>

          {/* 탭 */}
          <div style={{ display:"flex", borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
            {[["news","📰 뉴스 분석"],["trade","💹 주문"],["portfolio","💼 포트폴리오"],["history","📋 거래내역"]].map(([k,l]) => (
              <button key={k} style={S.tabBtn(activeTab===k)} onClick={() => setActiveTab(k)}>{l}</button>
            ))}
          </div>

          <div style={{ flex:1, overflowY:"auto", padding:"1rem" }}>

            {/* 뉴스 탭 */}
            {activeTab==="news" && (
              newsLoading ? (
                <div style={{ textAlign:"center", padding:"3rem", color:C.text2 }}>
                  <div style={{ fontSize:"2.2rem", marginBottom:"0.8rem", animation:"spin 1s linear infinite", display:"inline-block" }}>🔍</div>
                  <div style={{ fontFamily:"monospace", fontSize:"0.78rem", color:C.accent, marginBottom:4 }}>뉴스 수집 & AI 감성 분석 중...</div>
                  <div style={{ fontSize:"0.68rem", color:C.text3 }}>
                    {apiConfig.mode==="naver" ? "네이버 공식 API → Claude AI 감성분석" : "Claude 웹서치 → AI 감성분석"}
                  </div>
                </div>
              ) : newsError ? (
                <div style={{ textAlign:"center", padding:"2rem", color:C.danger }}>
                  <div style={{ fontSize:"1.8rem", marginBottom:"0.5rem" }}>⚠️</div>
                  <div style={{ fontSize:"0.8rem", marginBottom:"1rem" }}>{newsError}</div>
                  <button onClick={() => fetchNews(selectedStock)} style={{ padding:"0.5rem 1.2rem", borderRadius:8, border:`1px solid ${C.accent}`, background:"transparent", color:C.accent, cursor:"pointer", fontSize:"0.78rem" }}>다시 시도</button>
                </div>
              ) : (
                <>
                  {/* 감성 요약 */}
                  {sentiScore !== null && (
                    <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:"1rem", marginBottom:"1rem" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"0.8rem" }}>
                        <div style={S.secTitle}>AI 감성 분석 — {selectedStock}</div>
                        {newsSource && <span style={{ fontSize:"0.55rem", color:C.text3, fontFamily:"monospace", background:C.bg, padding:"2px 7px", borderRadius:4, border:`1px solid ${C.border}` }}>{newsSource}</span>}
                      </div>
                      <SentiMeter score={sentiScore}/>
                      <div style={{ display:"flex", gap:6, marginBottom:"0.8rem" }}>
                        {[["호재",hoiN,C.accent2],["중립",junN,C.gold],["악재",akN,C.danger]].map(([l,c,col]) => (
                          <div key={l} style={{ flex:1, background:`${col}10`, border:`1px solid ${col}30`, borderRadius:8, padding:"0.5rem", textAlign:"center" }}>
                            <div style={{ fontSize:"1rem", fontWeight:800, fontFamily:"monospace", color:col }}>{c}</div>
                            <div style={{ fontSize:"0.58rem", color:col, fontFamily:"monospace", letterSpacing:1 }}>{l}</div>
                          </div>
                        ))}
                      </div>
                      {sentiSummary && (
                        <div style={{ fontSize:"0.74rem", color:C.text2, lineHeight:1.75, padding:"0.6rem 0.8rem", background:`rgba(0,200,240,0.04)`, borderRadius:7, border:`1px solid ${C.accent}15` }}>
                          📊 {sentiSummary}
                        </div>
                      )}
                    </div>
                  )}
                  <div style={S.secTitle}>최신 뉴스 {newsItems.length}건</div>
                  {newsItems.map((item, i) => <NewsCard key={i} item={item} idx={i}/>)}
                  <div style={{ padding:"0.6rem 0.8rem", background:`rgba(255,140,66,0.06)`, border:`1px solid ${C.warn}25`, borderRadius:7, fontSize:"0.6rem", color:C.warn, lineHeight:1.8, marginTop:8 }}>
                    ⚖️ 본 분석은 참고용입니다. 투자 권유가 아니며 실제 투자 시 원문 기사를 확인하세요.
                  </div>
                </>
              )
            )}

            {/* 주문 탭 */}
            {activeTab==="trade" && (
              <div>
                <div style={S.orderCard}>
                  <div style={S.secTitle}>주문</div>
                  <div style={{ display:"flex", borderRadius:7, overflow:"hidden", border:`1px solid ${C.border}`, marginBottom:"0.7rem" }}>
                    <button style={S.oTab(orderType==="buy",true)}  onClick={() => setOrderType("buy")}>📈 매수</button>
                    <button style={S.oTab(orderType==="sell",false)} onClick={() => setOrderType("sell")}>📉 매도</button>
                  </div>
                  <div style={{ display:"flex", gap:7, alignItems:"center", marginBottom:"0.7rem" }}>
                    <button style={{ width:28, height:28, borderRadius:7, border:`1px solid ${C.border}`, background:C.bg, color:C.text, fontSize:"1rem", cursor:"pointer" }} onClick={() => setQty(q=>Math.max(1,q-1))}>−</button>
                    <input type="number" style={S.qInput} value={qty} min={1} onChange={e => setQty(Math.max(1,parseInt(e.target.value)||1))}/>
                    <button style={{ width:28, height:28, borderRadius:7, border:`1px solid ${C.border}`, background:C.bg, color:C.text, fontSize:"1rem", cursor:"pointer" }} onClick={() => setQty(q=>q+1)}>+</button>
                    <span style={{ fontSize:"0.7rem", color:C.text3 }}>주</span>
                  </div>
                  {[
                    ["주문금액", `₩${fmt(Math.round(selPrice*qty))}`, C.text],
                    orderType==="buy" ? ["잔여현금", `₩${fmt(Math.round(cash-selPrice*qty))}`, selPrice*qty>cash?C.danger:C.text2] : null,
                    selHeld ? ["보유수량", `${selHeld.qty}주 (평균 ${fmt(Math.round(selHeld.avgPrice))})`, C.text2] : null,
                  ].filter(Boolean).map(([l,v,c]) => (
                    <div key={l} style={{ display:"flex", justifyContent:"space-between", fontSize:"0.68rem", fontFamily:"monospace", color:C.text2, marginBottom:3 }}>
                      <span>{l}</span><span style={{ fontWeight:700, color:c }}>{v}</span>
                    </div>
                  ))}

                  {/* 뉴스 감성 연동 경고 */}
                  {sentiScore !== null && orderType==="buy" && (
                    <div style={{ marginTop:6, padding:"0.45rem 0.65rem", borderRadius:6, fontSize:"0.65rem", lineHeight:1.65, background:sentiScore < -30?`${C.danger}10`:`${C.accent2}10`, border:`1px solid ${sentiScore < -30?C.danger:C.accent2}30`, color:sentiScore < -30?C.danger:C.accent2 }}>
                      {sentiScore < -30 ? `⚠️ 뉴스 감성 부정적 (${sentiScore}). 분할매수를 고려하세요.` : `✅ 뉴스 감성 긍정적 (${sentiScore > 0?"+":""}${sentiScore}).`}
                    </div>
                  )}

                  <button style={S.execBtn(orderType==="buy")} onClick={executeTrade}>
                    {orderType==="buy" ? `📈 ${selectedStock} ${qty}주 매수` : `📉 ${selectedStock} ${qty}주 매도`}
                  </button>
                </div>
                <div style={{ padding:"0.55rem 0.75rem", background:`rgba(255,140,66,0.06)`, border:`1px solid ${C.warn}25`, borderRadius:7, fontSize:"0.6rem", color:C.warn, lineHeight:1.7 }}>
                  ⚠️ 모의투자 시뮬레이션입니다. 실제 투자가 아닙니다.
                </div>
              </div>
            )}

            {/* 포트폴리오 */}
            {activeTab==="portfolio" && (
              <div>
                <div style={S.secTitle}>보유 종목</div>
                {Object.keys(holdings).length === 0 ? (
                  <div style={{ textAlign:"center", padding:"2rem", color:C.text3, fontSize:"0.78rem" }}>
                    <div style={{ fontSize:"2rem", marginBottom:"0.5rem" }}>📭</div>보유 종목 없음
                  </div>
                ) : Object.entries(holdings).map(([name, h]) => {
                  const cur = prices[name]; const pnl=(cur-h.avgPrice)*h.qty;
                  return (
                    <div key={name} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:9, padding:"0.85rem", marginBottom:"0.55rem", borderLeft:`3px solid ${pnl>=0?C.accent2:C.danger}` }}>
                      <div style={{ display:"flex", justifyContent:"space-between" }}>
                        <div>
                          <div style={{ fontSize:"0.85rem", fontWeight:700 }}>{name}</div>
                          <div style={{ fontSize:"0.6rem", color:C.text3, fontFamily:"monospace", marginTop:2 }}>{h.qty}주 · 평균 {fmt(Math.round(h.avgPrice))}</div>
                        </div>
                        <div style={{ textAlign:"right" }}>
                          <div style={{ fontFamily:"monospace", fontSize:"0.85rem", fontWeight:700 }}>₩{fmt(Math.round(cur*h.qty))}</div>
                          <div style={{ fontFamily:"monospace", fontSize:"0.68rem", color:pnl>=0?C.accent2:C.danger }}>{pnl>=0?"+":""}{fmt(Math.round(pnl))} ({((pnl/(h.avgPrice*h.qty))*100).toFixed(2)}%)</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 거래내역 */}
            {activeTab==="history" && (
              <div>
                <div style={S.secTitle}>거래 내역</div>
                {tradeHistory.length === 0 ? (
                  <div style={{ textAlign:"center", padding:"2rem", color:C.text3, fontSize:"0.78rem" }}>
                    <div style={{ fontSize:"2rem", marginBottom:"0.5rem" }}>📋</div>거래 내역 없음
                  </div>
                ) : tradeHistory.map((t, i) => (
                  <div key={i} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:"0.7rem 0.85rem", marginBottom:"0.45rem", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div>
                      <span style={{ display:"inline-block", padding:"1px 6px", borderRadius:4, fontSize:"0.58rem", fontFamily:"monospace", fontWeight:800, background:t.type==="buy"?`${C.accent2}20`:`${C.danger}20`, color:t.type==="buy"?C.accent2:C.danger, marginRight:5 }}>
                        {t.type==="buy"?"매수":"매도"}
                      </span>
                      <span style={{ fontSize:"0.8rem", fontWeight:600 }}>{t.name}</span>
                      <div style={{ fontSize:"0.6rem", color:C.text3, fontFamily:"monospace", marginTop:2 }}>{t.qty}주 · {fmt(Math.round(t.price))} · {t.time}</div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontFamily:"monospace", fontSize:"0.78rem" }}>₩{fmt(Math.round(t.total))}</div>
                      {t.pnl !== undefined && <div style={{ fontFamily:"monospace", fontSize:"0.65rem", color:t.pnl>=0?C.accent2:C.danger }}>{t.pnl>=0?"+":""}{fmt(Math.round(t.pnl))}</div>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 우: AI 코치 */}
        <div style={S.rightCol}>
          <div style={{ padding:"0.6rem 0.85rem", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:6, flexShrink:0 }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:C.accent2, animation:"pulse 1.5s infinite" }}/>
            <span style={{ fontFamily:"monospace", fontSize:"0.65rem", fontWeight:800, color:C.accent, letterSpacing:2 }}>AI 투자 코치</span>
            <span style={{ marginLeft:"auto", fontSize:"0.52rem", color:C.text3, fontFamily:"monospace" }}>CLAUDE</span>
          </div>
          <CoachChat messages={coachMsgs} loading={coachLoading}/>
          <div style={{ padding:"0.5rem", borderTop:`1px solid ${C.border}`, display:"flex", flexWrap:"wrap", gap:4 }}>
            {["뉴스 요약","지금 사도 돼?","분산투자 방법","손절이란?"].map(q => (
              <button key={q} style={S.qBtn} onClick={async () => {
                addUser(q);
                setCoachLoading(true);
                try {
                  const ctx = `종목: ${selectedStock}, 감성점수: ${sentiScore ?? "분석전"}.`;
                  const msg = await callClaude(`${ctx} 초보자가 "${q}" 질문. 70자 내외 친근하게. 이모지 포함.`);
                  addCoach(msg, "tip");
                } catch { addCoach("잠시 후 다시 시도해주세요."); }
                setCoachLoading(false);
              }}>{q}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
