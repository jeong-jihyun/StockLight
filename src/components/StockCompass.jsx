import { useState, useEffect, useRef } from "react";

const COLORS = {
  bg: "#070c14", bg2: "#0d1520", bg3: "#111d2e",
  surface: "#162032", border: "#1e3048",
  accent: "#00d4ff", accent2: "#00ff9d",
  gold: "#ffd166", danger: "#ff4757",
  text: "#e8f4fd", text2: "#7a9bb5", text3: "#3d5a73",
};

const MARKET_PICKS = {
  "한국주식": ["삼성전자","SK하이닉스","카카오","현대차","LG에너지솔루션","POSCO홀딩스"],
  "미국주식": ["NVIDIA","APPLE","TESLA","MICROSOFT","AMAZON","META"],
  "ETF":      ["QQQ","SPY","KODEX200","TIGER미국S&P500","KODEX반도체","TIGER나스닥100"],
  "암호화폐": ["비트코인","이더리움","리플","솔라나","에이다","도지코인"],
};

const TICKERS = [
  { name:"KOSPI",  price:"2,634.82", chg:"+1.24%", up:true },
  { name:"KOSDAQ", price:"871.45",   chg:"-0.38%", up:false },
  { name:"S&P500", price:"5,218.04", chg:"+0.87%", up:true },
  { name:"NASDAQ", price:"16,274",   chg:"+1.12%", up:true },
  { name:"BTC/USD",price:"87,432",   chg:"-2.14%", up:false },
  { name:"ETH/USD",price:"3,941",    chg:"+0.56%", up:true },
  { name:"USD/KRW",price:"1,327.5",  chg:"+0.21%", up:true },
  { name:"QQQ",    price:"441.28",   chg:"+1.08%", up:true },
];

const CURRICULUM = [
  { title:"주식의 기본 개념",  sub:"주식이란? 시장 구조 이해",        state:"done" },
  { title:"재무제표 읽기",     sub:"손익계산서·재무상태표·현금흐름",  state:"done" },
  { title:"종목 분석 방법",    sub:"PER·PBR·ROE 활용법 학습 중",     state:"active" },
  { title:"차트 기술적 분석",  sub:"이동평균·RSI·볼린저밴드",         state:"todo" },
  { title:"ETF·분산투자 전략", sub:"리스크를 줄이는 포트폴리오 구성", state:"todo" },
  { title:"미국주식·환율",     sub:"해외 투자 시 고려사항",           state:"todo" },
  { title:"나만의 투자 원칙",  sub:"손절·익절·장기 전략 수립",        state:"todo" },
];

const PORTFOLIO = [
  { name:"삼성전자", sub:"10주 · 매입가 72,400",  pnl:"+12.4%", up:true },
  { name:"NVIDIA",   sub:"3주 · 매입가 $891",     pnl:"+24.1%", up:true },
  { name:"QQQ ETF",  sub:"5주 · 매입가 $412",     pnl:"+7.1%",  up:true },
  { name:"카카오",   sub:"20주 · 매입가 58,300",  pnl:"-14.2%", up:false },
];

const LOADING_STEPS = [
  "📡 실시간 시장 데이터 수집 중",
  "📊 재무제표 파싱 중",
  "🧠 AI 심층 분석 중",
  "⚖️ 리스크 평가 중",
  "✅ 리포트 생성 완료",
];

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── 타이핑 효과 훅 ──
function useTyping(text, speed = 16) {
  const [displayed, setDisplayed] = useState("");
  useEffect(() => {
    if (!text) { setDisplayed(""); return; }
    setDisplayed("");
    let i = 0;
    const id = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text]);
  return displayed;
}

export default function StockCompass() {
  const [market, setMarket] = useState("한국주식");
  const [input, setInput] = useState("");
  const [analysisType, setAnalysisType] = useState("종합분석");
  const [phase, setPhase] = useState("idle"); // idle | loading | result | error
  const [stepIdx, setStepIdx] = useState(-1);
  const [result, setResult] = useState(null);
  const [activeNav, setActiveNav] = useState("AI 분석");
  const [riskWidth, setRiskWidth] = useState(0);

  const typedAnalysis = useTyping(result?.analysis || "", 14);

  useEffect(() => {
    if (result) {
      setTimeout(() => setRiskWidth(result.riskLevel || 50), 200);
    } else {
      setRiskWidth(0);
    }
  }, [result]);

  async function runAnalysis(name) {
    const stock = name || input.trim();
    if (!stock) return;
    setInput(stock);
    setPhase("loading");
    setStepIdx(-1);
    setResult(null);

    for (let i = 0; i < LOADING_STEPS.length; i++) {
      await delay(550);
      setStepIdx(i);
    }

    try {
      const prompt = `당신은 세계 최고의 주식 투자 분석 AI입니다. 아래 종목을 "${analysisType}" 방식으로 분석하세요.

종목: ${stock}
시장: ${market}

반드시 JSON만 응답하세요 (마크다운 없이):
{
  "name": "종목 정식명칭",
  "ticker": "티커/종목코드",
  "score": 75,
  "verdict": "매수검토",
  "verdictEmoji": "🟢",
  "verdictDetail": "현재 가격대에서 분할매수 전략이 유효합니다",
  "riskLevel": 45,
  "riskColor": "#ffd166",
  "metrics": [
    {"label":"PER","value":"12.4x","type":"neutral"},
    {"label":"PBR","value":"0.8x","type":"positive"},
    {"label":"ROE","value":"18.2%","type":"positive"},
    {"label":"부채비율","value":"42%","type":"positive"},
    {"label":"영업이익률","value":"22.1%","type":"positive"},
    {"label":"배당수익률","value":"2.8%","type":"neutral"}
  ],
  "analysis": "2~3문단의 심층 분석. 재무 건전성, 성장성, 리스크 포함. 초보자도 이해하기 쉽게.",
  "checklist": [
    {"icon":"ok","text":"재무 건전성 양호 — 부채비율 업종 평균 이하"},
    {"icon":"ok","text":"매출 성장세 3년 연속 유지"},
    {"icon":"warn","text":"글로벌 경기 둔화 영향 모니터링 필요"},
    {"icon":"bad","text":"단기 기술적 지표 과매도 구간 진입"}
  ]
}`;

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await res.json();
      const raw = data.content.map(b => b.text || "").join("");
      const clean = raw.replace(/```json|```/g, "").trim();
      setResult(JSON.parse(clean));
      setPhase("result");
    } catch (e) {
      setPhase("error");
    }
  }

  const scoreClass = result
    ? result.score >= 70 ? COLORS.accent2 : result.score >= 50 ? COLORS.gold : COLORS.danger
    : COLORS.text3;

  const riskColor = result?.riskColor || COLORS.gold;

  // ── 스타일 헬퍼 ──
  const S = {
    wrap: { fontFamily:"'Noto Sans KR',sans-serif", background:COLORS.bg, color:COLORS.text, minHeight:"100vh", position:"relative" },
    header: { position:"sticky", top:0, zIndex:100, background:"rgba(7,12,20,0.94)", backdropFilter:"blur(20px)", borderBottom:`1px solid ${COLORS.border}`, padding:"0 1.2rem" },
    headerInner: { maxWidth:1200, margin:"0 auto", display:"flex", alignItems:"center", justifyContent:"space-between", height:56 },
    logo: { fontFamily:"'Bebas Neue',cursive,sans-serif", fontSize:"1.6rem", letterSpacing:3, color:COLORS.accent, textShadow:`0 0 20px rgba(0,212,255,0.4)` },
    navPills: { display:"flex", gap:6 },
    navPill: (active) => ({ padding:"5px 14px", borderRadius:20, fontSize:"0.75rem", fontWeight:600, cursor:"pointer", border:`1px solid ${active ? COLORS.accent : COLORS.border}`, background: active ? COLORS.accent : "transparent", color: active ? COLORS.bg : COLORS.text2, transition:"all 0.2s" }),
    liveBadge: { display:"flex", alignItems:"center", gap:6, fontFamily:"monospace", fontSize:"0.7rem", color:COLORS.accent2 },
    liveDot: { width:8, height:8, borderRadius:"50%", background:COLORS.accent2, animation:"pulse 1.5s infinite" },
    main: { maxWidth:1200, margin:"0 auto", padding:"1.2rem" },
    // ticker
    tickerBar: { background:COLORS.bg2, border:`1px solid ${COLORS.border}`, borderRadius:12, padding:"0.9rem 1.2rem", marginBottom:"1.2rem" },
    tickerLabel: { fontFamily:"monospace", fontSize:"0.6rem", letterSpacing:2, color:COLORS.text3, marginBottom:8 },
    tickerItems: { display:"flex", gap:"1.5rem", flexWrap:"wrap" },
    tickerItem: { display:"flex", flexDirection:"column", gap:2, minWidth:90 },
    tickerName: { fontFamily:"monospace", fontSize:"0.62rem", color:COLORS.text3, letterSpacing:1 },
    tickerPrice: { fontFamily:"monospace", fontSize:"0.9rem", fontWeight:600 },
    tickerChg: (up) => ({ fontFamily:"monospace", fontSize:"0.7rem", fontWeight:700, color: up ? COLORS.accent2 : COLORS.danger }),
    // grid
    grid: { display:"grid", gridTemplateColumns:"1fr 340px", gap:"1.2rem", alignItems:"start" },
    panel: { background:COLORS.bg2, border:`1px solid ${COLORS.border}`, borderRadius:16, overflow:"hidden" },
    panelHdr: { padding:"1rem 1.2rem", borderBottom:`1px solid ${COLORS.border}`, display:"flex", alignItems:"center", justifyContent:"space-between" },
    panelTitle: { fontFamily:"monospace", fontSize:"0.9rem", letterSpacing:2, color:COLORS.accent, fontWeight:700 },
    panelBody: { padding:"1.2rem" },
    // market tabs
    marketTabs: { display:"flex", gap:6, marginBottom:"1rem", flexWrap:"wrap" },
    mTab: (active) => ({ padding:"6px 14px", borderRadius:8, fontSize:"0.78rem", fontWeight:600, cursor:"pointer", border:`1px solid ${active ? COLORS.accent : COLORS.border}`, background: active ? COLORS.accent : "transparent", color: active ? COLORS.bg : COLORS.text2, transition:"all 0.2s" }),
    // search
    searchRow: { display:"flex", gap:8, marginBottom:"0.8rem" },
    select: { background:COLORS.surface, border:`1px solid ${COLORS.border}`, borderRadius:10, color:COLORS.text, padding:"8px 10px", fontSize:"0.82rem", fontFamily:"'Noto Sans KR',sans-serif", outline:"none", minWidth:110 },
    input: { flex:1, background:COLORS.surface, border:`1px solid ${COLORS.border}`, borderRadius:10, color:COLORS.text, padding:"8px 14px", fontSize:"0.85rem", fontFamily:"'Noto Sans KR',sans-serif", outline:"none" },
    analyzeBtn: (disabled) => ({ background: disabled ? "#1e3048" : `linear-gradient(135deg,${COLORS.accent},#0099cc)`, border:"none", borderRadius:10, color: disabled ? COLORS.text3 : COLORS.bg, padding:"8px 18px", fontSize:"0.82rem", fontWeight:800, fontFamily:"'Noto Sans KR',sans-serif", cursor: disabled ? "not-allowed" : "pointer", letterSpacing:1, transition:"all 0.2s", whiteSpace:"nowrap" }),
    quickPicks: { display:"flex", flexWrap:"wrap", gap:6, marginBottom:"1rem" },
    qPick: { padding:"4px 12px", borderRadius:20, fontSize:"0.72rem", fontFamily:"monospace", cursor:"pointer", border:`1px solid ${COLORS.border}`, color:COLORS.text2, background:COLORS.surface, transition:"all 0.2s", letterSpacing:"0.5px" },
    // result
    stkHdr: { display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:"1.2rem", paddingBottom:"1.2rem", borderBottom:`1px solid ${COLORS.border}` },
    stkName: { fontFamily:"'Bebas Neue',cursive,sans-serif", fontSize:"1.7rem", letterSpacing:2, lineHeight:1, marginBottom:4 },
    stkSub: { fontFamily:"monospace", fontSize:"0.68rem", color:COLORS.text3, letterSpacing:1 },
    scoreWrap: { textAlign:"right" },
    scoreLabel: { fontSize:"0.6rem", color:COLORS.text3, letterSpacing:1.5, marginBottom:4 },
    scoreCircle: (color) => ({ width:64, height:64, borderRadius:"50%", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", border:`3px solid ${color}`, marginLeft:"auto" }),
    scoreNum: (color) => ({ fontFamily:"'Bebas Neue',cursive,sans-serif", fontSize:"1.5rem", lineHeight:1, color, letterSpacing:1 }),
    metricsGrid: { display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:"1.2rem" },
    metricCard: { background:COLORS.surface, border:`1px solid ${COLORS.border}`, borderRadius:10, padding:"0.8rem" },
    metricLabel: { fontFamily:"monospace", fontSize:"0.6rem", color:COLORS.text3, letterSpacing:1.5, marginBottom:4 },
    metricValue: (type) => ({ fontFamily:"monospace", fontSize:"0.95rem", fontWeight:700, color: type==="positive" ? COLORS.accent2 : type==="negative" ? COLORS.danger : COLORS.gold }),
    sectionTitle: { fontFamily:"monospace", fontSize:"0.65rem", letterSpacing:2, color:COLORS.accent, borderLeft:`2px solid ${COLORS.accent}`, paddingLeft:8, marginBottom:"0.8rem" },
    verdictBar: { background:COLORS.surface, border:`1px solid ${COLORS.border}`, borderRadius:12, padding:"1rem", marginBottom:"1.2rem", display:"flex", alignItems:"center", gap:"0.8rem" },
    aiOutput: { background:COLORS.surface, border:`1px solid ${COLORS.border}`, borderRadius:12, padding:"1rem 1rem 1rem", marginBottom:"1.2rem", fontSize:"0.82rem", lineHeight:1.9, color:COLORS.text2, whiteSpace:"pre-wrap", wordBreak:"keep-all", position:"relative", minHeight:80 },
    aiTag: { position:"absolute", top:-1, right:12, background:COLORS.accent, color:COLORS.bg, fontFamily:"monospace", fontSize:"0.55rem", letterSpacing:1.5, padding:"2px 8px", borderRadius:"0 0 6px 6px", fontWeight:800 },
    riskBarWrap: { background:COLORS.surface, borderRadius:20, height:8, position:"relative", overflow:"hidden", marginTop:6 },
    riskFill: (color, w) => ({ height:"100%", borderRadius:20, background:color, width:`${w}%`, transition:"width 1s ease" }),
    riskLabels: { display:"flex", justifyContent:"space-between", fontFamily:"monospace", fontSize:"0.6rem", color:COLORS.text3, marginTop:4 },
    checkItem: { display:"flex", alignItems:"center", gap:10, fontSize:"0.8rem", color:COLORS.text2, marginBottom:8 },
    checkIcon: (type) => ({ width:20, height:20, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"0.65rem", flexShrink:0, background: type==="ok" ? "rgba(0,255,157,0.15)" : type==="warn" ? "rgba(255,209,102,0.15)" : "rgba(255,71,87,0.15)", color: type==="ok" ? COLORS.accent2 : type==="warn" ? COLORS.gold : COLORS.danger }),
    simBtn: { width:"100%", padding:"10px", borderRadius:10, border:`1px solid ${COLORS.accent2}`, background:"rgba(0,255,157,0.05)", color:COLORS.accent2, fontSize:"0.82rem", fontWeight:700, fontFamily:"'Noto Sans KR',sans-serif", cursor:"pointer", letterSpacing:1, marginTop:"1rem" },
    // side
    sidePanels: { display:"flex", flexDirection:"column", gap:"1.2rem" },
    currStep: (state) => ({ display:"flex", alignItems:"center", gap:10, padding:"0.7rem 0.8rem", borderRadius:10, border:`1px solid ${state==="active" ? "rgba(0,212,255,0.3)" : "transparent"}`, background: state==="active" ? "rgba(0,212,255,0.05)" : "transparent", opacity: state==="done" ? 0.5 : 1, cursor:"pointer" }),
    currNum: (state) => ({ width:26, height:26, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"monospace", fontSize:"0.72rem", fontWeight:700, flexShrink:0, background: state==="done" ? COLORS.accent2 : state==="active" ? COLORS.accent : COLORS.surface, color: state==="done"||state==="active" ? COLORS.bg : COLORS.text3, border: state==="todo" ? `1px solid ${COLORS.border}` : "none" }),
    portRow: { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0.6rem 0", borderBottom:`1px solid ${COLORS.border}` },
    disclaimer: { textAlign:"center", padding:"1.2rem", fontSize:"0.65rem", color:COLORS.text3, borderTop:`1px solid ${COLORS.border}`, marginTop:"1.5rem", lineHeight:1.9 },
  };

  return (
    <div style={S.wrap}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Noto+Sans+KR:wght@300;400;500;700&family=JetBrains+Mono:wght@400;600&display=swap');
        @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(0.8)} }
        @keyframes barDance { 0%,100%{height:10px;opacity:0.4} 50%{height:36px;opacity:1} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        * { box-sizing: border-box; margin:0; padding:0; }
        input::placeholder { color: #3d5a73; }
        select option { background: #0d1520; }
        ::-webkit-scrollbar { width:4px; }
        ::-webkit-scrollbar-thumb { background:#1e3048; border-radius:2px; }
      `}</style>

      {/* HEADER */}
      <header style={S.header}>
        <div style={S.headerInner}>
          <div style={S.logo}>STOCK<span style={{color:COLORS.accent2}}>COMPASS</span></div>
          <div style={S.navPills}>
            {["AI 분석","모의투자","학습","포트폴리오"].map(n => (
              <button key={n} style={S.navPill(activeNav===n)} onClick={()=>setActiveNav(n)}>{n}</button>
            ))}
          </div>
          <div style={S.liveBadge}>
            <div style={S.liveDot}/>
            LIVE DATA
          </div>
        </div>
      </header>

      <div style={S.main}>

        {/* TICKER */}
        <div style={S.tickerBar}>
          <div style={S.tickerLabel}>⚡ LIVE MARKET — 2026.03.24</div>
          <div style={S.tickerItems}>
            {TICKERS.map(t => (
              <div key={t.name} style={S.tickerItem}>
                <span style={S.tickerName}>{t.name}</span>
                <span style={S.tickerPrice}>{t.price}</span>
                <span style={S.tickerChg(t.up)}>{t.up?"▲":"▼"} {t.chg}</span>
              </div>
            ))}
          </div>
        </div>

        {/* MAIN GRID */}
        <div style={S.grid}>

          {/* LEFT: AI 분석 패널 */}
          <div style={S.panel}>
            <div style={S.panelHdr}>
              <div style={S.panelTitle}>🤖 AI 투자 분석 엔진</div>
              <span style={{fontFamily:"monospace",fontSize:"0.65rem",color:COLORS.text3}}>POWERED BY CLAUDE</span>
            </div>
            <div style={S.panelBody}>

              {/* 시장 탭 */}
              <div style={S.marketTabs}>
                {Object.keys(MARKET_PICKS).map(m => (
                  <button key={m} style={S.mTab(market===m)} onClick={()=>{ setMarket(m); setPhase("idle"); setResult(null); }}>
                    {m==="한국주식"?"🇰🇷":m==="미국주식"?"🇺🇸":m==="ETF"?"📊":"₿"} {m}
                  </button>
                ))}
              </div>

              {/* 검색 */}
              <div style={S.searchRow}>
                <select style={S.select} value={analysisType} onChange={e=>setAnalysisType(e.target.value)}>
                  {["종합분석","재무분석","기술적분석","리스크분석"].map(t=><option key={t}>{t}</option>)}
                </select>
                <input
                  style={S.input}
                  value={input}
                  onChange={e=>setInput(e.target.value)}
                  onKeyDown={e=>e.key==="Enter" && runAnalysis()}
                  placeholder="종목명 입력 (예: 삼성전자, NVDA, 비트코인)"
                />
                <button
                  style={S.analyzeBtn(phase==="loading")}
                  onClick={()=>runAnalysis()}
                  disabled={phase==="loading"}
                >
                  분석 →
                </button>
              </div>

              {/* 빠른 선택 */}
              <div style={S.quickPicks}>
                {MARKET_PICKS[market].map(p => (
                  <span key={p} style={S.qPick} onClick={()=>runAnalysis(p)}>{p}</span>
                ))}
              </div>

              {/* 결과 영역 */}
              <div style={{minHeight:280}}>

                {/* IDLE */}
                {phase==="idle" && (
                  <div style={{textAlign:"center",padding:"2.5rem 1rem",color:COLORS.text3}}>
                    <div style={{fontSize:"2.5rem",marginBottom:"1rem",opacity:0.4}}>🔭</div>
                    <p style={{fontSize:"0.82rem",lineHeight:2}}>
                      종목명이나 티커를 입력하고<br/>
                      <strong style={{color:COLORS.text2}}>AI 분석 시작</strong>을 누르세요.<br/>
                      재무제표 · 기술적 지표 · 리스크를 한 번에 분석합니다.
                    </p>
                  </div>
                )}

                {/* LOADING */}
                {phase==="loading" && (
                  <div style={{padding:"1.5rem",textAlign:"center"}}>
                    <div style={{display:"flex",justifyContent:"center",alignItems:"flex-end",gap:4,height:44,marginBottom:"1rem"}}>
                      {[0,1,2,3,4].map(i=>(
                        <div key={i} style={{width:6,background:i%2===0?COLORS.accent:COLORS.accent2,borderRadius:3,animation:`barDance 1.2s ease-in-out ${i*0.1}s infinite`}}/>
                      ))}
                    </div>
                    <div style={{fontFamily:"monospace",fontSize:"0.78rem",color:COLORS.accent,marginBottom:"1rem"}}>AI 분석 중...</div>
                    <div style={{display:"flex",flexDirection:"column",gap:6,textAlign:"left",maxWidth:260,margin:"0 auto"}}>
                      {LOADING_STEPS.map((s,i)=>(
                        <div key={i} style={{fontSize:"0.72rem",color:i<stepIdx?COLORS.text3:i===stepIdx?COLORS.accent2:COLORS.text3,opacity:i<=stepIdx?1:0.3,transition:"all 0.4s",display:"flex",alignItems:"center",gap:6}}>
                          <span>{i<stepIdx?"✓":i===stepIdx?"▶":"○"}</span>{s}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ERROR */}
                {phase==="error" && (
                  <div style={{textAlign:"center",padding:"2rem",color:COLORS.danger}}>
                    <div style={{fontSize:"2rem",marginBottom:"0.8rem"}}>⚠️</div>
                    <p style={{fontSize:"0.82rem"}}>분석 중 오류가 발생했습니다.<br/>종목명을 확인하고 다시 시도해주세요.</p>
                  </div>
                )}

                {/* RESULT */}
                {phase==="result" && result && (
                  <div style={{animation:"fadeUp 0.4s ease"}}>

                    {/* 종목 헤더 */}
                    <div style={S.stkHdr}>
                      <div>
                        <div style={S.stkName}>{result.name}</div>
                        <div style={S.stkSub}>{result.ticker} · {market}</div>
                      </div>
                      <div style={S.scoreWrap}>
                        <div style={S.scoreLabel}>AI SCORE</div>
                        <div style={S.scoreCircle(scoreClass)}>
                          <div style={S.scoreNum(scoreClass)}>{result.score}</div>
                          <div style={{fontSize:"0.55rem",color:COLORS.text3}}>/100</div>
                        </div>
                      </div>
                    </div>

                    {/* 지표 */}
                    <div style={S.sectionTitle}>핵심 지표</div>
                    <div style={S.metricsGrid}>
                      {(result.metrics||[]).map((m,i)=>(
                        <div key={i} style={S.metricCard}>
                          <div style={S.metricLabel}>{m.label}</div>
                          <div style={S.metricValue(m.type)}>{m.value}</div>
                        </div>
                      ))}
                    </div>

                    {/* 투자 판단 */}
                    <div style={S.verdictBar}>
                      <span style={{fontSize:"1.8rem"}}>{result.verdictEmoji}</span>
                      <div>
                        <div style={{fontFamily:"'Bebas Neue',cursive,sans-serif",fontSize:"1.2rem",letterSpacing:2,color:scoreClass,marginBottom:2}}>{result.verdict}</div>
                        <div style={{fontSize:"0.76rem",color:COLORS.text2,lineHeight:1.6}}>{result.verdictDetail}</div>
                      </div>
                    </div>

                    {/* AI 분석 */}
                    <div style={S.sectionTitle}>AI 심층 분석</div>
                    <div style={S.aiOutput}>
                      <div style={S.aiTag}>AI ANALYSIS</div>
                      {typedAnalysis}
                    </div>

                    {/* 리스크 */}
                    <div style={S.sectionTitle}>리스크 레벨</div>
                    <div style={{marginBottom:"1.2rem"}}>
                      <div style={S.riskBarWrap}>
                        <div style={S.riskFill(riskColor, riskWidth)}/>
                      </div>
                      <div style={S.riskLabels}><span>LOW</span><span>MEDIUM</span><span>HIGH</span></div>
                    </div>

                    {/* 체크리스트 */}
                    <div style={S.sectionTitle}>투자 체크리스트</div>
                    {(result.checklist||[]).map((c,i)=>(
                      <div key={i} style={S.checkItem}>
                        <div style={S.checkIcon(c.icon)}>{c.icon==="ok"?"✓":c.icon==="warn"?"!":"✕"}</div>
                        <span>{c.text}</span>
                      </div>
                    ))}

                    <button style={S.simBtn} onClick={()=>alert("모의투자 시뮬레이터 — Phase 2에서 출시 예정! 🚀")}>
                      📈 이 종목으로 모의투자 시작하기
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT: 사이드 */}
          <div style={S.sidePanels}>

            {/* 커리큘럼 */}
            <div style={S.panel}>
              <div style={S.panelHdr}>
                <div style={S.panelTitle}>📚 학습 커리큘럼</div>
                <span style={{fontFamily:"monospace",fontSize:"0.72rem",color:COLORS.accent2}}>2/7 완료</span>
              </div>
              <div style={{padding:"0.8rem 1rem"}}>
                {CURRICULUM.map((c,i)=>(
                  <div key={i} style={S.currStep(c.state)}>
                    <div style={S.currNum(c.state)}>
                      {c.state==="done"?"✓":c.state==="active"?"▶":i+1}
                    </div>
                    <div>
                      <div style={{fontSize:"0.78rem",fontWeight:500,color:c.state==="active"?COLORS.accent:COLORS.text,marginBottom:2}}>{c.title}</div>
                      <div style={{fontSize:"0.65rem",color:COLORS.text3}}>{c.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 포트폴리오 */}
            <div style={S.panel}>
              <div style={S.panelHdr}>
                <div style={S.panelTitle}>💼 모의 포트폴리오</div>
                <span style={{fontFamily:"monospace",fontSize:"0.72rem",color:COLORS.accent2}}>+8.34%</span>
              </div>
              <div style={{padding:"0 1.2rem 1rem"}}>
                {PORTFOLIO.map((p,i)=>(
                  <div key={i} style={{...S.portRow, borderBottom: i<PORTFOLIO.length-1 ? `1px solid ${COLORS.border}` : "none"}}>
                    <div>
                      <div style={{fontFamily:"monospace",fontSize:"0.78rem"}}>{p.name}</div>
                      <div style={{fontSize:"0.62rem",color:COLORS.text3,marginTop:2}}>{p.sub}</div>
                    </div>
                    <div style={{fontFamily:"monospace",fontSize:"0.78rem",fontWeight:700,color:p.up?COLORS.accent2:COLORS.danger}}>{p.pnl}</div>
                  </div>
                ))}
                <div style={{marginTop:"0.8rem",padding:"0.8rem",background:COLORS.surface,borderRadius:10,textAlign:"center"}}>
                  <div style={{fontFamily:"monospace",fontSize:"0.6rem",color:COLORS.text3,marginBottom:4}}>총 평가금액</div>
                  <div style={{fontFamily:"monospace",fontSize:"1.2rem",color:COLORS.accent2,fontWeight:700}}>₩ 10,834,200</div>
                  <div style={{fontFamily:"monospace",fontSize:"0.65rem",color:COLORS.text3}}>시작금액 ₩10,000,000</div>
                </div>
              </div>
            </div>

          </div>
        </div>

        <div style={S.disclaimer}>
          <strong style={{color:COLORS.danger}}>⚠️ 투자 위험 고지</strong><br/>
          본 AI 분석은 참고용 정보 제공 목적이며, 투자 권유가 아닙니다. 모든 투자 결정과 책임은 투자자 본인에게 있습니다.
        </div>
      </div>
    </div>
  );
}
