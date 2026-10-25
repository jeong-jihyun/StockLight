import { useState, useEffect, useRef } from "react";

// ── 색상 팔레트 ──
const C = {
  bg:"#06090f", bg2:"#0c1420", surface:"#111d2e", border:"#1a2d44",
  accent:"#00c8f0", accent2:"#00e8a0", gold:"#f5c842", danger:"#ff4455",
  warn:"#ff8c42", text:"#ddeeff", text2:"#6a90b0", text3:"#2e4a62",
};

// ── 샘플 종목 데이터 ──
const STOCKS = {
  "삼성전자":  { ticker:"005930", market:"KR", price:74200,  change:+1.24, sector:"반도체",   risk:"중간", per:12.4, pbr:0.9, roe:18.2 },
  "SK하이닉스":{ ticker:"000660", market:"KR", price:198500, change:+3.11, sector:"반도체",   risk:"높음", per:8.1,  pbr:1.8, roe:22.5 },
  "카카오":    { ticker:"035720", market:"KR", price:41800,  change:-0.95, sector:"IT플랫폼", risk:"높음", per:28.4, pbr:1.1, roe:4.2  },
  "현대차":    { ticker:"005380", market:"KR", price:217000, change:+0.46, sector:"자동차",   risk:"중간", per:5.9,  pbr:0.6, roe:11.8 },
  "NVIDIA":   { ticker:"NVDA",   market:"US", price:118.4,  change:+2.88, sector:"AI반도체", risk:"높음", per:34.2, pbr:22.1,roe:88.4 },
  "APPLE":    { ticker:"AAPL",   market:"US", price:221.3,  change:+0.72, sector:"빅테크",   risk:"중간", per:28.8, pbr:45.2,roe:147.2},
  "TESLA":    { ticker:"TSLA",   market:"US", price:248.7,  change:-1.44, sector:"전기차",   risk:"높음", per:62.1, pbr:8.4, roe:14.1 },
  "QQQ":      { ticker:"QQQ",    market:"ETF",price:441.3,  change:+1.08, sector:"나스닥ETF","risk":"낮음", per:null, pbr:null,roe:null  },
  "KODEX200": { ticker:"069500", market:"ETF",price:37850,  change:+0.88, sector:"코스피ETF","risk":"낮음", per:null, pbr:null,roe:null  },
  "비트코인":  { ticker:"BTC",    market:"CRYPTO",price:87432,change:-2.14,sector:"암호화폐","risk":"매우높음",per:null,pbr:null,roe:null},
};

const INITIAL_CASH = 10_000_000;

// ── AI 코칭 메시지 생성 (Claude API) ──
async function fetchCoachMsg(prompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body: JSON.stringify({
      model:"claude-sonnet-4-20250514",
      max_tokens:1000,
      messages:[{ role:"user", content: prompt }],
    }),
  });
  const data = await res.json();
  return data.content?.map(b=>b.text||"").join("") || "";
}

// ── 유틸 ──
const fmt = (n) => n?.toLocaleString("ko-KR") ?? "—";
const fmtUSD = (n) => "$" + (n?.toFixed(2) ?? "0");
const pct = (n) => (n >= 0 ? "+" : "") + n?.toFixed(2) + "%";
const delay = (ms) => new Promise(r => setTimeout(r, ms));

// ── 미니 차트 (SVG sparkline) ──
function Sparkline({ prices, color }) {
  if (!prices?.length) return null;
  const w = 120, h = 40, pad = 4;
  const min = Math.min(...prices), max = Math.max(...prices);
  const range = max - min || 1;
  const pts = prices.map((p, i) => {
    const x = pad + (i / (prices.length - 1)) * (w - pad * 2);
    const y = h - pad - ((p - min) / range) * (h - pad * 2);
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={w} height={h} style={{display:"block"}}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round"/>
    </svg>
  );
}

// ── AI 코치 패널 ──
function CoachPanel({ messages, loading }) {
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior:"smooth" }); }, [messages]);

  return (
    <div style={{display:"flex", flexDirection:"column", height:"100%"}}>
      <div style={{flex:1, overflowY:"auto", display:"flex", flexDirection:"column", gap:10, padding:"0.8rem"}}>
        {messages.map((m, i) => (
          <div key={i} style={{
            display:"flex", gap:8, alignItems:"flex-start",
            flexDirection: m.role==="coach" ? "row" : "row-reverse",
            animation:"fadeUp 0.3s ease",
          }}>
            <div style={{
              width:28, height:28, borderRadius:"50%", flexShrink:0,
              background: m.role==="coach" ? `linear-gradient(135deg,${C.accent},${C.accent2})` : C.surface,
              border: m.role==="user" ? `1px solid ${C.border}` : "none",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:"0.8rem",
            }}>
              {m.role==="coach" ? "🤖" : "👤"}
            </div>
            <div style={{
              maxWidth:"80%", padding:"0.7rem 0.9rem",
              borderRadius: m.role==="coach" ? "4px 12px 12px 12px" : "12px 4px 12px 12px",
              background: m.role==="coach" ? C.surface : `rgba(0,200,240,0.08)`,
              border: `1px solid ${m.role==="coach" ? C.border : "rgba(0,200,240,0.2)"}`,
              fontSize:"0.78rem", lineHeight:1.8, color:C.text, whiteSpace:"pre-wrap",
            }}>
              {m.type==="tip" && <div style={{fontSize:"0.62rem",color:C.accent,fontFamily:"monospace",letterSpacing:1,marginBottom:4}}>💡 AI 코치 팁</div>}
              {m.type==="warn" && <div style={{fontSize:"0.62rem",color:C.warn,fontFamily:"monospace",letterSpacing:1,marginBottom:4}}>⚠️ 주의</div>}
              {m.type==="praise" && <div style={{fontSize:"0.62rem",color:C.accent2,fontFamily:"monospace",letterSpacing:1,marginBottom:4}}>✅ 잘 하셨어요!</div>}
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{display:"flex", gap:8, alignItems:"center"}}>
            <div style={{width:28,height:28,borderRadius:"50%",background:`linear-gradient(135deg,${C.accent},${C.accent2})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.8rem"}}>🤖</div>
            <div style={{display:"flex",gap:4,alignItems:"center",padding:"0.6rem 1rem",background:C.surface,borderRadius:"4px 12px 12px 12px",border:`1px solid ${C.border}`}}>
              {[0,1,2].map(i=>(
                <div key={i} style={{width:6,height:6,borderRadius:"50%",background:C.accent,animation:`pulse 1.2s ${i*0.2}s infinite`}}/>
              ))}
            </div>
          </div>
        )}
        <div ref={endRef}/>
      </div>
    </div>
  );
}

// ── 메인 ──
export default function StockSimulator() {
  const [cash, setCash] = useState(INITIAL_CASH);
  const [holdings, setHoldings] = useState({}); // { name: { qty, avgPrice, priceHistory } }
  const [tab, setTab] = useState("market");      // market | portfolio | history | learn
  const [selectedStock, setSelectedStock] = useState(null);
  const [orderType, setOrderType] = useState("buy");
  const [qty, setQty] = useState(1);
  const [tradeHistory, setTradeHistory] = useState([]);
  const [coachMsgs, setCoachMsgs] = useState([
    { role:"coach", type:"tip", content:`안녕하세요! 저는 AI 투자 코치입니다 🎯\n\n₩10,000,000 의 가상 자금으로 모의투자를 시작해보세요.\n\n👉 먼저 '시장' 탭에서 마음에 드는 종목을 골라보세요. 종목을 클릭하면 제가 투자 포인트를 분석해드립니다!` },
  ]);
  const [coachLoading, setCoachLoading] = useState(false);
  const [prices, setPrices] = useState(() => {
    const p = {};
    Object.entries(STOCKS).forEach(([n, s]) => { p[n] = s.price; });
    return p;
  });
  const [priceHistory, setPriceHistory] = useState(() => {
    const h = {};
    Object.entries(STOCKS).forEach(([n, s]) => {
      h[n] = Array.from({length:20}, (_,i) => s.price * (1 + (Math.random()-0.5)*0.04*(20-i)/20));
    });
    return h;
  });
  const [orderModal, setOrderModal] = useState(false);

  // 총 평가금액
  const totalEval = cash + Object.entries(holdings).reduce((sum, [name, h]) => {
    return sum + h.qty * prices[name];
  }, 0);
  const totalPnl = totalEval - INITIAL_CASH;
  const totalPnlPct = (totalPnl / INITIAL_CASH) * 100;

  // 가격 실시간 변동 (5초마다)
  useEffect(() => {
    const id = setInterval(() => {
      setPrices(prev => {
        const next = {...prev};
        Object.keys(STOCKS).forEach(n => {
          const drift = (Math.random() - 0.495) * 0.008;
          next[n] = Math.max(next[n] * (1 + drift), 1);
        });
        return next;
      });
      setPriceHistory(prev => {
        const next = {...prev};
        Object.keys(STOCKS).forEach(n => {
          next[n] = [...(prev[n]||[]).slice(-29), prices[n]];
        });
        return next;
      });
    }, 4000);
    return () => clearInterval(id);
  }, [prices]);

  // AI 코치 메시지 추가
  const addCoach = (content, type="tip") => {
    setCoachMsgs(prev => [...prev, { role:"coach", type, content }]);
  };
  const addUser = (content) => {
    setCoachMsgs(prev => [...prev, { role:"user", content }]);
  };

  // 종목 선택 시 AI 코치 분석
  async function selectStock(name) {
    setSelectedStock(name);
    setTab("market");
    setQty(1);
    setOrderType("buy");
    const s = STOCKS[name];
    addUser(`${name} 종목 분석해줘`);
    setCoachLoading(true);
    try {
      const held = holdings[name];
      const prompt = `당신은 친근하고 교육적인 AI 주식 투자 코치입니다. 모의투자 초보자에게 아래 종목을 쉽게 설명해주세요.

종목: ${name} (${s.ticker})
현재가: ${fmt(Math.round(prices[name]))} ${s.market==="US"?"USD":"KRW"}
등락률: ${pct(s.change)}
섹터: ${s.sector}
리스크: ${s.risk}
PER: ${s.per ?? "N/A"}, PBR: ${s.pbr ?? "N/A"}, ROE: ${s.roe ?? "N/A"}%
보유여부: ${held ? `${held.qty}주 보유 중 (평균단가 ${fmt(Math.round(held.avgPrice))})` : "미보유"}

다음을 포함해 150자 내외로 친근하게 설명하세요:
1. 이 종목의 핵심 투자 포인트 1가지
2. 지금 사도 될지 판단 (매수/관망/주의)
3. 초보자가 조심해야 할 점 1가지
이모지를 적절히 사용하고, 어려운 용어는 괄호로 설명하세요.`;
      const msg = await fetchCoachMsg(prompt);
      addCoach(msg, "tip");
    } catch {
      addCoach(`${name} 분석 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.`);
    }
    setCoachLoading(false);
  }

  // 매수/매도 실행
  async function executeTrade() {
    if (!selectedStock || qty < 1) return;
    const name = selectedStock;
    const price = prices[name];
    const total = price * qty;
    const isKR = STOCKS[name].market !== "US" && STOCKS[name].market !== "CRYPTO";

    if (orderType === "buy") {
      if (total > cash) {
        addCoach(`잠깐! 💰 매수금액(₩${fmt(Math.round(total))})이 보유현금(₩${fmt(Math.round(cash))})보다 많아요. 수량을 줄이거나 다른 종목을 선택해보세요.`, "warn");
        return;
      }
      setCash(c => c - total);
      setHoldings(prev => {
        const h = prev[name];
        if (h) {
          const newQty = h.qty + qty;
          const newAvg = (h.avgPrice * h.qty + price * qty) / newQty;
          return {...prev, [name]: { qty:newQty, avgPrice:newAvg }};
        }
        return {...prev, [name]: { qty, avgPrice:price }};
      });
      const record = { type:"buy", name, qty, price, total, time:new Date().toLocaleTimeString("ko-KR") };
      setTradeHistory(prev => [record, ...prev]);
      setOrderModal(false);

      addUser(`${name} ${qty}주 매수`);
      setCoachLoading(true);
      try {
        const diversified = Object.keys(holdings).length >= 3;
        const singleWeight = total / totalEval;
        const prompt = `모의투자 코치입니다. 방금 초보 투자자가 ${name}을 ${qty}주, ${isKR?fmt(Math.round(price))+"원":"$"+price.toFixed(2)}에 매수했습니다. 총 투자금 ${fmt(Math.round(total))}원. 분산투자 여부: ${diversified ? "3개 이상 종목 보유 중" : "아직 집중 투자 상태"}. 단일 종목 비중: ${(singleWeight*100).toFixed(1)}%.

50자 내외로 칭찬하거나 주의사항을 알려주세요. 이모지 포함, 초보자 눈높이로.`;
        const msg = await fetchCoachMsg(prompt);
        addCoach(msg, singleWeight > 0.5 ? "warn" : "praise");
      } catch { addCoach(`${name} ${qty}주 매수 완료! 잘 하셨어요 👍`, "praise"); }
      setCoachLoading(false);

    } else {
      // 매도
      const h = holdings[name];
      if (!h || h.qty < qty) {
        addCoach(`보유 수량(${h?.qty ?? 0}주)보다 많은 수량을 매도할 수 없어요!`, "warn");
        return;
      }
      const pnlPer = (price - h.avgPrice) * qty;
      const pnlPct = ((price - h.avgPrice) / h.avgPrice) * 100;
      setCash(c => c + total);
      setHoldings(prev => {
        const newQty = prev[name].qty - qty;
        if (newQty === 0) {
          const next = {...prev};
          delete next[name];
          return next;
        }
        return {...prev, [name]: {...prev[name], qty:newQty }};
      });
      const record = { type:"sell", name, qty, price, total, pnl:pnlPer, pnlPct, time:new Date().toLocaleTimeString("ko-KR") };
      setTradeHistory(prev => [record, ...prev]);
      setOrderModal(false);

      addUser(`${name} ${qty}주 매도`);
      setCoachLoading(true);
      try {
        const isProfit = pnlPer > 0;
        const prompt = `모의투자 코치입니다. 초보 투자자가 ${name}을 ${qty}주 매도했습니다. 손익: ${pnlPer >= 0 ? "+" : ""}${fmt(Math.round(pnlPer))}원 (${pnlPct.toFixed(2)}%). ${isProfit ? "수익 실현" : "손실 실현"} 상황입니다.

60자 내외로 투자 교훈을 알려주세요. ${isProfit ? "수익 실현의 중요성과 다음 전략을 조언해주세요." : "손절의 의미와 회복 전략을 격려와 함께 알려주세요."} 이모지 포함.`;
        const msg = await fetchCoachMsg(prompt);
        addCoach(msg, isProfit ? "praise" : "tip");
      } catch { addCoach(`${name} 매도 완료! 손익: ${pnlPer>=0?"+":""}${fmt(Math.round(pnlPer))}원`, pnlPer>=0?"praise":"tip"); }
      setCoachLoading(false);
    }
  }

  // 스타일
  const S = {
    wrap: { fontFamily:"'Noto Sans KR',sans-serif", background:C.bg, color:C.text, minHeight:"100vh", display:"flex", flexDirection:"column" },
    hdr: { background:C.bg2, borderBottom:`1px solid ${C.border}`, padding:"0.7rem 1rem", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0 },
    logo: { fontFamily:"monospace", fontWeight:800, fontSize:"1rem", letterSpacing:3, color:C.accent },
    statsBar: { display:"flex", gap:"1.5rem", alignItems:"center" },
    statItem: { textAlign:"center" },
    statLabel: { fontSize:"0.55rem", color:C.text3, letterSpacing:1.5, fontFamily:"monospace" },
    statVal: { fontSize:"0.9rem", fontFamily:"monospace", fontWeight:700 },
    body: { display:"flex", flex:1, overflow:"hidden" },
    leftCol: { width:260, background:C.bg2, borderRight:`1px solid ${C.border}`, display:"flex", flexDirection:"column", flexShrink:0, overflow:"hidden" },
    midCol: { flex:1, display:"flex", flexDirection:"column", overflow:"hidden" },
    rightCol: { width:300, background:C.bg2, borderLeft:`1px solid ${C.border}`, display:"flex", flexDirection:"column", flexShrink:0 },
    tabBar: { display:"flex", borderBottom:`1px solid ${C.border}`, flexShrink:0 },
    tabBtn: (active) => ({ flex:1, padding:"0.6rem", fontSize:"0.72rem", fontFamily:"monospace", letterSpacing:1, border:"none", background:"transparent", color: active ? C.accent : C.text2, borderBottom: active ? `2px solid ${C.accent}` : "2px solid transparent", cursor:"pointer", transition:"all 0.2s" }),
    scrollArea: { flex:1, overflowY:"auto" },
    stockRow: (active) => ({ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0.65rem 0.9rem", cursor:"pointer", borderLeft: active ? `3px solid ${C.accent}` : "3px solid transparent", background: active ? `rgba(0,200,240,0.05)` : "transparent", transition:"all 0.15s", borderBottom:`1px solid ${C.border}` }),
    sName: { fontSize:"0.82rem", fontWeight:600 },
    sTicker: { fontSize:"0.6rem", color:C.text3, fontFamily:"monospace", marginTop:2 },
    sPrice: { fontSize:"0.82rem", fontFamily:"monospace", fontWeight:700, textAlign:"right" },
    sChange: (up) => ({ fontSize:"0.68rem", fontFamily:"monospace", color: up?C.accent2:C.danger, textAlign:"right" }),
    // 상세
    detailWrap: { padding:"1rem", flex:1, overflowY:"auto" },
    detailHdr: { display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"1rem", paddingBottom:"1rem", borderBottom:`1px solid ${C.border}` },
    chip: (color) => ({ display:"inline-block", padding:"2px 8px", borderRadius:20, fontSize:"0.6rem", fontFamily:"monospace", letterSpacing:1, background:`${color}20`, color, border:`1px solid ${color}40` }),
    metricRow: { display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:"1rem" },
    mCard: { background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:"0.6rem 0.7rem" },
    mLabel: { fontSize:"0.58rem", color:C.text3, fontFamily:"monospace", letterSpacing:1.5, marginBottom:3 },
    mVal: { fontSize:"0.9rem", fontFamily:"monospace", fontWeight:700 },
    orderPanel: { background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:"1rem", marginBottom:"1rem" },
    orderTabs: { display:"flex", borderRadius:8, overflow:"hidden", border:`1px solid ${C.border}`, marginBottom:"0.8rem" },
    oTab: (active, isBuy) => ({ flex:1, padding:"0.5rem", fontSize:"0.78rem", fontWeight:700, border:"none", cursor:"pointer", background: active ? (isBuy?C.accent2:C.danger) : "transparent", color: active ? C.bg : C.text2, transition:"all 0.2s" }),
    qtyRow: { display:"flex", gap:8, alignItems:"center", marginBottom:"0.8rem" },
    qInput: { flex:1, background:C.bg2, border:`1px solid ${C.border}`, borderRadius:8, color:C.text, padding:"0.5rem 0.8rem", fontSize:"0.9rem", fontFamily:"monospace", outline:"none", textAlign:"center" },
    qBtn: { width:32, height:32, borderRadius:8, border:`1px solid ${C.border}`, background:C.bg2, color:C.text, fontSize:"1rem", cursor:"pointer" },
    execBtn: (isBuy) => ({ width:"100%", padding:"0.7rem", borderRadius:10, border:"none", background: isBuy ? `linear-gradient(135deg,${C.accent2},#00c070)` : `linear-gradient(135deg,${C.danger},#cc2233)`, color:C.bg, fontSize:"0.85rem", fontWeight:800, fontFamily:"'Noto Sans KR',sans-serif", cursor:"pointer", letterSpacing:1, marginTop:4 }),
    // portfolio
    portRow: { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0.7rem 0.9rem", borderBottom:`1px solid ${C.border}`, cursor:"pointer" },
    // history
    histRow: { padding:"0.65rem 0.9rem", borderBottom:`1px solid ${C.border}` },
    badge: (type) => ({ display:"inline-block", padding:"1px 6px", borderRadius:4, fontSize:"0.6rem", fontFamily:"monospace", fontWeight:700, background: type==="buy" ? `${C.accent2}20` : `${C.danger}20`, color: type==="buy" ? C.accent2 : C.danger, marginRight:6 }),
    // coach
    coachHdr: { padding:"0.7rem 1rem", borderBottom:`1px solid ${C.border}`, display:"flex", alignItems:"center", gap:8, flexShrink:0 },
    coachDot: { width:8,height:8,borderRadius:"50%",background:C.accent2,animation:"pulse 1.5s infinite" },
  };

  const selStock = selectedStock ? STOCKS[selectedStock] : null;
  const selPrice = selectedStock ? prices[selectedStock] : 0;
  const selHeld = selectedStock ? holdings[selectedStock] : null;
  const orderTotal = selPrice * qty;
  const isUS = selStock?.market === "US";
  const isBuy = orderType === "buy";

  // 포트폴리오 계산
  const holdingList = Object.entries(holdings).map(([name, h]) => {
    const cur = prices[name];
    const eval_ = cur * h.qty;
    const cost = h.avgPrice * h.qty;
    const pnl = eval_ - cost;
    const pnlPct = (pnl / cost) * 100;
    return { name, ...h, cur, eval_, cost, pnl, pnlPct };
  });

  const cashRatio = (cash / totalEval) * 100;

  return (
    <div style={S.wrap}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&display=swap');
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        *{box-sizing:border-box;margin:0;padding:0;}
        input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none;}
        ::-webkit-scrollbar{width:3px;} ::-webkit-scrollbar-thumb{background:${C.border};border-radius:2px;}
        select option{background:${C.bg2};}
      `}</style>

      {/* HEADER */}
      <header style={S.hdr}>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          <div style={S.logo}>STOCK<span style={{color:C.accent2}}>SIM</span></div>
          <div style={{fontSize:"0.65rem",color:C.text3,fontFamily:"monospace",borderLeft:`1px solid ${C.border}`,paddingLeft:12}}>AI 투자 코치 · 모의투자 시뮬레이터</div>
        </div>
        <div style={S.statsBar}>
          <div style={S.statItem}>
            <div style={S.statLabel}>보유현금</div>
            <div style={{...S.statVal, color:C.accent}}>₩{fmt(Math.round(cash))}</div>
          </div>
          <div style={S.statItem}>
            <div style={S.statLabel}>총 평가금액</div>
            <div style={{...S.statVal, color:C.text}}>₩{fmt(Math.round(totalEval))}</div>
          </div>
          <div style={S.statItem}>
            <div style={S.statLabel}>누적 손익</div>
            <div style={{...S.statVal, color: totalPnl>=0?C.accent2:C.danger}}>
              {totalPnl>=0?"+":""}{fmt(Math.round(totalPnl))}원
            </div>
          </div>
          <div style={{padding:"4px 12px", borderRadius:20, background: totalPnlPct>=0?`${C.accent2}20`:`${C.danger}20`, border:`1px solid ${totalPnlPct>=0?C.accent2:C.danger}40`}}>
            <span style={{fontFamily:"monospace",fontSize:"0.85rem",fontWeight:800,color:totalPnlPct>=0?C.accent2:C.danger}}>
              {totalPnlPct>=0?"+":""}{totalPnlPct.toFixed(2)}%
            </span>
          </div>
        </div>
      </header>

      {/* BODY */}
      <div style={S.body}>

        {/* 좌: 종목 목록 + 포트폴리오 */}
        <div style={S.leftCol}>
          <div style={S.tabBar}>
            <button style={S.tabBtn(tab==="market")} onClick={()=>setTab("market")}>시장</button>
            <button style={S.tabBtn(tab==="portfolio")} onClick={()=>setTab("portfolio")}>보유</button>
            <button style={S.tabBtn(tab==="history")} onClick={()=>setTab("history")}>거래내역</button>
          </div>

          <div style={S.scrollArea}>
            {tab==="market" && Object.entries(STOCKS).map(([name, s]) => {
              const cur = prices[name];
              const chgFromOpen = ((cur - s.price) / s.price) * 100;
              const isUp = cur >= s.price;
              return (
                <div key={name} style={S.stockRow(selectedStock===name)} onClick={()=>selectStock(name)}>
                  <div>
                    <div style={S.sName}>{name}</div>
                    <div style={S.sTicker}>{s.ticker} · {s.market}</div>
                  </div>
                  <div>
                    <Sparkline prices={priceHistory[name]} color={isUp?C.accent2:C.danger}/>
                    <div style={S.sPrice}>{s.market==="US"?"$"+cur.toFixed(2):fmt(Math.round(cur))}</div>
                    <div style={S.sChange(isUp)}>{isUp?"▲":"▼"} {Math.abs(chgFromOpen).toFixed(2)}%</div>
                  </div>
                </div>
              );
            })}

            {tab==="portfolio" && (
              <div>
                {holdingList.length===0 ? (
                  <div style={{padding:"2rem",textAlign:"center",color:C.text3,fontSize:"0.78rem"}}>
                    <div style={{fontSize:"2rem",marginBottom:"0.5rem"}}>📭</div>
                    보유 종목이 없습니다<br/>종목을 매수해보세요
                  </div>
                ) : holdingList.map(h => (
                  <div key={h.name} style={S.portRow} onClick={()=>{ setTab("market"); selectStock(h.name); }}>
                    <div>
                      <div style={{fontSize:"0.82rem",fontWeight:600}}>{h.name}</div>
                      <div style={{fontSize:"0.62rem",color:C.text3,fontFamily:"monospace",marginTop:2}}>{h.qty}주 · 평균 {fmt(Math.round(h.avgPrice))}</div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontFamily:"monospace",fontSize:"0.82rem",fontWeight:700}}>₩{fmt(Math.round(h.eval_))}</div>
                      <div style={{fontFamily:"monospace",fontSize:"0.68rem",color:h.pnl>=0?C.accent2:C.danger}}>
                        {h.pnl>=0?"+":""}{fmt(Math.round(h.pnl))} ({h.pnlPct.toFixed(2)}%)
                      </div>
                    </div>
                  </div>
                ))}
                {holdingList.length > 0 && (
                  <div style={{padding:"0.8rem",background:C.surface,margin:"0.5rem"}}>
                    <div style={{fontSize:"0.62rem",color:C.text3,fontFamily:"monospace",marginBottom:6}}>자산 배분</div>
                    <div style={{display:"flex",height:8,borderRadius:4,overflow:"hidden",gap:1}}>
                      <div style={{width:`${cashRatio}%`,background:C.accent,transition:"width 0.5s"}}/>
                      {holdingList.map(h=>(
                        <div key={h.name} style={{width:`${(h.eval_/totalEval)*100}%`,background:h.pnl>=0?C.accent2:C.danger,transition:"width 0.5s"}}/>
                      ))}
                    </div>
                    <div style={{display:"flex",gap:8,marginTop:6,flexWrap:"wrap"}}>
                      <span style={{fontSize:"0.6rem",color:C.accent,fontFamily:"monospace"}}>현금 {cashRatio.toFixed(0)}%</span>
                      {holdingList.map(h=>(
                        <span key={h.name} style={{fontSize:"0.6rem",color:h.pnl>=0?C.accent2:C.danger,fontFamily:"monospace"}}>{h.name} {((h.eval_/totalEval)*100).toFixed(0)}%</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {tab==="history" && (
              <div>
                {tradeHistory.length===0 ? (
                  <div style={{padding:"2rem",textAlign:"center",color:C.text3,fontSize:"0.78rem"}}>
                    <div style={{fontSize:"2rem",marginBottom:"0.5rem"}}>📋</div>
                    거래 내역이 없습니다
                  </div>
                ) : tradeHistory.map((t,i) => (
                  <div key={i} style={S.histRow}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:3}}>
                      <div>
                        <span style={S.badge(t.type)}>{t.type==="buy"?"매수":"매도"}</span>
                        <span style={{fontSize:"0.8rem",fontWeight:600}}>{t.name}</span>
                      </div>
                      <span style={{fontSize:"0.62rem",color:C.text3,fontFamily:"monospace"}}>{t.time}</span>
                    </div>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:"0.72rem",color:C.text2,fontFamily:"monospace"}}>
                      <span>{t.qty}주 · {fmt(Math.round(t.price))}</span>
                      <span>{t.type==="sell" && t.pnl !== undefined ? <span style={{color:t.pnl>=0?C.accent2:C.danger}}>{t.pnl>=0?"+":""}{fmt(Math.round(t.pnl))}</span> : `₩${fmt(Math.round(t.total))}`}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 중: 종목 상세 + 주문 */}
        <div style={S.midCol}>
          {!selectedStock ? (
            <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",color:C.text3,gap:12}}>
              <div style={{fontSize:"3rem",opacity:0.3}}>📈</div>
              <div style={{fontSize:"0.85rem"}}>왼쪽에서 종목을 선택하세요</div>
              <div style={{fontSize:"0.72rem",color:C.text3}}>AI 코치가 투자 포인트를 분석해드립니다</div>
            </div>
          ) : (
            <div style={S.detailWrap}>

              {/* 종목 헤더 */}
              <div style={S.detailHdr}>
                <div>
                  <div style={{fontSize:"1.4rem",fontWeight:800,fontFamily:"monospace",letterSpacing:1,marginBottom:4}}>{selectedStock}</div>
                  <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
                    <span style={{...S.chip(C.text2), fontSize:"0.6rem"}}>{selStock.ticker}</span>
                    <span style={S.chip(C.accent)}>{selStock.market}</span>
                    <span style={S.chip(C.gold)}>{selStock.sector}</span>
                    <span style={S.chip(selStock.risk==="낮음"?C.accent2:selStock.risk==="높음"||selStock.risk==="매우높음"?C.danger:C.gold)}>
                      리스크 {selStock.risk}
                    </span>
                  </div>
                </div>
                <div style={{textAlign:"right"}}>
                  <div style={{fontFamily:"monospace",fontSize:"1.6rem",fontWeight:800}}>{isUS?"$"+selPrice.toFixed(2):fmt(Math.round(selPrice))}</div>
                  <div style={{fontFamily:"monospace",fontSize:"0.8rem",color:selPrice>=selStock.price?C.accent2:C.danger}}>
                    {selPrice>=selStock.price?"▲":"▼"} {Math.abs(((selPrice-selStock.price)/selStock.price)*100).toFixed(2)}%
                  </div>
                </div>
              </div>

              {/* 차트 */}
              <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"0.8rem",marginBottom:"1rem"}}>
                <div style={{fontSize:"0.6rem",color:C.text3,fontFamily:"monospace",letterSpacing:1.5,marginBottom:6}}>PRICE CHART</div>
                <svg width="100%" height={80} viewBox="0 0 400 80" preserveAspectRatio="none">
                  {(() => {
                    const hist = priceHistory[selectedStock] || [];
                    if (hist.length < 2) return null;
                    const min = Math.min(...hist), max = Math.max(...hist), range = max-min||1;
                    const pts = hist.map((p,i) => {
                      const x = (i/(hist.length-1))*400;
                      const y = 70-((p-min)/range)*60;
                      return `${x},${y}`;
                    }).join(" ");
                    const color = hist[hist.length-1] >= hist[0] ? C.accent2 : C.danger;
                    return (
                      <>
                        <defs>
                          <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={color} stopOpacity="0.3"/>
                            <stop offset="100%" stopColor={color} stopOpacity="0"/>
                          </linearGradient>
                        </defs>
                        <polygon points={`0,80 ${pts} 400,80`} fill="url(#cg)"/>
                        <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round"/>
                      </>
                    );
                  })()}
                </svg>
              </div>

              {/* 지표 */}
              {selStock.per !== null && (
                <>
                  <div style={{fontSize:"0.62rem",color:C.accent,fontFamily:"monospace",letterSpacing:2,borderLeft:`2px solid ${C.accent}`,paddingLeft:6,marginBottom:8}}>핵심 지표</div>
                  <div style={S.metricRow}>
                    <div style={S.mCard}><div style={S.mLabel}>PER</div><div style={{...S.mVal,color:C.gold}}>{selStock.per}x</div></div>
                    <div style={S.mCard}><div style={S.mLabel}>PBR</div><div style={{...S.mVal,color:selStock.pbr<1?C.accent2:C.gold}}>{selStock.pbr}x</div></div>
                    <div style={S.mCard}><div style={S.mLabel}>ROE</div><div style={{...S.mVal,color:selStock.roe>15?C.accent2:C.gold}}>{selStock.roe}%</div></div>
                  </div>
                </>
              )}

              {/* 보유 현황 */}
              {selHeld && (
                <div style={{background:`rgba(0,232,160,0.05)`,border:`1px solid ${C.accent2}30`,borderRadius:10,padding:"0.8rem",marginBottom:"1rem"}}>
                  <div style={{fontSize:"0.62rem",color:C.accent2,fontFamily:"monospace",letterSpacing:1.5,marginBottom:6}}>📦 보유 현황</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                    <div><div style={{fontSize:"0.58rem",color:C.text3}}>보유수량</div><div style={{fontFamily:"monospace",fontSize:"0.9rem",fontWeight:700}}>{selHeld.qty}주</div></div>
                    <div><div style={{fontSize:"0.58rem",color:C.text3}}>평균단가</div><div style={{fontFamily:"monospace",fontSize:"0.9rem",fontWeight:700}}>{fmt(Math.round(selHeld.avgPrice))}</div></div>
                    <div>
                      <div style={{fontSize:"0.58rem",color:C.text3}}>평가손익</div>
                      <div style={{fontFamily:"monospace",fontSize:"0.9rem",fontWeight:700,color:(selPrice-selHeld.avgPrice)>=0?C.accent2:C.danger}}>
                        {((selPrice-selHeld.avgPrice)/selHeld.avgPrice*100).toFixed(2)}%
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 주문 패널 */}
              <div style={S.orderPanel}>
                <div style={{fontSize:"0.62rem",color:C.accent,fontFamily:"monospace",letterSpacing:1.5,marginBottom:"0.8rem"}}>주문</div>
                <div style={S.orderTabs}>
                  <button style={S.oTab(orderType==="buy",true)} onClick={()=>setOrderType("buy")}>매수</button>
                  <button style={S.oTab(orderType==="sell",false)} onClick={()=>setOrderType("sell")}>매도</button>
                </div>

                <div style={S.qtyRow}>
                  <button style={S.qBtn} onClick={()=>setQty(q=>Math.max(1,q-1))}>−</button>
                  <input type="number" style={S.qInput} value={qty} min={1} onChange={e=>setQty(Math.max(1,parseInt(e.target.value)||1))}/>
                  <button style={S.qBtn} onClick={()=>setQty(q=>q+1)}>+</button>
                  <span style={{fontSize:"0.75rem",color:C.text3}}>주</span>
                </div>

                <div style={{display:"flex",justifyContent:"space-between",fontSize:"0.72rem",color:C.text2,fontFamily:"monospace",marginBottom:4}}>
                  <span>주문금액</span>
                  <span style={{color:C.text,fontWeight:700}}>₩{fmt(Math.round(orderTotal))}</span>
                </div>
                {isBuy && (
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:"0.68rem",color:C.text3,fontFamily:"monospace",marginBottom:4}}>
                    <span>잔여현금</span>
                    <span style={{color:orderTotal>cash?C.danger:C.text2}}>₩{fmt(Math.round(cash-orderTotal))}</span>
                  </div>
                )}
                {!isBuy && selHeld && (
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:"0.68rem",color:C.text3,fontFamily:"monospace",marginBottom:4}}>
                    <span>매도 후 잔여</span>
                    <span>{Math.max(0, selHeld.qty - qty)}주</span>
                  </div>
                )}

                <button style={S.execBtn(isBuy)} onClick={executeTrade}>
                  {isBuy ? `📈 ${selectedStock} ${qty}주 매수` : `📉 ${selectedStock} ${qty}주 매도`}
                </button>

                <div style={{marginTop:8,padding:"0.5rem",background:`rgba(255,140,66,0.08)`,borderRadius:6,fontSize:"0.62rem",color:C.warn,lineHeight:1.6}}>
                  ⚠️ 모의투자 시뮬레이션입니다. 실제 투자가 아닙니다.
                </div>
              </div>

            </div>
          )}
        </div>

        {/* 우: AI 코치 */}
        <div style={S.rightCol}>
          <div style={S.coachHdr}>
            <div style={S.coachDot}/>
            <span style={{fontFamily:"monospace",fontSize:"0.7rem",fontWeight:700,color:C.accent,letterSpacing:2}}>AI 투자 코치</span>
            <span style={{marginLeft:"auto",fontSize:"0.6rem",color:C.text3,fontFamily:"monospace"}}>POWERED BY CLAUDE</span>
          </div>
          <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column"}}>
            <CoachPanel messages={coachMsgs} loading={coachLoading}/>
          </div>
          {/* 빠른 질문 버튼 */}
          <div style={{padding:"0.6rem",borderTop:`1px solid ${C.border}`,display:"flex",flexWrap:"wrap",gap:5}}>
            {["분산투자 방법","손절이란?","PER 설명","지금 사도 돼?"].map(q=>(
              <button key={q} style={{padding:"4px 10px",borderRadius:20,fontSize:"0.65rem",border:`1px solid ${C.border}`,background:C.surface,color:C.text2,cursor:"pointer",fontFamily:"'Noto Sans KR',sans-serif"}}
                onClick={async()=>{
                  addUser(q);
                  setCoachLoading(true);
                  try {
                    const prompt = `주식 입문자가 "${q}"라고 물었습니다. AI 투자 코치로서 80자 내외로 쉽고 친근하게 답해주세요. 이모지 포함.`;
                    const msg = await fetchCoachMsg(prompt);
                    addCoach(msg,"tip");
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
