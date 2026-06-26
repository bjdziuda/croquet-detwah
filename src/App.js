import { useState, useMemo, useRef, useEffect } from "react";
import { subscribeToPush } from "./serviceWorkerRegistration";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";


const firebaseConfig = {
  apiKey: "AIzaSyCwD4CXsZ91eD83ZKwn1s3lTHHt8Lyqfpw", // netlify-secrets-ignore
  authDomain: "croquet-detwah.firebaseapp.com",
  projectId: "croquet-detwah",
  storageBucket: "croquet-detwah.firebasestorage.app",
  messagingSenderId: "234715320279",
  appId: "1:234715320279:web:95ecf8d65018b4c110c592"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
window._croquetDB = db;
const LEAGUE_DOC = doc(db, "league", "data");

const CLOUDINARY_CLOUD = "dr3pitbr2";
const CLOUDINARY_PRESET = "croquet_uploads";

const C = {
  bg: "#0c1a0c", surface: "#121f12", card: "#172117", border: "#263d26",
  accent: "#c9a84c", accentLight: "#e8c97a", green: "#4a8c4a", greenLight: "#6ab06a",
  text: "#e8e8dc", muted: "#7a967a", cream: "#f0ead6", red: "#c06060", blue: "#7ab8d4",
  gold: "#f0c040",
};
const LINE_COLORS = ["#c9a84c","#6ab06a","#7ab8d4","#d47a7a","#a87ad4","#d4a07a","#7ad4c8","#d4d47a","#b47ab4","#7ab47a","#c8a07a","#a0c87a"];

const DEFAULT_ADMINS = [
  { username: "commissioner", password: "croquet2026", role: "superadmin" },
  { username: "admin2",       password: "detwah2026",  role: "admin" },
];

const calcPoints = (position, groupSize) => {
  if (groupSize <= 1) return 1;
  if (position === groupSize) return 0;
  return groupSize - position + 1;
};
const maxPossible = (pid, wg) => {
  let t = 0;
  Object.values(wg[pid]||{}).forEach(gs => gs.forEach(g => { t += g.absent ? 1 : (g.groupSize||1); }));
  return t;
};
const totalPts = (pid, wg) => {
  let s = 0;
  Object.values(wg[pid]||{}).forEach(gs => gs.forEach(g => { s += (g.pts||0)+(g.sotd||0); }));
  return s;
};
const buildChartData = (players, wg, maxWeek) =>
  Array.from({length:maxWeek},(_,i) => {
    const w=i+1, entry={week:`Wk ${w}`};
    players.forEach(p => { let c=0; for(let ww=1;ww<=w;ww++) (wg[p.id]?.[ww]||[]).forEach(g=>{c+=(g.pts||0)+(g.sotd||0);}); entry[p.name]=c; });
    return entry;
  });

const StarRating = ({value, onChange, size=24}) => (
  <div style={{display:"flex",gap:"4px"}}>
    {[1,2,3,4,5].map(n => (
      <span key={n} onClick={()=>onChange&&onChange(n)}
        style={{fontSize:`${size}px`,cursor:onChange?"pointer":"default",color:n<=value?C.gold:C.border,transition:"color 0.15s",lineHeight:1}}>★</span>
    ))}
  </div>
);

const Medal = ({rank}) => {
  if(rank===1) return <span style={{fontSize:"1.05rem"}}>🥇</span>;
  if(rank===2) return <span style={{fontSize:"1.05rem"}}>🥈</span>;
  if(rank===3) return <span style={{fontSize:"1.05rem"}}>🥉</span>;
  return <span style={{color:C.muted,fontSize:"0.82rem"}}>#{rank}</span>;
};

const DEFAULT_VENUES = ["Oakfield Lawn","Hartwell Green","Manor Gardens","Riverside Court","The Club Grounds"];
const LOGO_ENTRIES = [
  {id:"l1", url:"https://res.cloudinary.com/dr3pitbr2/image/upload/v1776519749/PXL_20260410_015458287_2_h91xei.jpg"},
  {id:"l2", url:"https://res.cloudinary.com/dr3pitbr2/image/upload/v1776519749/PXL_20260410_015504518_2_lpxsd6.jpg"},
  {id:"l3", url:"https://res.cloudinary.com/dr3pitbr2/image/upload/v1776519749/PXL_20260410_015512610_2_o9kzmb.jpg"},
  {id:"l4", url:"https://res.cloudinary.com/dr3pitbr2/image/upload/v1776519749/PXL_20260410_015520310_2_aep7in.jpg"},
  {id:"l5", url:"https://res.cloudinary.com/dr3pitbr2/image/upload/v1776519749/PXL_20260410_015528435_2_tllc6k.jpg"},
  {id:"l6", url:"https://res.cloudinary.com/dr3pitbr2/image/upload/v1776519749/PXL_20260410_015540983_2_pv7ltp.jpg"},
  {id:"l7", url:"https://res.cloudinary.com/dr3pitbr2/image/upload/v1776519750/PXL_20260410_015547725_2_nvtdq8.jpg"},
  {id:"l8", url:"https://res.cloudinary.com/dr3pitbr2/image/upload/v1776519750/PXL_20260410_015559748_2_vd589h.jpg"},
  {id:"l9", url:"https://res.cloudinary.com/dr3pitbr2/image/upload/v1776519750/PXL_20260410_015609453_2_ofhxbj.jpg"},
  {id:"l10", url:"https://res.cloudinary.com/dr3pitbr2/image/upload/v1776519750/IMG-20260412-WA0002_thg5l4.jpg"},
  {id:"l11", url:"https://res.cloudinary.com/dr3pitbr2/image/upload/v1776519750/IMG-20260412-WA0005_2_clpfkx.jpg"},
  {id:"l12", url:"https://res.cloudinary.com/dr3pitbr2/image/upload/v1776519750/PXL_20260410_015356733_2_yz0urh.jpg"},
  {id:"l13", url:"https://res.cloudinary.com/dr3pitbr2/image/upload/v1776519751/PXL_20260410_015411003_2_qdli7a.jpg"},
  {id:"l14", url:"https://res.cloudinary.com/dr3pitbr2/image/upload/v1776519751/PXL_20260410_015416204_2_jbkdlo.jpg"},
  {id:"l15", url:"https://res.cloudinary.com/dr3pitbr2/image/upload/v1776519751/PXL_20260410_015421084_2_u2tede.jpg"},
  {id:"l16", url:"https://res.cloudinary.com/dr3pitbr2/image/upload/v1776519751/PXL_20260410_015617402_2_xrgdbw.jpg"},
];

const MOTTO_ENTRIES = [
  {id:"m1",  text:"Not Your Grandma's Croquet"},
  {id:"m2",  text:"Only Champions Play"},
  {id:"m3",  text:"C'est dur d'etre nul — It's hard to be miserable"},
  {id:"m4",  text:"Sucks to suck"},
  {id:"m5",  text:"The excitement of croquet is considered bad for the heart"},
  {id:"m6",  text:"Liberté, égalité, Croquet"},
  {id:"m7",  text:"Through the wickets we go!"},
  {id:"m8",  text:"Ponder the Orb"},
  {id:"m9",  text:"What's Crotay?"},
  {id:"m10", text:"Who's turn is it?"},
  {id:"m11", text:"Suck to Suck"},
  {id:"m12", text:"Nothing But a Mallet in the back and tinned fish in the front"},
];

const EMPTY_STATE = {
  players: [], weeklyGames: {}, weeklyGuests: {}, totalWeeks: 1, announcement: {title:"", body:""}, loginPosts: [],
  leagueName: "Croquet De-Twah", leagueLogo: null,
  venues: DEFAULT_VENUES.map((name,i) => ({id:i+1,name,rating:0,comment:"",timesPlayed:0,reviews:[]})),
  votes: {},
  joinCode: "croquet2026",
  nextVenueId: null,
  weekSignups: {},
  pastSeasons: {},
  leagueHonours: {
    seasons: {
      "2026":{ logoWinner:"", motto:"", mottoWinner:"", logoUrl:"" },
      "2025":{ logoWinner:"", motto:"", mottoWinner:"", logoUrl:"" },
    },
    awards: {
      "2026":[{title:"League Champion",recipient:"",pinned:true},{title:"Shot of the Day",recipient:""},{title:"Most Improved",recipient:""}],
      "2025":[{title:"League Champion",recipient:"",pinned:true},{title:"Shot of the Day",recipient:""},{title:"Most Improved",recipient:""}],
      "2024":[{title:"League Champion",recipient:"",pinned:true}],
      "2023":[{title:"League Champion",recipient:"",pinned:true}],
      "2022":[{title:"League Champion",recipient:"",pinned:true}],
      "2021":[{title:"League Champion",recipient:"",pinned:true}],
      "2020":[{title:"League Champion",recipient:"",pinned:true}],
    },
  },
};

function LoginScreen({onLogin, onSignup, nextMatch, leagueLogo, leagueName, players, weekSignups, nextMatchWeek, weeklyGames, venues, announcement={}, loginPosts=[], membershipDues={}, suspendedPlayers=[], publishedGroups=null, weekTiebreakers={}, weekVenues={}}) {
  const [mode, setMode]       = useState("bubbles");
  const [selected, setSelected] = useState(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr]         = useState("");

  const wk = nextMatchWeek || 1;
  const signup = weekSignups?.[wk] || {open:false,signups:[],waitlist:[],groups:null,published:false};
  const signupIds = new Set((signup.signups||[]).map(String));
  const waitlistIds = new Set((signup.waitlist||[]).map(String));
  // Use flat publishedGroups field for reliable display (avoids nested Firestore issues)
  const groupsForDisplay = publishedGroups && publishedGroups.week===wk && publishedGroups.published ? publishedGroups.groups : null;
  console.log("[CroquetLogin] wk=",wk,"publishedGroups=",JSON.stringify(publishedGroups),"signup.published=",signup.published,"signup.groups=",signup.groups);

  const tryAdmin = () => {
    const match = DEFAULT_ADMINS.find(a => a.username===username.trim() && a.password===password);
    if (match) onLogin({name:match.username, role:match.role});
    else setErr("Invalid username or password.");
  };

  const iSt = {background:C.surface,border:`1px solid ${C.border}`,borderRadius:"8px",color:C.text,padding:"12px 14px",fontSize:"0.95rem",fontFamily:"Georgia,serif",outline:"none",width:"100%",boxSizing:"border-box"};
  const bSt = (col=C.accent) => ({background:`linear-gradient(135deg,${col},${col}bb)`,border:"none",borderRadius:"8px",color:col===C.accent?C.bg:C.text,padding:"12px 20px",fontFamily:"Georgia,serif",fontSize:"0.95rem",fontWeight:"bold",cursor:"pointer",width:"100%",letterSpacing:"0.04em"});

  return (
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"Georgia,serif",padding:"20px",overflowY:"auto"}}>
      <div style={{maxWidth:"520px",margin:"0 auto",paddingBottom:"40px"}}>

        {/* Header */}
        <div style={{textAlign:"center",padding:"24px 0 20px"}}>
          {leagueLogo&&<img src={leagueLogo} style={{width:"64px",height:"64px",borderRadius:"12px",objectFit:"cover",marginBottom:"10px"}}/>}
          <h1 style={{color:C.cream,fontSize:"1.8rem",margin:"0 0 4px",letterSpacing:"0.04em"}}>{leagueName||"Croquet De-Twah"}</h1>
          <p style={{color:C.muted,fontSize:"0.82rem",margin:0}}>2026 Season · Week {wk}</p>
        </div>

        {/* Next venue image card */}
        {nextMatch&&(
          <div style={{marginBottom:"16px",borderRadius:"10px",overflow:"hidden",border:`1px solid ${C.accent}44`}}>
            {nextMatch.imageUrl?(
              <div style={{position:"relative",height:"130px",overflow:"hidden"}}>
                <img src={nextMatch.imageUrl} alt={nextMatch.name} style={{width:"100%",height:"100%",objectFit:"cover",display:"block",filter:"brightness(0.45)"}}/>
                <div style={{position:"absolute",inset:0,background:"linear-gradient(to bottom,transparent 20%,#0e0e0e 100%)"}}/>
                <div style={{position:"absolute",bottom:0,left:0,right:0,padding:"12px 14px"}}>
                  <div style={{fontSize:"0.6rem",color:C.accent,letterSpacing:"0.12em",marginBottom:"3px",fontWeight:"bold"}}>NEXT MATCH · WEEK {wk}</div>
                  <div style={{fontSize:"0.92rem",color:C.cream,fontWeight:"bold",marginBottom:"2px"}}>{nextMatch.name}</div>
                  <div style={{fontSize:"0.72rem",color:C.muted}}>📅 {nextMatch.date}</div>
                </div>
              </div>
            ):(
              <div style={{padding:"12px 14px",background:C.card}}>
                <div style={{fontSize:"0.6rem",color:C.accent,letterSpacing:"0.12em",marginBottom:"3px",fontWeight:"bold"}}>NEXT MATCH · WEEK {wk}</div>
                <div style={{fontSize:"0.88rem",color:C.cream,fontWeight:"bold"}}>📍 {nextMatch.name}</div>
                <div style={{fontSize:"0.72rem",color:C.muted,marginTop:"2px"}}>📅 {nextMatch.date}</div>
              </div>
            )}
          </div>
        )}

        {/* Announcement */}
        {announcement?.body&&(
          <div style={{marginBottom:"16px",borderRadius:"10px",border:`1px solid ${C.accent}66`,background:"#1a1400",padding:"14px 16px"}}>
            <div style={{fontSize:"0.6rem",color:C.accent,letterSpacing:"0.12em",fontWeight:"bold",marginBottom:"6px"}}>📣 COMMISSIONER MESSAGE</div>
            {announcement.title&&<div style={{color:C.cream,fontWeight:"bold",fontSize:"0.88rem",marginBottom:"5px"}}>{announcement.title}</div>}
            <div style={{color:C.muted,fontSize:"0.82rem",lineHeight:"1.55",whiteSpace:"pre-wrap"}}>{announcement.body}</div>
          </div>
        )}

        {/* Last week winner */}
        {(()=>{
          const wg=weeklyGames||{};
          const lastWk=Math.max(0,...Object.values(wg).flatMap(wkMap=>Object.entries(wkMap).filter(([,gs])=>gs.some(g=>!g.absent)).map(([w])=>parseInt(w))));
          if(!lastWk) return null;
          const totals=(players||[]).map(p=>{
            const games=wg[p.id]?.[lastWk]||[];
            const pts=games.reduce((s,g)=>s+(g.pts||0)+(g.sotd||0),0);
            const absent=games.every(g=>g.absent);
            return{id:String(p.id),name:p.name,imageUrl:p.imageUrl,pts,absent};
          }).filter(p=>!p.absent&&p.pts>0);
          const maxPts=Math.max(0,...totals.map(p=>p.pts));
          let winners=totals.filter(p=>p.pts===maxPts);
          if(!winners.length) return null;
          const rawTie=winners.length>1;
          const tbId=weekTiebreakers?.[lastWk];
          const tbWinner=rawTie&&tbId?winners.find(w=>w.id===String(tbId)):null;
          const displayWinners=tbWinner?[tbWinner]:winners;
          const isTie=rawTie&&!tbWinner;
          return(
            <div style={{marginBottom:"16px",borderRadius:"10px",overflow:"hidden",border:`1px solid ${isTie?C.blue+"66":C.accent+"44"}`,background:isTie?"#0e101a":"#0e1a0e",padding:"10px 14px",display:"flex",alignItems:"center",gap:"10px"}}>
              <span style={{fontSize:"1.2rem"}}>{isTie?"🤝":"🏆"}</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:"0.6rem",color:C.muted,letterSpacing:"0.1em",marginBottom:"2px"}}>{isTie?"WEEK "+lastWk+" — TIED":tbWinner?"WEEK "+lastWk+" WINNER (TB)":"WEEK "+lastWk+" WINNER"}</div>
                <div style={{display:"flex",alignItems:"center",gap:"6px",flexWrap:"wrap"}}>
                  {displayWinners.map(w=>(
                    <div key={w.name} style={{display:"flex",alignItems:"center",gap:"5px"}}>
                      {w.imageUrl&&<img src={w.imageUrl} alt={w.name} style={{width:"20px",height:"20px",borderRadius:"50%",objectFit:"cover",border:`1.5px solid ${isTie?C.blue:C.accent}`}}/>}
                      <span style={{color:isTie?C.blue:C.accentLight,fontWeight:"bold",fontSize:"0.88rem"}}>{w.name}</span>
                    </div>
                  ))}
                  <span style={{color:C.muted,fontWeight:"normal",fontSize:"0.72rem"}}>· {maxPts} pts</span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* BUBBLE MODE */}
        {mode==="bubbles"&&(
          <>
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"12px",padding:"20px",marginBottom:"12px"}}>
              <div style={{color:C.accentLight,fontSize:"0.82rem",fontWeight:"bold",marginBottom:"4px"}}>
                {signup.open?"🏑 Week "+wk+" sign-ups are open!":"Tap your name to enter"}
              </div>
              {signup.open&&<div style={{color:C.muted,fontSize:"0.75rem",marginBottom:"14px"}}>{signupIds.size}/24 signed up{waitlistIds.size>0&&` · ${waitlistIds.size} waitlist`}</div>}
              {!signup.open&&<div style={{color:C.muted,fontSize:"0.75rem",marginBottom:"14px"}}>Select your name below</div>}
              <div style={{display:"flex",flexWrap:"wrap",gap:"8px"}}>
                {(players||[]).filter(p=>p.joinedWeek<=wk&&!suspendedPlayers.includes(String(p.id))).map(p=>{
                  const pid=String(p.id);
                  const isIn=signupIds.has(pid);
                  const isWait=waitlistIds.has(pid);
                  return(
                    <button key={p.id} onClick={()=>setSelected(p)}
                      style={{padding:"8px 16px",borderRadius:"20px",
                        border:`1px solid ${isIn?C.green:isWait?C.accent:C.border}`,
                        background:isIn?C.green+"33":isWait?C.accent+"22":"transparent",
                        color:isIn?C.greenLight:isWait?C.accentLight:C.cream,
                        fontFamily:"Georgia,serif",fontSize:"0.85rem",cursor:"pointer"}}>
                      {isIn?"✓ ":isWait?"⏳ ":""}{p.name}{(typeof membershipDues[String(p.id)]==="number"&&membershipDues[String(p.id)]>0)&&" 🏑"}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Groups display */}
            {groupsForDisplay&&groupsForDisplay.length>0&&(
              <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"12px",padding:"20px",marginBottom:"12px"}}>
                <div style={{color:C.muted,fontSize:"0.7rem",letterSpacing:"0.1em",marginBottom:"12px"}}>WEEK {wk} GROUPS</div>
                <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
                  {groupsForDisplay.map((grp,gi)=>(
                    <div key={gi} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:"8px",padding:"10px 12px",flex:1,minWidth:"120px"}}>
                      <div style={{color:C.accentLight,fontSize:"0.72rem",fontWeight:"bold",marginBottom:"8px"}}>Group {gi+1}</div>
                      {grp.map(pid=>{
                        const p=(players||[]).find(x=>String(x.id)===String(pid));
                        return p?<div key={pid} style={{color:C.cream,fontSize:"0.82rem",padding:"3px 0",borderBottom:`1px solid ${C.border}22`}}>{p.name}{(typeof membershipDues[String(p.id)]==="number"&&membershipDues[String(p.id)]>0)&&" 🏑"}</div>:null;
                      })}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{textAlign:"center"}}>
              <button onClick={()=>setMode("admin")} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:"0.78rem",fontFamily:"Georgia,serif",textDecoration:"underline"}}>Admin login</button>
            </div>
          </>
        )}

        {/* CONFIRM OVERLAY */}
        {selected&&(
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"center",justifyContent:"center",padding:"20px",zIndex:100}}>
            <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"14px",padding:"28px",maxWidth:"320px",width:"100%",textAlign:"center"}}>
              <div style={{fontSize:"1.8rem",marginBottom:"8px"}}>👋</div>
              <div style={{color:C.cream,fontSize:"1.1rem",fontWeight:"bold",marginBottom:"6px"}}>Hey {selected.name}!</div>
              <div style={{color:C.muted,fontSize:"0.88rem",marginBottom:groupsForDisplay&&signup.open?"8px":"24px"}}>
                {signup.open?`Are you coming to Week ${wk}?`:`Enter the league as ${selected.name}?`}
              </div>
              {groupsForDisplay&&signup.open&&(()=>{
                const pid=String(selected.id);
                const alreadyIn=groupsForDisplay.findIndex(g=>g.includes(pid));
                if(alreadyIn>=0) return <div style={{background:C.accent+"22",border:`1px solid ${C.accent}44`,borderRadius:"8px",padding:"8px 12px",marginBottom:"16px",fontSize:"0.8rem",color:C.accentLight}}>You're in <strong>Group {alreadyIn+1}</strong></div>;
                const minSize=Math.min(...groupsForDisplay.map(g=>g.length));
                const targetIdx=groupsForDisplay.findIndex(g=>g.length===minSize);
                return <div style={{background:C.green+"22",border:`1px solid ${C.green}44`,borderRadius:"8px",padding:"8px 12px",marginBottom:"16px",fontSize:"0.8rem",color:C.greenLight}}>You'll be added to <strong>Group {targetIdx+1}</strong></div>;
              })()}
              <div style={{display:"flex",gap:"10px",marginBottom:"12px"}}>
                {signup.open&&(
                  <button onClick={()=>{onSignup(selected.id,true);onLogin({name:selected.name,role:"viewer"});setSelected(null);}}
                    style={{flex:1,padding:"11px",background:`linear-gradient(135deg,${C.green},${C.green}bb)`,border:"none",borderRadius:"8px",color:C.text,fontFamily:"Georgia,serif",fontSize:"0.9rem",fontWeight:"bold",cursor:"pointer"}}>
                    Yes, I'm in! 🏑
                  </button>
                )}
                <button onClick={()=>{if(signup.open)onSignup(selected.id,false);onLogin({name:selected.name,role:"viewer"});setSelected(null);}}
                  style={{flex:1,padding:"11px",background:"none",border:`1px solid ${C.border}`,borderRadius:"8px",color:C.muted,fontFamily:"Georgia,serif",fontSize:"0.9rem",cursor:"pointer"}}>
                  {signup.open?"Can't make it":"Just browsing"}
                </button>
              </div>
              <button onClick={()=>setSelected(null)} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:"0.78rem",fontFamily:"Georgia,serif",textDecoration:"underline"}}>Back</button>
            </div>
          </div>
        )}

        {/* ADMIN MODE */}
        {mode==="admin"&&(
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"12px",padding:"24px"}}>
            <h2 style={{color:C.accentLight,fontSize:"1rem",margin:"0 0 20px",letterSpacing:"0.06em"}}>ADMIN LOGIN</h2>
            {err&&<div style={{background:C.red+"22",border:`1px solid ${C.red}44`,borderRadius:"6px",padding:"10px 14px",color:C.red,fontSize:"0.82rem",marginBottom:"16px"}}>{err}</div>}
            <div style={{marginBottom:"14px"}}><label style={{color:C.muted,fontSize:"0.7rem",letterSpacing:"0.1em",display:"block",marginBottom:"6px"}}>USERNAME</label><input style={iSt} value={username} onChange={e=>{setUsername(e.target.value);setErr("");}} placeholder="Enter username" onKeyDown={e=>e.key==="Enter"&&tryAdmin()}/></div>
            <div style={{marginBottom:"20px"}}><label style={{color:C.muted,fontSize:"0.7rem",letterSpacing:"0.1em",display:"block",marginBottom:"6px"}}>PASSWORD</label><input style={iSt} type="password" value={password} onChange={e=>{setPassword(e.target.value);setErr("");}} placeholder="Enter password" onKeyDown={e=>e.key==="Enter"&&tryAdmin()}/></div>
            <button style={bSt()} onClick={tryAdmin}>Sign In</button>
            <button onClick={()=>{setMode("bubbles");setErr("");}} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:"0.82rem",fontFamily:"Georgia,serif",marginTop:"14px",display:"block",width:"100%",textAlign:"center"}}>← Back</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser]         = useState(() => {
  try { return JSON.parse(sessionStorage.getItem("croquetUser")); } catch { return null; }
});
  const [appState, setAppState] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const saveTimer               = useRef(null);
  const isAdmin = user?.role==="admin"||user?.role==="superadmin";

  useEffect(() => {
    const unsub = onSnapshot(LEAGUE_DOC, (snap) => {
      if (snap.exists()) {
        setAppState(snap.data());
      } else {
        setAppState(EMPTY_STATE);
      }
      setLoading(false);
    }, (err) => {
      console.error("Firestore error:", err);
      setAppState(EMPTY_STATE);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Register push subscription when user logs in
  useEffect(() => {
    if (!user) return;
    const saveSub = async () => {
      try {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") return;
        const sub = await subscribeToPush();
        if (!sub?.endpoint) return;
        const endpointHash = btoa(sub.endpoint).replace(/[^a-zA-Z0-9]/g,"").slice(0,40);
        const existing = await import("firebase/firestore").then(({getFirestore,doc,getDoc,setDoc})=>{
          const db=getFirestore(); const ref=doc(db,"pushSubscriptions",endpointHash);
          return setDoc(ref,{subscription:sub,playerName:user.name,role:user.role,updatedAt:Date.now()},{merge:true});
        });
      } catch(e) { console.error("Push setup error:",e); }
    };
    saveSub();
  }, [user?.name]);

  const uploadImage = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", CLOUDINARY_PRESET);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/image/upload`, {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    return data.secure_url;
  };

  const persist = (newState) => {
    setAppState(newState);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaving(true);
    saveTimer.current = setTimeout(async () => {
      try { await setDoc(LEAGUE_DOC, newState); }
      catch(e) { console.error("Save failed", e); }
      setSaving(false);
    }, 800);
  };

  if (loading) return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",color:C.muted,fontFamily:"Georgia,serif",fontSize:"1rem"}}>
      Loading league data…
    </div>
  );
  const getMatchDate = (weekNum) => {
    const seasonStart = new Date(2026, 4, 4); // May 4 2026 - using local time to avoid timezone issues
    const matchDate = new Date(seasonStart);
    matchDate.setDate(seasonStart.getDate() + (weekNum - 1) * 7);
    return matchDate.toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric"});
  };

  const nextVenue = appState?.nextVenueId
    ? appState.venues?.find(v=>String(v.id)===String(appState.nextVenueId))
    : null;

  const nextMatch = nextVenue ? {
    ...nextVenue,
    avgRating: nextVenue.reviews?.length
      ? (nextVenue.reviews.reduce((s,r)=>s+r.rating,0)+(nextVenue.rating||0))/(nextVenue.reviews.length+(nextVenue.rating>0?1:0))
      : nextVenue.rating||0,
    date: getMatchDate(appState.nextMatchWeek||1),
  } : null;

  if (!user) return <LoginScreen
    onLogin={(u)=>{setUser(u);sessionStorage.setItem("croquetUser",JSON.stringify(u));}}
    onSignup={(playerId,coming)=>{
      const wk=appState.nextMatchWeek||1;
      const cur=appState.weekSignups?.[wk]||{open:false,signups:[],waitlist:[],groups:null,published:false};
      const pid=String(playerId);
      let signups=(cur.signups||[]).map(String), waitlist=(cur.waitlist||[]).map(String);
      if(coming){
        if(!signups.includes(pid)&&!waitlist.includes(pid)){
          if(signups.length<24) signups=[...signups,pid];
          else waitlist=[...waitlist,pid];
        }
      } else {
        signups=signups.filter(x=>x!==pid);
        waitlist=waitlist.filter(x=>x!==pid);
      }
      // Auto-adjust publishedGroups if published
      const pg=appState.publishedGroups;
      let newPG=pg||null;
      if(pg&&pg.published&&pg.week===wk&&pg.groups){
        let grps=pg.groups.map(g=>[...g]);
        let changed=false;
        if(coming){
          const alreadyIn=grps.some(g=>g.includes(pid));
          if(!alreadyIn){
            const minSize=Math.min(...grps.map(g=>g.length));
            const targetIdx=grps.findIndex(g=>g.length===minSize);
            grps=grps.map((g,i)=>i===targetIdx?[...g,pid]:g);
            changed=true;
          }
        } else {
          const inGroup=grps.some(g=>g.includes(pid));
          if(inGroup){ grps=grps.map(g=>g.filter(id=>id!==pid)); changed=true; }
        }
        if(changed) newPG={...pg,groups:grps};
      }
      const newWkData={...cur,signups,waitlist};
      // Update local state immediately
      const newAppState={...appState,weekSignups:{...appState.weekSignups,[wk]:newWkData},...(newPG!==pg?{publishedGroups:newPG}:{})};
      setAppState(newAppState);
      // Use targeted updateDoc so this NEVER overwrites admin-written group/publish data
      const updates={[`weekSignups.${wk}.signups`]:signups,[`weekSignups.${wk}.waitlist`]:waitlist};
      if(newPG!==pg) updates.publishedGroups=newPG;
      updateDoc(LEAGUE_DOC,updates).catch(e=>console.error("Signup save failed:",e));
    }}
    nextMatch={nextMatch}
    leagueLogo={appState?.leagueLogo}
    leagueName={appState?.leagueName}
    players={appState?.players||[]}
    weekSignups={appState?.weekSignups||{}}
    nextMatchWeek={appState?.nextMatchWeek||1}
    weeklyGames={appState?.weeklyGames||{}}
    venues={appState?.venues||[]}
    announcement={appState?.announcement||{title:"",body:""}}
    loginPosts={appState?.loginPosts||[]}
    membershipDues={appState?.membershipDues||{}}
    suspendedPlayers={appState?.suspendedPlayers||[]}
    publishedGroups={appState?.publishedGroups||null}
    weekTiebreakers={appState?.weekTiebreakers||{}}
    weekVenues={appState?.weekVenues||{}}
  />;
  return <LeagueApp user={user} isAdmin={isAdmin} appState={appState} persist={persist} saving={saving} onLogout={()=>{setUser(null);sessionStorage.removeItem("croquetUser");}} uploadImage={uploadImage}/>;
}

function LeagueApp({user, isAdmin, appState, persist, saving, onLogout, uploadImage}) {
  const {players, weeklyGames, weeklyGuests={}, totalWeeks, leagueName, leagueLogo, venues, weekSignups={}, membershipDues={}, leagueExpenses=[], announcement={title:"",body:""}, loginPosts=[], suspendedPlayers=[], weekVenues={}, weekTiebreakers={}} = appState;
  const update = patch => persist({...appState,...patch});

  const [tab, setTab]               = useState("standings");
  const [chartPlayers, setChartPlayers] = useState([]);
  const [note, setNote]             = useState("");
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName]     = useState("");
  const logoInputRef                = useRef();

  const [venueForm, setVenueForm]   = useState({name:"",rating:0,comment:""});
  const [editVenue, setEditVenue]   = useState(null);
  const [reviewVenue, setReviewVenue] = useState(null);
  const [reviewForm, setReviewForm] = useState({rating:0,comment:""});
  const [collapsedReviews, setCollapsedReviews] = useState({});
  const [venueWeekPick, setVenueWeekPick] = useState("");

  const [gameWeek, setGameWeek]     = useState(appState.nextMatchWeek||1);
  const [gameVenue, setGameVenue]   = useState(venues[0]?.name||"");
  const [gameDate, setGameDate]     = useState(new Date().toISOString().slice(0,10));
  const [groups, setGroups]         = useState([{id:1,players:[{playerId:"",position:""}]}]);
  const [sotdEntries, setSotdEntries] = useState([{playerId:"",count:1}]);
  const [absentPreview, setAbsentPreview] = useState([]);

  const [newName, setNewName]       = useState("");
  const [newWeek, setNewWeek]       = useState(1);

  const [editModal, setEditModal]   = useState(null);
  const [editPos, setEditPos]       = useState("");
  const [editSotd, setEditSotd]     = useState(0);

  const [logoRanking, setLogoRanking]   = useState([]);
  const [mottoRanking, setMottoRanking] = useState([]);
  const [voteSubmitted, setVoteSubmitted] = useState(false);
  const [lightbox, setLightbox] = useState(null);
  const [showPhotoPicker, setShowPhotoPicker] = useState(false);
  const [editingProfileName, setEditingProfileName] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileWeek, setProfileWeek] = useState(1);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [expForm, setExpForm] = useState({desc:"",amount:""});
  const [paidCollapsed, setPaidCollapsed] = useState(false);
  const [suspendedCollapsed, setSuspendedCollapsed] = useState(false);

  const [addPlayerModal, setAddPlayerModal] = useState(null); // {week}
  const [addPlayerPid, setAddPlayerPid]     = useState("");
  const [addPlayerGroupId, setAddPlayerGroupId] = useState("");
  const [addPlayerPos, setAddPlayerPos]     = useState("");
  const [addPlayerSotd, setAddPlayerSotd]   = useState(0);
  const [matchNote, setMatchNote]           = useState("");
  const [matchSending, setMatchSending]     = useState(false);
  const [resultsNote, setResultsNote]       = useState("");
  const [resultsSending, setResultsSending] = useState(false);
  const [addIsGuest, setAddIsGuest]         = useState(false);
  const [addGuestName, setAddGuestName]     = useState("");
  const [weekGroupFilter, setWeekGroupFilter] = useState({});
  const [gameRound, setGameRound]           = useState(1);
  const [gridEditKey, setGridEditKey]       = useState(null);
  const [gridEditPos, setGridEditPos]       = useState("");
  const [gridEditSotd, setGridEditSotd]     = useState(0);
  const [gridSelWeek, setGridSelWeek]       = useState("");
  const [standingsView, setStandingsView]   = useState("list");
  const [standingsSort, setStandingsSort]   = useState("pts");
  const [standingsMetric, setStandingsMetric] = useState("pts");

  const votes = appState.votes || {};

  const notify = msg => { setNote(msg); setTimeout(()=>setNote(""),3500); };
  const maxWk  = Math.max(totalWeeks, ...Object.values(weeklyGames).flatMap(wg=>Object.keys(wg).map(Number)).filter(n=>!isNaN(n)), 1);
  const weekOptions = Array.from({length:maxWk+3},(_,i)=>i+1);

  const computeAbsentPreview = (grps,wk,plrs) => {
    const ids=new Set(grps.flatMap(g=>g.players.map(r=>r.playerId)).filter(Boolean));
    return plrs.filter(p=>p.joinedWeek<=parseInt(wk)&&!ids.has(String(p.id))).map(p=>p.name);
  };
  const handleGroupChange = updater => {
    setGroups(prev=>{ const next=updater(prev); setAbsentPreview(computeAbsentPreview(next,gameWeek,players)); return next; });
  };
  const handleWeekChange = wk => { setGameWeek(wk); setAbsentPreview(computeAbsentPreview(groups,wk,players)); };

  const handleLogoUpload = async e => {
    const file=e.target.files?.[0]; if(!file) return;
    try {
      const url=await uploadImage(file);
      update({leagueLogo:url});
      notify("League logo updated!");
    } catch(err) {
      notify("Upload failed — try again.");
    }
  };

  const standings = useMemo(()=>[...players].filter(p=>!suspendedPlayers.includes(String(p.id))).map(p=>{
    const pts=totalPts(p.id,weeklyGames);
    const allG=Object.values(weeklyGames[p.id]||{}).flat();
    const wins=allG.filter(g=>g.position===1&&!g.absent).length;
    const absences=allG.filter(g=>g.absent).length;
    const sotdTotal=allG.reduce((s,g)=>s+(g.sotd||0),0);
    const weeksAttended=new Set(Object.entries(weeklyGames[p.id]||{}).filter(([,gs])=>gs.some(g=>!g.absent)).map(([w])=>w)).size;
    const maxPts=maxPossible(p.id,weeklyGames);
    const mvp=maxPts>0?((pts/maxPts)*100).toFixed(1):"—";
    return{...p,pts,wins,absences,sotdTotal,weeksAttended,mvp};
  }).sort((a,b)=>b.pts-a.pts),[players,weeklyGames]);

  const chartData=useMemo(()=>buildChartData(players.filter(p=>chartPlayers.includes(p.id)),weeklyGames,maxWk),[players,weeklyGames,chartPlayers,maxWk]);

  const venueAvgRating = v => {
    const reviews=v.reviews||[];
    if(reviews.length===0) return v.rating||0;
    const sum=reviews.reduce((s,r)=>s+r.rating,0)+(v.rating||0);
    const count=reviews.length+(v.rating>0?1:0);
    return count>0?sum/count:0;
  };
  const sortedVenues=useMemo(()=>[...venues].map(v=>({...v,avgRating:venueAvgRating(v)})).sort((a,b)=>b.avgRating-a.avgRating||a.name.localeCompare(b.name)),[venues]);

  const addVenue = () => {
    const name=venueForm.name.trim(); if(!name) return;
    if(venues.find(v=>v.name.toLowerCase()===name.toLowerCase())){notify("Venue already exists.");return;}
    update({venues:[...venues,{id:Date.now(),name,rating:venueForm.rating,comment:venueForm.comment,timesPlayed:0,reviews:[]}]});
    setVenueForm({name:"",rating:0,comment:""}); notify(`${name} added!`);
  };
  const saveVenueEdit = () => {
    if(!editVenue) return;
    update({venues:venues.map(v=>v.id===editVenue.id?{...v,...editVenue,reviews:v.reviews||[]}:v)});
    setEditVenue(null); notify("Venue updated!");
  };
  const removeVenue = id => { update({venues:venues.filter(v=>v.id!==id)}); notify("Venue removed."); };

  const submitReview = () => {
    if(!reviewVenue) return;
    if(reviewForm.rating===0){notify("Please select a star rating.");return;}
    const review={id:Date.now(),author:user.name,rating:reviewForm.rating,comment:reviewForm.comment.trim(),date:new Date().toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"})};
    update({venues:venues.map(v=>v.id===reviewVenue.id?{...v,reviews:[...(v.reviews||[]),review]}:v)});
    setReviewVenue(null); setReviewForm({rating:0,comment:""}); notify("Review submitted!");
  };
  const deleteReview = (venueId,reviewId) => {
    update({venues:venues.map(v=>v.id===venueId?{...v,reviews:(v.reviews||[]).filter(r=>r.id!==reviewId)}:v)});
    notify("Review removed.");
  };

  const addPlayer = () => {
    const name=newName.trim(); if(!name) return;
    if(players.find(p=>p.name===name)){notify("Player already exists.");return;}
    const id=Date.now(),jw=parseInt(newWeek);
    const preGames={};
    for(let w=1;w<jw;w++) preGames[w]=[{gameId:`pre-${w}`,position:null,groupSize:null,pts:1,sotd:0,absent:true,label:"Pre-join"}];
    update({players:[...players,{id,name,joinedWeek:jw}],weeklyGames:{...weeklyGames,[id]:preGames},totalWeeks:Math.max(totalWeeks,jw)});
    setChartPlayers(prev=>[...prev,id]); setNewName(""); notify(`${name} added!`);
  };
  const removePlayer = id => {
    const p=players.find(x=>x.id===id); const nwg={...weeklyGames}; delete nwg[id];
    update({players:players.filter(x=>x.id!==id),weeklyGames:nwg});
    setChartPlayers(prev=>prev.filter(x=>x!==id)); notify(`${p?.name} removed.`);
  };

  const addGroup=()=>handleGroupChange(prev=>[...prev,{id:Date.now(),players:[{playerId:"",position:""}]}]);
  const removeGroup=gid=>handleGroupChange(prev=>prev.filter(g=>g.id!==gid));
  const addRowToGroup=(gid,playerId="")=>handleGroupChange(prev=>prev.map(g=>g.id===gid?{...g,players:[...g.players,{playerId,position:String(g.players.filter(r=>r.playerId).length+1)}]}:g));
  const removeRowFromGroup=(gid,idx)=>handleGroupChange(prev=>prev.map(g=>g.id===gid?{...g,players:g.players.filter((_,i)=>i!==idx)}:g));
  const updateGroupRow=(gid,idx,field,val)=>handleGroupChange(prev=>prev.map(g=>g.id===gid?{...g,players:g.players.map((r,i)=>i===idx?{...r,[field]:val}:r)}:g));
  const addSotdRow=()=>setSotdEntries(prev=>[...prev,{playerId:"",count:1}]);
  const removeSotdRow=idx=>setSotdEntries(prev=>prev.filter((_,i)=>i!==idx));
  const updateSotdRow=(idx,field,val)=>setSotdEntries(prev=>prev.map((r,i)=>i===idx?{...r,[field]:val}:r));

  const submitGames = () => {
    const wk=parseInt(gameWeek); let errors=[],updates={};
    const validGroups = [];
    groups.forEach((grp,gi)=>{
      const allRows=grp.players.filter(r=>(r.playerId||r.isGuest)&&r.position);
      const rows=allRows; // includes guests for sizing
      if(rows.length<2){errors.push(`Group ${gi+1} needs at least 2 players.`);return;}
      const pos=rows.map(r=>parseInt(r.position));
      if(new Set(pos).size!==pos.length){errors.push(`Group ${gi+1} has duplicate positions.`);return;}
      if(Math.max(...pos)!==rows.length){errors.push(`Group ${gi+1}: positions must run 1 to ${rows.length}.`);return;}
      validGroups.push({grp,gi,rows});
    });
    if(errors.length){notify(errors[0]);return;}
    const maxGroupSize = Math.max(...validGroups.map(({rows})=>rows.length));
    const newGuestEntries=[];
    validGroups.forEach(({grp,gi,rows})=>{
      const gameId=`g-${Date.now()}-${gi}`;
      rows.forEach(r=>{
        const p2=parseInt(r.position),pts=p2===rows.length?0:calcPoints(p2,maxGroupSize);
        if(r.isGuest){
          newGuestEntries.push({gameId,guestName:r.guestName||"Guest",position:p2,groupSize:maxGroupSize,actualGroupSize:rows.length,pts,gameRound:parseInt(gameRound),label:`Gp ${gi+1}`,venue:gameVenue,date:gameDate});
          return;
        }
        if(!updates[r.playerId]) updates[r.playerId]={};
        if(!updates[r.playerId][wk]) updates[r.playerId][wk]=[];
        updates[r.playerId][wk].push({gameId,position:p2,groupSize:maxGroupSize,actualGroupSize:rows.length,pts,sotd:0,absent:false,label:`Gp ${gi+1}`,venue:gameVenue,date:gameDate,gameRound:parseInt(gameRound)});
      });
    });
    const sotdMap={};
    sotdEntries.filter(s=>s.playerId).forEach(s=>{sotdMap[s.playerId]=(sotdMap[s.playerId]||0)+parseInt(s.count||1);});
    const includedIds=new Set(Object.keys(updates));
    const autoAbsent=players.filter(p=>p.joinedWeek<=wk&&!includedIds.has(String(p.id))&&!suspendedPlayers.includes(String(p.id)));
    const nwg={...weeklyGames};
    Object.entries(updates).forEach(([pid,wkData])=>{
      nwg[pid]={...(nwg[pid]||{})};
      Object.entries(wkData).forEach(([w,games])=>{
        const sotd=sotdMap[pid]||0;
        nwg[pid][w]=[...(nwg[pid][w]||[]),...games.map((g,i)=>i===0?{...g,sotd}:g)];
      });
    });
    autoAbsent.forEach(p=>{
      nwg[p.id]={...(nwg[p.id]||{})};
      if(!(nwg[p.id][wk]?.length>0)) nwg[p.id][wk]=[{gameId:`abs-auto-${Date.now()}-${p.id}`,position:null,groupSize:null,pts:1,sotd:0,absent:true,label:"Absent"}];
    });
    const nwGuests={...weeklyGuests,[wk]:[...(weeklyGuests[wk]||[]),...newGuestEntries]};
    update({weeklyGames:nwg,weeklyGuests:nwGuests,venues:venues.map(v=>v.name===gameVenue?{...v,timesPlayed:(v.timesPlayed||0)+1}:v),totalWeeks:Math.max(totalWeeks,wk)});
    setGroups([{id:Date.now(),players:[{playerId:"",position:""}]}]);
    setSotdEntries([{playerId:"",count:1}]); setAbsentPreview([]);
    const names=autoAbsent.map(p=>p.name);
    notify(names.length>0?`Week ${wk} recorded! Auto-absent: ${names.join(", ")}`:`Week ${wk} results recorded!`);
  };

  const submitVote = () => {
    if(logoRanking.length===0||mottoRanking.length===0){notify("Please rank at least one logo and one motto!");return;}
    const newVotes={...votes,[user.name]:{logoRanking,mottoRanking,submittedAt:new Date().toISOString()}};
    update({votes:newVotes});
    setVoteSubmitted(true);
    notify("Your vote has been recorded! 🗳");
  };

  const runRCV = (entries, allVotes, type) => {
    const ballots = Object.values(allVotes).map(v => v[type==="logo"?"logoRanking":"mottoRanking"]).filter(b=>b&&b.length>0);
    if(ballots.length===0) return entries.map(e=>({...e,votes:0,eliminated:false}));
    let remaining = entries.map(e=>e.id);
    while(remaining.length>1) {
      const counts={};
      remaining.forEach(id=>{counts[id]=0;});
      ballots.forEach(ballot=>{
        const top=ballot.find(id=>remaining.includes(id));
        if(top) counts[top]=(counts[top]||0)+1;
      });
      const total=Object.values(counts).reduce((a,b)=>a+b,0);
      const winner=remaining.find(id=>counts[id]>total/2);
      if(winner) break;
      const minVotes=Math.min(...remaining.map(id=>counts[id]||0));
      const toEliminate=remaining.filter(id=>(counts[id]||0)===minVotes);
      remaining=remaining.filter(id=>!toEliminate.includes(id));
    }
    const finalCounts={};
    remaining.forEach(id=>{finalCounts[id]=0;});
    ballots.forEach(ballot=>{
      const top=ballot.find(id=>remaining.includes(id));
      if(top) finalCounts[top]=(finalCounts[top]||0)+1;
    });
    return entries.map(e=>({...e,votes:finalCounts[e.id]||0,eliminated:!remaining.includes(e.id)})).sort((a,b)=>b.votes-a.votes);
  };

  const openEdit=(pid,week,gameIdx,game)=>{setEditModal({pid,week,gameIdx,game});setEditPos(game.position?String(game.position):"");setEditSotd(game.sotd||0);};
  const saveEdit=()=>{
    if(!editModal) return;
    const{pid,week,gameIdx,game}=editModal;
    const newPos=parseInt(editPos);
    const newPts=(!game.absent&&editPos)?calcPoints(newPos,game.groupSize):game.pts;
    const nwg={...weeklyGames,[pid]:{...weeklyGames[pid]}};
    const wkG=[...(nwg[pid][week]||[])];
    wkG[gameIdx]={...wkG[gameIdx],position:newPos||game.position,pts:newPts,sotd:parseInt(editSotd)||0};
    nwg[pid][week]=wkG; update({weeklyGames:nwg}); setEditModal(null); notify("Score updated!");
  };
  const deleteGame=(pid,week,gameIdx)=>{
    const removedGame=(weeklyGames[pid]?.[week]||[])[gameIdx];
    if(!removedGame||removedGame.absent){
      const nwg={...weeklyGames,[pid]:{...weeklyGames[pid],[week]:(weeklyGames[pid][week]||[]).filter((_,i)=>i!==gameIdx)}};
      update({weeklyGames:nwg}); setEditModal(null); notify("Entry deleted."); return;
    }
    const {gameId,position:removedPos}=removedGame;
    const nwg={...weeklyGames};
    // Remove the entry from the target player
    nwg[pid]={...nwg[pid],[week]:(nwg[pid][week]||[]).filter((_,i)=>i!==gameIdx)};
    // Recalculate group: collect all remaining players in this game
    const remaining=[];
    players.forEach(p=>{
      (nwg[p.id]?.[week]||[]).forEach((g,i)=>{
        if(g.gameId===gameId&&!g.absent) remaining.push({pid:String(p.id),idx:i,pos:g.position});
      });
    });
    const newSize=remaining.length;
    // Recalculate all remaining game-ids across the week to get max group size
    const gameIdCounts={};
    players.forEach(p=>{(nwg[p.id]?.[week]||[]).forEach(g=>{if(!g.absent&&g.gameId) gameIdCounts[g.gameId]=(gameIdCounts[g.gameId]||0)+1;});});
    const maxGs=Math.max(1,...Object.values(gameIdCounts));
    remaining.forEach(({pid:rpid,idx,pos})=>{
      const newPos=pos>removedPos?pos-1:pos;
      const newPts=newPos===newSize?0:calcPoints(newPos,maxGs);
      nwg[rpid]={...nwg[rpid],[week]:(nwg[rpid][week]||[]).map((g,i)=>
        i===idx?{...g,position:newPos,groupSize:maxGs,pts:newPts}:
        (!g.absent&&g.gameId&&g.gameId!==gameId)?{...g,groupSize:maxGs,pts:calcPoints(g.position,maxGs)}:g
      )};
    });
    update({weeklyGames:nwg}); setEditModal(null); notify("Player removed and scores recalculated.");
  };

  const swapPositions=(wk,gameId,pid,direction)=>{
    const entry=(weeklyGames[pid]?.[wk]||[]).find(g=>g.gameId===gameId);
    if(!entry||entry.absent) return;
    const curPos=entry.position, targetPos=curPos+direction;
    const other=players.find(p=>String(p.id)!==String(pid)&&(weeklyGames[p.id]?.[wk]||[]).some(g=>g.gameId===gameId&&g.position===targetPos));
    if(!other) return;
    const gs=entry.groupSize;
    const nwg={...weeklyGames};
    nwg[pid]={...nwg[pid],[wk]:(nwg[pid][wk]||[]).map(g=>g.gameId===gameId?{...g,position:targetPos,pts:calcPoints(targetPos,gs)}:g)};
    nwg[other.id]={...nwg[other.id],[wk]:(nwg[other.id][wk]||[]).map(g=>g.gameId===gameId?{...g,position:curPos,pts:calcPoints(curPos,gs)}:g)};
    update({weeklyGames:nwg});
  };

  const addMissedPlayer=()=>{
    if(!addPlayerModal||!addPlayerPid||!addPlayerGroupId||!addPlayerPos) return;
    const wk=parseInt(addPlayerModal.week), insertPos=parseInt(addPlayerPos);
    const groupEntries=[];
    players.forEach(p=>{(weeklyGames[p.id]?.[wk]||[]).forEach(g=>{if(g.gameId===addPlayerGroupId&&!g.absent) groupEntries.push({pid:String(p.id),g});});});
    const newGroupSize=groupEntries.length+1;
    const gameIdCounts={};
    players.forEach(p=>{(weeklyGames[p.id]?.[wk]||[]).forEach(g=>{if(!g.absent&&g.gameId) gameIdCounts[g.gameId]=(gameIdCounts[g.gameId]||0)+1;});});
    gameIdCounts[addPlayerGroupId]=newGroupSize;
    const maxGs=Math.max(1,...Object.values(gameIdCounts));
    const nwg={...weeklyGames};
    groupEntries.forEach(({pid,g})=>{
      const newPos=g.position>=insertPos?g.position+1:g.position;
      nwg[pid]={...(nwg[pid]||{}),[wk]:(nwg[pid]?.[wk]||[]).map(gg=>{
        if(gg.gameId===addPlayerGroupId) return {...gg,position:newPos,groupSize:maxGs,pts:calcPoints(newPos,maxGs)};
        if(!gg.absent&&gg.gameId) return {...gg,groupSize:maxGs,pts:calcPoints(gg.position,maxGs)};
        return gg;
      })};
    });
    const ref=groupEntries[0]?.g||{};
    const pidStr=String(addPlayerPid);
    nwg[pidStr]={...(nwg[pidStr]||{})};
    nwg[pidStr][wk]=[...(nwg[pidStr][wk]||[]).filter(g=>!g.absent),
      {gameId:addPlayerGroupId,position:insertPos,groupSize:maxGs,actualGroupSize:newGroupSize,
       pts:calcPoints(insertPos,maxGs),sotd:parseInt(addPlayerSotd)||0,absent:false,label:ref.label||"Gp 1",venue:ref.venue||"",date:ref.date||"",gameRound:ref.gameRound||1}
    ];
    update({weeklyGames:nwg});
    setAddPlayerModal(null); setAddPlayerPid(""); setAddPlayerGroupId(""); setAddPlayerPos(""); setAddPlayerSotd(0);
    notify("Player added and scores updated!");
  };
  const addGuestRetroactively=()=>{
    if(!addPlayerModal||!addPlayerGroupId||!addPlayerPos) return;
    const wk=parseInt(addPlayerModal.week), insertPos=parseInt(addPlayerPos);
    const memberEntries=[];
    players.forEach(p=>{(weeklyGames[p.id]?.[wk]||[]).forEach(g=>{if(g.gameId===addPlayerGroupId&&!g.absent) memberEntries.push({pid:String(p.id),g});});});
    const existingGuests=(weeklyGuests[wk]||[]).filter(g=>g.gameId===addPlayerGroupId);
    const newGroupSize=memberEntries.length+existingGuests.length+1;
    const gameIdCounts={};
    players.forEach(p=>{(weeklyGames[p.id]?.[wk]||[]).forEach(g=>{if(!g.absent&&g.gameId) gameIdCounts[g.gameId]=(gameIdCounts[g.gameId]||0)+1;});});
    (weeklyGuests[wk]||[]).forEach(g=>{if(g.gameId) gameIdCounts[g.gameId]=(gameIdCounts[g.gameId]||0)+1;});
    gameIdCounts[addPlayerGroupId]=newGroupSize;
    const maxGs=Math.max(1,...Object.values(gameIdCounts));
    const nwg={...weeklyGames};
    memberEntries.forEach(({pid,g})=>{
      const newPos=g.position>=insertPos?g.position+1:g.position;
      nwg[pid]={...(nwg[pid]||{}),[wk]:(nwg[pid]?.[wk]||[]).map(gg=>{
        if(gg.gameId===addPlayerGroupId) return {...gg,position:newPos,groupSize:maxGs,pts:calcPoints(newPos,maxGs)};
        if(!gg.absent&&gg.gameId) return {...gg,groupSize:maxGs,pts:calcPoints(gg.position,maxGs)};
        return gg;
      })};
    });
    const ref=memberEntries[0]?.g||existingGuests[0]||{};
    const updatedGuests=(weeklyGuests[wk]||[]).map(g=>{
      if(g.gameId===addPlayerGroupId){
        const newPos=g.position>=insertPos?g.position+1:g.position;
        return {...g,position:newPos,groupSize:maxGs,pts:calcPoints(newPos,maxGs)};
      }
      if(g.gameId) return {...g,groupSize:maxGs,pts:calcPoints(g.position,maxGs)};
      return g;
    });
    updatedGuests.push({gameId:addPlayerGroupId,guestName:addGuestName||"Guest",position:insertPos,
      groupSize:maxGs,actualGroupSize:newGroupSize,pts:calcPoints(insertPos,maxGs),
      gameRound:ref.gameRound||1,label:ref.label||"Gp 1",venue:ref.venue||"",date:ref.date||""});
    update({weeklyGames:nwg,weeklyGuests:{...weeklyGuests,[wk]:updatedGuests}});
    setAddPlayerModal(null);setAddPlayerPid("");setAddPlayerGroupId("");setAddPlayerPos("");setAddPlayerSotd(0);setAddIsGuest(false);setAddGuestName("");
    notify("Guest added!");
  };
  const toggleChart=id=>setChartPlayers(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]);

  const curSignupWk=appState.nextMatchWeek||1;
  const curSignup=weekSignups[curSignupWk]||{open:false,signups:[],waitlist:[],groups:null,published:false};

  const generateGroups=()=>{
    const ids=[...(curSignup.signups||[])].map(String).sort(()=>Math.random()-0.5);
    const numGroups=Math.max(1,Math.ceil(ids.length/8));
    const grps=Array.from({length:numGroups},()=>[]);
    ids.forEach((id,i)=>grps[i%numGroups].push(id));
    const newPG={week:curSignupWk,groups:grps,published:false};
    update({weekSignups:{...weekSignups,[curSignupWk]:{...curSignup,groups:grps,published:false}},publishedGroups:newPG});
    updateDoc(LEAGUE_DOC,{[`weekSignups.${curSignupWk}.groups`]:grps,[`weekSignups.${curSignupWk}.published`]:false,publishedGroups:newPG}).catch(e=>console.error("Generate groups save failed:",e));
    notify("Groups randomised!");
  };

  const publishGroups=()=>{
    const grps=curSignup.groups||[];
    const newPG={week:curSignupWk,groups:grps,published:true};
    update({weekSignups:{...weekSignups,[curSignupWk]:{...curSignup,published:true}},publishedGroups:newPG});
    updateDoc(LEAGUE_DOC,{[`weekSignups.${curSignupWk}.published`]:true,publishedGroups:newPG}).catch(e=>console.error("Publish save failed:",e));
    notify("Groups published!");
  };

  const inputSt={background:C.surface,border:`1px solid ${C.border}`,borderRadius:"6px",color:C.text,padding:"8px 10px",fontSize:"0.85rem",fontFamily:"Georgia,serif",outline:"none",width:"100%",boxSizing:"border-box"};
  const textareaSt={...inputSt,resize:"vertical",minHeight:"70px",lineHeight:"1.5"};
  const btnSt=(col=C.accent,light=false)=>({background:`linear-gradient(135deg,${col},${col}bb)`,border:"none",borderRadius:"6px",color:light?C.text:C.bg,padding:"9px 16px",fontFamily:"Georgia,serif",fontSize:"0.84rem",fontWeight:"bold",cursor:"pointer",letterSpacing:"0.03em",whiteSpace:"nowrap"});
  const tabSt=t=>({padding:"8px 10px",border:"none",cursor:"pointer",fontFamily:"Georgia,serif",fontSize:"0.72rem",letterSpacing:"0.03em",background:tab===t?C.accent:"transparent",color:tab===t?C.bg:C.muted,borderBottom:tab===t?`2px solid ${C.accent}`:"2px solid transparent",transition:"all 0.2s",fontWeight:tab===t?"bold":"normal",flexShrink:0});
  const cardSt={background:C.card,border:`1px solid ${C.border}`,borderRadius:"10px",padding:"14px"};
  const lbSt={color:C.muted,fontSize:"0.69rem",letterSpacing:"0.1em",display:"block",marginBottom:"5px"};

  const allTabs=[["standings","⚑ Standings"],["grid","📊 Scores"],["venues","📍 Venues"],["profile","👤 Profile"],
    ...(isAdmin?[["record","✦ Record"],["history","◷ History"],["players","✤ Players"],["admin","⚙ Admin"]]:[]),
    ["logo","🏆 League Honours"],
    ...(user?.role==="superadmin"?[["dues","💰 Dues"]]:[]),
  ];

  return (
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"Georgia,serif",color:C.text}}>

      {editModal&&isAdmin&&(()=>{
        const{pid,week,gameIdx,game}=editModal;
        const pName=players.find(x=>x.id===pid)?.name||"";
        return(
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.78)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}}>
            <div style={{...cardSt,maxWidth:"380px",width:"100%",background:C.surface,border:`1px solid ${C.accent}55`}}>
              <h3 style={{color:C.cream,margin:"0 0 4px",fontSize:"1rem"}}>Edit Entry</h3>
              <p style={{color:C.muted,fontSize:"0.78rem",margin:"0 0 18px"}}>{pName} · Week {week} · {game.label}</p>
              {!game.absent&&<div style={{marginBottom:"14px"}}><label style={lbSt}>POSITION (group of {game.groupSize})</label><select style={inputSt} value={editPos} onChange={e=>setEditPos(e.target.value)}><option value="">Select…</option>{Array.from({length:game.groupSize},(_,i)=>i+1).map(n=><option key={n} value={n}>{n}{n===1?"st":n===2?"nd":n===3?"rd":"th"} → {calcPoints(n,game.groupSize)} pts</option>)}</select></div>}
              <div style={{marginBottom:"20px"}}><label style={lbSt}>SHOT OF THE DAY POINTS</label><input style={inputSt} type="number" min="0" max="10" value={editSotd} onChange={e=>setEditSotd(e.target.value)}/></div>
              <div style={{display:"flex",gap:"8px"}}>
                <button style={{...btnSt(),flex:1}} onClick={saveEdit}>Save</button>
                <button style={{...btnSt(C.red,true),flex:1}} onClick={()=>deleteGame(pid,week,gameIdx)}>Remove Player</button>
                <button style={{background:"none",border:`1px solid ${C.border}`,color:C.muted,borderRadius:"6px",padding:"9px 12px",cursor:"pointer",fontFamily:"Georgia,serif",fontSize:"0.84rem"}} onClick={()=>setEditModal(null)}>Cancel</button>
              </div>
            </div>
          </div>
        );
      })()}

      {addPlayerModal&&isAdmin&&(()=>{
        const wk=parseInt(addPlayerModal.week);
        const weekGroups={};
        players.forEach(p=>{(weeklyGames[p.id]?.[wk]||[]).forEach(g=>{
          if(!g.absent&&g.gameId){
            if(!weekGroups[g.gameId]) weekGroups[g.gameId]={gameId:g.gameId,label:g.label,size:0,gameRound:g.gameRound||1};
            weekGroups[g.gameId].size++;
          }
        });});
        const groupList=Object.values(weekGroups).sort((a,b)=>a.gameRound-b.gameRound||a.label.localeCompare(b.label));
        const hasMultipleRounds=new Set(groupList.map(g=>g.gameRound)).size>1;
        const alreadyInGroup=addPlayerGroupId?new Set(players.filter(p=>(weeklyGames[p.id]?.[wk]||[]).some(g=>!g.absent&&g.gameId===addPlayerGroupId)).map(p=>String(p.id))):new Set();
        const available=players.filter(p=>!alreadyInGroup.has(String(p.id))&&!suspendedPlayers.includes(String(p.id)));
        const selGroup=groupList.find(g=>g.gameId===addPlayerGroupId);
        const maxPos=selGroup?selGroup.size+1:1;
        return(
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.78)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}}>
            <div style={{...cardSt,maxWidth:"380px",width:"100%",background:C.surface,border:`1px solid ${addIsGuest?C.accent:C.green}55`}}>
              <h3 style={{color:C.cream,margin:"0 0 4px",fontSize:"1rem"}}>➕ Add to Game · Week {wk}</h3>
              <div style={{display:"flex",gap:"6px",marginBottom:"18px"}}>
                <button onClick={()=>{setAddIsGuest(false);setAddGuestName("");}} style={{flex:1,padding:"7px",borderRadius:"6px",border:`1px solid ${!addIsGuest?C.green:C.border}`,background:!addIsGuest?C.green+"22":"transparent",color:!addIsGuest?C.greenLight:C.muted,cursor:"pointer",fontFamily:"Georgia,serif",fontSize:"0.78rem",fontWeight:!addIsGuest?"bold":"normal"}}>Member</button>
                <button onClick={()=>{setAddIsGuest(true);setAddPlayerPid("");}} style={{flex:1,padding:"7px",borderRadius:"6px",border:`1px solid ${addIsGuest?C.accent:C.border}`,background:addIsGuest?C.accent+"22":"transparent",color:addIsGuest?C.accentLight:C.muted,cursor:"pointer",fontFamily:"Georgia,serif",fontSize:"0.78rem",fontWeight:addIsGuest?"bold":"normal"}}>Guest</button>
              </div>
              {!addIsGuest?(
                <div style={{marginBottom:"14px"}}>
                  <label style={lbSt}>PLAYER</label>
                  <select style={inputSt} value={addPlayerPid} onChange={e=>setAddPlayerPid(e.target.value)}>
                    <option value="">Select player…</option>
                    {available.map(p=><option key={p.id} value={String(p.id)}>{p.name}</option>)}
                  </select>
                  {addPlayerGroupId&&available.length===0&&<p style={{color:C.muted,fontSize:"0.72rem",margin:"4px 0 0"}}>All players are already in this group.</p>}
                </div>
              ):(
                <div style={{marginBottom:"14px"}}>
                  <label style={lbSt}>GUEST NAME (optional)</label>
                  <input style={inputSt} value={addGuestName} onChange={e=>setAddGuestName(e.target.value)} placeholder="e.g. Guest – Mike"/>
                </div>
              )}
              <div style={{marginBottom:"14px"}}>
                <label style={lbSt}>GROUP</label>
                <select style={inputSt} value={addPlayerGroupId} onChange={e=>{setAddPlayerGroupId(e.target.value);setAddPlayerPos("");}}>
                  <option value="">Select group…</option>
                  {groupList.map(g=><option key={g.gameId} value={g.gameId}>{hasMultipleRounds?`Game ${g.gameRound} · `:""}{g.label} ({g.size} players)</option>)}
                </select>
              </div>
              {addPlayerGroupId&&(
                <div style={{marginBottom:addIsGuest?"20px":"14px"}}>
                  <label style={lbSt}>FINISHING POSITION (others shift down)</label>
                  <select style={inputSt} value={addPlayerPos} onChange={e=>setAddPlayerPos(e.target.value)}>
                    <option value="">Select position…</option>
                    {Array.from({length:maxPos},(_,i)=>i+1).map(n=><option key={n} value={n}>{n}{n===1?"st":n===2?"nd":n===3?"rd":"th"}</option>)}
                  </select>
                </div>
              )}
              {!addIsGuest&&(
                <div style={{marginBottom:"16px"}}>
                  <label style={lbSt}>SHOT OF THE DAY (+1 pt bonus)</label>
                  <input style={inputSt} type="number" min="0" max="10" value={addPlayerSotd} onChange={e=>setAddPlayerSotd(e.target.value)} placeholder="0"/>
                </div>
              )}
              <div style={{display:"flex",gap:"8px"}}>
                {addIsGuest
                  ?<button style={{...btnSt(C.accent),flex:1}} onClick={addGuestRetroactively} disabled={!addPlayerGroupId||!addPlayerPos}>Add Guest</button>
                  :<button style={{...btnSt(C.green,true),flex:1}} onClick={addMissedPlayer} disabled={!addPlayerPid||!addPlayerGroupId||!addPlayerPos}>Add Player</button>
                }
                <button style={{background:"none",border:`1px solid ${C.border}`,color:C.muted,borderRadius:"6px",padding:"9px 12px",cursor:"pointer",fontFamily:"Georgia,serif",fontSize:"0.84rem"}} onClick={()=>{setAddPlayerModal(null);setAddIsGuest(false);setAddGuestName("");}}>Cancel</button>
              </div>
            </div>
          </div>
        );
      })()}

      {editVenue&&isAdmin&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.78)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}}>
          <div style={{...cardSt,maxWidth:"420px",width:"100%",background:C.surface,border:`1px solid ${C.accent}55`}}>
            <h3 style={{color:C.cream,margin:"0 0 18px",fontSize:"1rem"}}>Edit Venue</h3>
            <div style={{marginBottom:"14px"}}><label style={lbSt}>VENUE NAME</label><input style={inputSt} value={editVenue.name} onChange={e=>setEditVenue(v=>({...v,name:e.target.value}))}/></div>
            <div style={{marginBottom:"14px"}}><label style={lbSt}>OFFICIAL RATING</label><StarRating value={editVenue.rating} onChange={r=>setEditVenue(v=>({...v,rating:r}))} size={28}/></div>
            <div style={{marginBottom:"14px"}}><label style={lbSt}>OFFICIAL NOTES</label><textarea style={textareaSt} value={editVenue.comment} onChange={e=>setEditVenue(v=>({...v,comment:e.target.value}))} placeholder="Notes about the venue…"/></div>
            <div style={{marginBottom:"20px",display:"flex",alignItems:"center",gap:"10px"}}>
              <input type="checkbox" id="editVenueGrill" checked={editVenue.hasGrill||false} onChange={e=>setEditVenue(v=>({...v,hasGrill:e.target.checked}))} style={{width:"18px",height:"18px",cursor:"pointer",accentColor:C.accent}}/>
              <label htmlFor="editVenueGrill" style={{color:C.cream,fontSize:"0.85rem",cursor:"pointer"}}>🔥 Has grills / BBQ facilities</label>
            </div>
            <div style={{display:"flex",gap:"8px"}}>
              <button style={{...btnSt(),flex:1}} onClick={saveVenueEdit}>Save Changes</button>
              <button style={{background:"none",border:`1px solid ${C.border}`,color:C.muted,borderRadius:"6px",padding:"9px 14px",cursor:"pointer",fontFamily:"Georgia,serif",fontSize:"0.84rem"}} onClick={()=>setEditVenue(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {reviewVenue&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.78)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}}>
          <div style={{...cardSt,maxWidth:"420px",width:"100%",background:C.surface,border:`1px solid ${C.green}55`}}>
            <h3 style={{color:C.cream,margin:"0 0 4px",fontSize:"1rem"}}>Rate Venue</h3>
            <p style={{color:C.muted,fontSize:"0.78rem",margin:"0 0 20px"}}>{reviewVenue.name} · reviewing as <strong style={{color:C.accentLight}}>{user.name}</strong></p>
            <div style={{marginBottom:"16px"}}><label style={lbSt}>YOUR RATING</label><StarRating value={reviewForm.rating} onChange={r=>setReviewForm(f=>({...f,rating:r}))} size={32}/></div>
            <div style={{marginBottom:"20px"}}><label style={lbSt}>YOUR COMMENTS (optional)</label><textarea style={{...textareaSt,minHeight:"90px"}} value={reviewForm.comment} onChange={e=>setReviewForm(f=>({...f,comment:e.target.value}))} placeholder="What did you think?"/></div>
            <div style={{display:"flex",gap:"8px"}}>
              <button style={{...btnSt(C.green,true),flex:1}} onClick={submitReview}>Submit Review</button>
              <button style={{background:"none",border:`1px solid ${C.border}`,color:C.muted,borderRadius:"6px",padding:"9px 14px",cursor:"pointer",fontFamily:"Georgia,serif",fontSize:"0.84rem"}} onClick={()=>{setReviewVenue(null);setReviewForm({rating:0,comment:""});}}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER - mobile friendly */}
      <div style={{background:`linear-gradient(180deg,#060e06,${C.surface})`,borderBottom:`1px solid ${C.border}`}}>
        <div style={{maxWidth:"1020px",margin:"0 auto"}}>
          <div style={{display:"flex",alignItems:"center",gap:"10px",padding:"10px 12px",borderBottom:`1px solid ${C.border}22`,flexWrap:"wrap"}}>
            {/* Logo */}
            <div onClick={()=>isAdmin&&logoInputRef.current?.click()}
              onContextMenu={e=>{if(isAdmin){e.preventDefault();setShowPhotoPicker(true);}}}
              style={{width:"44px",height:"44px",borderRadius:"10px",border:`2px ${isAdmin?"dashed":"solid"} ${C.border}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:isAdmin?"pointer":"default",overflow:"hidden",flexShrink:0,background:C.surface,position:"relative"}}
              onMouseEnter={e=>{if(isAdmin){e.currentTarget.style.borderColor=C.accent;}}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;}}>
              {leagueLogo?<img src={leagueLogo} alt="logo" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontSize:"1.3rem",lineHeight:1}}>🔵</span>}
{isAdmin&&<>
  <label style={{position:"absolute",bottom:0,right:0,background:C.accent,borderRadius:"50%",width:"16px",height:"16px",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:"0.5rem"}}>📷<input type="file" accept="image/*" style={{display:"none"}} onChange={handleLogoUpload}/></label>
  <div onClick={e=>{e.stopPropagation();setShowPhotoPicker(true);}} style={{position:"absolute",top:0,left:0,right:0,bottom:0,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0)",borderRadius:"50%",cursor:"pointer"}} title="Choose from existing photos"/>
</>}
            </div>
            <input ref={logoInputRef} type="file" accept="image/*" style={{display:"none"}} onChange={handleLogoUpload}/>
            {/* Title */}
            <div style={{flex:1,minWidth:0}}>
              {editingName&&isAdmin?(
                <div style={{display:"flex",gap:"6px",alignItems:"center"}}>
                  <input style={{...inputSt,fontSize:"1rem",fontWeight:"bold",padding:"4px 8px",color:C.cream}} value={tempName} onChange={e=>setTempName(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){update({leagueName:tempName||leagueName});setEditingName(false);}if(e.key==="Escape")setEditingName(false);}} autoFocus/>
                  <button style={{...btnSt(),padding:"4px 10px",fontSize:"0.75rem"}} onClick={()=>{update({leagueName:tempName||leagueName});setEditingName(false);}}>Save</button>
                </div>
              ):(
                <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
                  <h1 style={{margin:0,fontSize:"1.1rem",fontWeight:"bold",color:C.cream,letterSpacing:"0.03em",lineHeight:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{leagueName}</h1>
                  {isAdmin&&<button onClick={()=>{setTempName(leagueName);setEditingName(true);}} style={{background:"none",border:`1px solid ${C.border}`,color:C.muted,borderRadius:"4px",padding:"2px 6px",cursor:"pointer",fontSize:"0.65rem",fontFamily:"Georgia,serif",flexShrink:0}}>✎</button>}
                </div>
              )}
              <p style={{margin:"2px 0 0",color:C.muted,fontSize:"0.68rem"}}>{players.length} players · Wk {maxWk} · {venues.length} venues{saving?" · 💾":""}</p>
            </div>
            {/* Right controls */}
            <div style={{display:"flex",alignItems:"center",gap:"6px",flexShrink:0}}>
              {isAdmin&&<button onClick={()=>update({totalWeeks:totalWeeks+1})} style={{...btnSt(C.green,true),padding:"6px 10px",fontSize:"0.72rem"}}>+Wk</button>}
              {isAdmin&&<div style={{display:"flex",gap:"4px",alignItems:"center"}}>
                <select value={appState.nextMatchWeek||1} onChange={e=>update({nextMatchWeek:parseInt(e.target.value)})} style={{background:C.surface,border:`1px solid ${C.accent}44`,borderRadius:"6px",color:C.accent,padding:"4px 6px",fontSize:"0.65rem",fontFamily:"Georgia,serif",cursor:"pointer"}}>
                  {Array.from({length:20},(_,i)=>i+1).map(w=><option key={w} value={w}>Wk {w}</option>)}
                </select>
                <select value={appState.nextVenueId||""} onChange={e=>update({nextVenueId:e.target.value?parseInt(e.target.value):null})} style={{background:C.surface,border:`1px solid ${C.accent}44`,borderRadius:"6px",color:C.accent,padding:"4px 6px",fontSize:"0.65rem",fontFamily:"Georgia,serif",cursor:"pointer"}}>
                  <option value="">📍 Set venue</option>
                  {venues.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>}
              <div style={{textAlign:"right"}}>
                <span style={{background:isAdmin?C.accent+"33":C.green+"22",border:`1px solid ${isAdmin?C.accent+"55":C.green+"44"}`,borderRadius:"12px",padding:"2px 7px",fontSize:"0.65rem",color:isAdmin?C.accentLight:C.greenLight,display:"block"}}>{isAdmin?"⚙ ADMIN":"👁 GUEST"}</span>
                <div style={{color:C.muted,fontSize:"0.65rem",marginTop:"1px"}}>{user.name}</div>
                <button onClick={onLogout} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:"0.62rem",fontFamily:"Georgia,serif",padding:0,textDecoration:"underline"}}>sign out</button>
              </div>
            </div>
          </div>
          {/* Tabs - scrollable on mobile */}
          <div style={{display:"flex",overflowX:"auto",padding:"0 8px",WebkitOverflowScrolling:"touch",scrollbarWidth:"none"}}>
            {allTabs.map(([k,l])=><button key={k} style={tabSt(k)} onClick={()=>setTab(k)}>{l}</button>)}
          </div>
        </div>
      </div>

      {note&&<div style={{background:C.accent,color:C.bg,textAlign:"center",padding:"8px",fontSize:"0.85rem",fontWeight:"bold"}}>{note}</div>}
      {showPhotoPicker&&<CloudinaryPicker appState={appState} onSelect={url=>update({leagueLogo:url})} onClose={()=>setShowPhotoPicker(false)}/>}
      

      <div style={{maxWidth:"1020px",margin:"0 auto",padding:"16px 10px"}}>

        {tab==="standings"&&(()=>{
          const sortedStandings=[...standings].sort((a,b)=>{
            if(standingsSort==="abs") return a.absences-b.absences;
            if(standingsSort==="mvp"){const aElig=a.weeksAttended>=2,bElig=b.weeksAttended>=2;if(!aElig&&!bElig)return 0;if(!aElig)return 1;if(!bElig)return -1;return parseFloat(b.mvp)-parseFloat(a.mvp);}
            if(standingsSort==="wins") return b.wins-a.wins;
            if(standingsSort==="sotd") return b.sotdTotal-a.sotdTotal;
            return b.pts-a.pts;
          });
          const metricVal=(p)=>{
            if(standingsMetric==="wins") return{val:p.wins,col:C.greenLight};
            if(standingsMetric==="mvp") return{val:p.mvp!=="—"?p.mvp+"%":"—",col:C.blue};
            if(standingsMetric==="sotd") return{val:p.sotdTotal,col:C.gold};
            if(standingsMetric==="abs") return{val:p.absences,col:C.muted};
            return{val:p.pts,col:C.accent};
          };
          const btnSt2=(active)=>({padding:"6px 0",borderRadius:"6px",border:`1px solid ${active?C.accent:C.cream}`,background:active?"#2a4a2a":"transparent",color:active?C.accentLight:C.cream,fontSize:"0.65rem",fontFamily:"Georgia,serif",cursor:"pointer",fontWeight:"bold",flex:1,textAlign:"center"});
          const pillSt=(active)=>({padding:"4px 10px",borderRadius:"12px",border:`1px solid ${active?C.accent:C.cream}`,background:active?"#2a4a2a":"transparent",color:active?C.accentLight:C.cream,fontSize:"0.62rem",fontFamily:"Georgia,serif",cursor:"pointer"});
          const minGamesForMvp=2;
          const buildMetricData=(key)=>Array.from({length:maxWk},(_,w)=>{
            const entry={week:`Wk ${w+1}`};
            players.filter(p=>chartPlayers.includes(p.id)).forEach(p=>{
              let cum=0;
              for(let ww=1;ww<=w+1;ww++){
                (weeklyGames[p.id]?.[ww]||[]).forEach(g=>{
                  if(key==="wins"&&!g.absent&&g.position===1) cum++;
                  if(key==="sotd") cum+=(g.sotd||0);
                });
              }
              entry[p.name]=cum;
            });
            return entry;
          });
          const PlayerRow=({p,i,showSwatch,showMvp=true})=>{
            const col=LINE_COLORS[standings.findIndex(x=>x.id===p.id)%LINE_COLORS.length];
            const on=chartPlayers.includes(p.id);
            const mv=metricVal(p);
            return(
              <div style={{display:"flex",alignItems:"center",gap:"7px",padding:"5px 8px",borderRadius:"7px",marginBottom:"3px",
                  border:"1px solid #252525",background:"#161616",cursor:"default"}}>
                <span style={{fontSize:"0.6rem",color:i===0?"#d4a843":"#666",minWidth:"16px",textAlign:"right",flexShrink:0}}>#{i+1}</span>
                {p.imageUrl
                  ? <img src={p.imageUrl} alt={p.name} style={{width:"28px",height:"28px",borderRadius:"50%",objectFit:"cover",border:"1.5px solid #444",flexShrink:0}}/>
                  : <div style={{width:"28px",height:"28px",borderRadius:"50%",background:"#2a2a2a",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.62rem",color:"#999",border:"1.5px solid #444",flexShrink:0}}>{p.name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()}</div>
                }
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:"5px",marginBottom:"2px"}}>
                    <span style={{fontSize:"0.76rem",color:"#e8dcc8",fontWeight:"bold",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.name}</span>
                    {p.sotdTotal>0&&<span style={{fontSize:"0.58rem",color:C.gold,flexShrink:0}}>⭐{p.sotdTotal}</span>}
                  </div>
                  <div style={{display:"flex",gap:"8px"}}>
                    {showMvp&&<span style={{fontSize:"0.6rem",color:C.blue}}>MVP {p.mvp}{p.mvp!=="—"?"%":""}</span>}
                    <span style={{fontSize:"0.6rem",color:C.greenLight}}>W{p.wins}</span>
                    <span style={{fontSize:"0.6rem",color:C.muted}}>Abs {p.absences}</span>
                  </div>
                </div>
                <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:"2px",flexShrink:0}}>
                  <span style={{fontSize:"0.85rem",fontWeight:"bold",color:mv.col,lineHeight:1}}>{mv.val}</span>
                  {showSwatch&&<div style={{width:"7px",height:"7px",borderRadius:"1px",background:on?col:"#555"}}/>}
                </div>
              </div>
            );
          };
          return(
            <div style={{display:"flex",flexDirection:"column",height:"calc(100vh - 120px)"}}>
              <div style={{display:"flex",gap:"6px",marginBottom:"8px"}}>
                <button style={btnSt2(standingsView==="list")} onClick={()=>setStandingsView("list")}>≡ Standings</button>
                <button style={btnSt2(standingsView==="chart")} onClick={()=>setStandingsView("chart")}>📈 Chart</button>
              </div>

              {(()=>{
                const lastWk=Math.max(0,...Object.values(weeklyGames).flatMap(wg=>Object.entries(wg).filter(([,gs])=>gs.some(g=>!g.absent)).map(([w])=>parseInt(w))));
                if(!lastWk) return null;
                const lastWkTotals=players.map(p=>{
                  const games=weeklyGames[p.id]?.[lastWk]||[];
                  const pts=games.reduce((s,g)=>s+(g.pts||0)+(g.sotd||0),0);
                  const absent=games.every(g=>g.absent);
                  return{id:String(p.id),name:p.name,imageUrl:p.imageUrl,pts,absent};
                }).filter(p=>!p.absent&&p.pts>0);
                const maxPts=Math.max(0,...lastWkTotals.map(p=>p.pts));
                const rawWinners=lastWkTotals.filter(p=>p.pts===maxPts);
                const tbId=weekTiebreakers?.[lastWk];
                const tbWinner=rawWinners.length>1&&tbId?rawWinners.find(w=>w.id===String(tbId)):null;
                const winners=tbWinner?[tbWinner]:rawWinners;
                // weekVenues override takes priority over game-entry venue
                const venueName=weekVenues?.[lastWk]||(()=>{
                  for(const p of players){
                    const gs=weeklyGames[p.id]?.[lastWk]||[];
                    const g=gs.find(g=>!g.absent&&g.venue);
                    if(g?.venue) return g.venue;
                  }
                  return null;
                })();
                const venueObj=venueName?venues.find(v=>v.name===venueName):null;
                if(!winners.length) return null;
                const isTie=winners.length>1;
                return(
                  <div style={{marginBottom:"10px",borderRadius:"10px",overflow:"hidden",border:`1px solid ${isTie?C.blue+"66":C.accent+"66"}`}}>
                    {venueObj?.imageUrl&&(
                      <div style={{position:"relative",height:"90px",overflow:"hidden"}}>
                        <img src={venueObj.imageUrl} alt={venueObj.name} style={{width:"100%",height:"100%",objectFit:"cover",display:"block",filter:"brightness(0.55)"}}/>
                        <div style={{position:"absolute",inset:0,background:"linear-gradient(to bottom,transparent 30%,#0e0e0e 100%)"}}/>
                        <div style={{position:"absolute",bottom:"8px",left:"12px",fontSize:"0.62rem",color:C.muted,letterSpacing:"0.08em"}}>{venueObj.name}</div>
                      </div>
                    )}
                    <div style={{padding:"10px 14px",background:isTie?"#0e101a":"#0e1a0e",display:"flex",alignItems:"center",gap:"10px"}}>
                      <span style={{fontSize:"1.2rem"}}>{isTie?"🤝":"🏆"}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:"0.6rem",color:C.muted,letterSpacing:"0.1em",marginBottom:"2px"}}>
                          {isTie?"WEEK "+lastWk+" — TIED":tbWinner?"WEEK "+lastWk+" WINNER (TB)":"WEEK "+lastWk+" WINNER"}
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:"6px",flexWrap:"wrap"}}>
                          {winners.map(w=>(
                            <div key={w.name} style={{display:"flex",alignItems:"center",gap:"5px"}}>
                              {w.imageUrl&&<img src={w.imageUrl} alt={w.name} style={{width:"20px",height:"20px",borderRadius:"50%",objectFit:"cover",border:`1.5px solid ${isTie?C.blue:C.accent}`}}/>}
                              <span style={{color:isTie?C.blue:C.accentLight,fontWeight:"bold",fontSize:"0.88rem"}}>{w.name}</span>
                            </div>
                          ))}
                          <span style={{color:C.muted,fontWeight:"normal",fontSize:"0.72rem"}}>· {maxPts} pts</span>
                        </div>
                        {!venueObj?.imageUrl&&venueName&&<div style={{fontSize:"0.6rem",color:C.muted,marginTop:"2px"}}>📍 {venueName}</div>}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {standingsView==="list"&&(
                <div style={{flex:1,overflowY:"auto",minHeight:0,scrollbarWidth:"none",msOverflowStyle:"none"}}>
                  <style>{`.no-scroll::-webkit-scrollbar{display:none}`}</style>
                  <div className="no-scroll" style={{display:"flex",gap:"5px",marginBottom:"8px",flexWrap:"wrap"}}>
                    {[["pts","Points"],["wins","Wins"],["mvp","MVP %"],["sotd","SOTD"],["abs","Absences"]].map(([k,label])=>(
                      <button key={k} style={pillSt(standingsSort===k)} onClick={()=>setStandingsSort(k)}>{label}</button>
                    ))}
                  </div>
                  {sortedStandings.map((p,i)=>{
                    const showMvp=p.weeksAttended>=minGamesForMvp;
                    return <PlayerRow key={p.id} p={p} i={i} showSwatch={false} showMvp={showMvp}/>;
                  })}
                  <p style={{color:C.muted,fontSize:"0.68rem",marginTop:"10px"}}>MVP % = total pts ÷ max possible pts (min 2 weeks played).</p>
                </div>
              )}

              {standingsView==="chart"&&(
                <div style={{flex:1,display:"flex",flexDirection:"column",minHeight:0}}>
                  <div style={{display:"flex",gap:"5px",marginBottom:"8px",flexWrap:"wrap",justifyContent:"center",alignItems:"center"}}>
                    {[["pts","Cumulative pts"],["wins","Wins"],["sotd","SOTD"]].map(([k,label])=>(
                      <button key={k} style={pillSt(standingsMetric===k)} onClick={()=>setStandingsMetric(k)}>{label}</button>
                    ))}
                    <button style={{...pillSt(false),borderColor:C.gold,color:C.gold,marginLeft:"6px"}} onClick={()=>{
                      const top5=standings.slice(0,5).map(p=>p.id);
                      const me=players.find(p=>p.name===user.name);
                      const ids=me&&!top5.includes(me.id)?[...top5,me.id]:top5;
                      setChartPlayers(ids);
                    }}>⭐ Top 5{players.find(p=>p.name===user.name)&&!standings.slice(0,5).some(p=>p.name===user.name)?" + Me":""}</button>
                  </div>
                  <div style={{width:"100%",minHeight:0,height:"260px"}}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={standingsMetric==="pts"?chartData:buildMetricData(standingsMetric)} margin={{top:4,right:8,left:0,bottom:0}}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                        <XAxis dataKey="week" tick={{fill:"#666",fontSize:8,fontFamily:"Georgia,serif"}} axisLine={{stroke:C.border}} tickLine={false}/>
                        <YAxis tick={{fill:"#666",fontSize:8,fontFamily:"Georgia,serif"}} axisLine={false} tickLine={false}/>
                        <Tooltip contentStyle={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"8px",fontFamily:"Georgia,serif",fontSize:"0.7rem"}} labelStyle={{color:C.cream,fontWeight:"bold"}}/>
                        {players.filter(p=>chartPlayers.includes(p.id)&&!suspendedPlayers.includes(String(p.id))).map(p=><Line key={p.id} type="monotone" dataKey={p.name} stroke={LINE_COLORS[players.findIndex(x=>x.id===p.id)%LINE_COLORS.length]} strokeWidth={1.5} dot={{r:0}} activeDot={{r:4}}/>)}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{display:"flex",gap:"4px",flexWrap:"wrap",padding:"8px 0",justifyContent:"center"}}>
                    {[...players].filter(p=>!suspendedPlayers.includes(String(p.id))).sort((a,b)=>a.name.localeCompare(b.name)).map((p)=>{const i=players.findIndex(x=>x.id===p.id),on=chartPlayers.includes(p.id),col=LINE_COLORS[i%LINE_COLORS.length];return<button key={p.id} onClick={()=>toggleChart(p.id)} style={{padding:"2px 8px",borderRadius:"10px",border:`1px solid ${on?col:C.cream}`,background:on?col+"22":"transparent",color:on?col:C.cream,fontSize:"0.58rem",fontFamily:"Georgia,serif",cursor:"pointer"}}>{p.name}</button>;})}
                  </div>
                </div>
              )}
            </div>
          );
        })()}

        

       

        {tab==="grid"&&(()=>{
          const ordinal=n=>n===1?"1st":n===2?"2nd":n===3?"3rd":`${n}th`;
          const selWk=gridSelWeek;
          const getRounds=(wk)=>{
            const rs=new Set();
            players.forEach(p=>{(weeklyGames[p.id]?.[wk]||[]).forEach(g=>{if(!g.absent) rs.add(g.gameRound||1);});});
            return Array.from(rs).sort();
          };
          const getGroups=(wk,round)=>{
            const grps={};
            players.forEach(p=>{
              (weeklyGames[p.id]?.[wk]||[]).forEach((g,gi)=>{
                if(g.absent) return;
                if((g.gameRound||1)!==round) return;
                if(!grps[g.gameId]) grps[g.gameId]={gameId:g.gameId,label:g.label,players:[]};
                grps[g.gameId].players.push({pid:p.id,name:p.name,gi,...g});
              });
            });
            (weeklyGuests[wk]||[]).forEach(g=>{
              if((g.gameRound||1)!==round) return;
              if(!grps[g.gameId]) grps[g.gameId]={gameId:g.gameId,label:g.label,players:[]};
              grps[g.gameId].players.push({pid:`guest-${g.guestName}`,name:g.guestName||"Guest",gi:-1,isGuest:true,...g});
            });
            return Object.values(grps).sort((a,b)=>a.label.localeCompare(b.label));
          };
          const saveGridPos=(pid,wk,gi,newPos,newSotd)=>{
            const entry=(weeklyGames[pid]?.[wk]||[])[gi];
            if(!entry) return;
            const newPts=newPos===entry.actualGroupSize?0:calcPoints(newPos,entry.groupSize);
            const nwg={...weeklyGames,[pid]:{...weeklyGames[pid],[wk]:(weeklyGames[pid][wk]||[]).map((g,i)=>i===gi?{...g,position:newPos,pts:newPts,sotd:parseInt(newSotd)||0}:g)}};
            update({weeklyGames:nwg}); setGridEditKey(null); notify("Position updated!");
          };
          const weeksWithData=Array.from({length:maxWk},(_,i)=>i+1).filter(wk=>players.some(p=>(weeklyGames[p.id]?.[wk]||[]).length>0));
          const absent=selWk?players.filter(p=>!(weeklyGames[p.id]?.[parseInt(selWk)]||[]).some(g=>!g.absent)):[];
          const rounds=selWk?getRounds(parseInt(selWk)):[];
          const getWeekLeaders=(wk)=>{
            const totals=players.map(p=>{
              const games=weeklyGames[p.id]?.[wk]||[];
              const pts=games.reduce((s,g)=>s+(g.pts||0)+(g.sotd||0),0);
              const absent=games.every(g=>g.absent);
              return{id:String(p.id),name:p.name,pts,absent};
            }).filter(p=>!p.absent&&p.pts>0);
            if(!totals.length) return[];
            const max=Math.max(...totals.map(p=>p.pts));
            return totals.filter(p=>p.pts===max);
          };
          const weekLeaders=selWk?getWeekLeaders(parseInt(selWk)):[];
          const selWkInt=parseInt(selWk)||0;
          const tbId=weekTiebreakers[selWkInt]||"";
          const tbWinner=weekLeaders.length>1&&tbId?weekLeaders.find(l=>l.id===String(tbId)):null;
          return(
            <div>
              <h2 style={{color:C.cream,fontSize:"1rem",letterSpacing:"0.06em",marginBottom:"12px",borderBottom:`1px solid ${C.border}`,paddingBottom:"8px"}}>Scores</h2>
              <select style={inputSt} value={selWk} onChange={e=>setGridSelWeek(e.target.value)}>
                <option value="">Select a week…</option>
                {weeksWithData.map(w=><option key={w} value={w}>Week {w}</option>)}
              </select>
              {selWk&&weekLeaders.length>0&&(
                <div style={{margin:"12px 0",padding:"10px 14px",background:weekLeaders.length>1&&!tbWinner?"#1a1a2e":"#1e2a0e",border:`1px solid ${weekLeaders.length>1&&!tbWinner?C.blue:C.accent}`,borderRadius:"8px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:isAdmin&&weekLeaders.length>1?"8px":"0"}}>
                    <span style={{fontSize:"1.2rem"}}>{weekLeaders.length>1&&!tbWinner?"🤝":"🏆"}</span>
                    <div>
                      <div style={{fontSize:"0.65rem",color:C.muted,letterSpacing:"0.1em",marginBottom:"2px"}}>{tbWinner?"WINNER (TB)":weekLeaders.length>1?"TIED — MOST POINTS":"MOST POINTS"}</div>
                      <div style={{color:weekLeaders.length>1&&!tbWinner?C.blue:C.accentLight,fontWeight:"bold",fontSize:"0.88rem"}}>
                        {(tbWinner?[tbWinner]:weekLeaders).map(l=>l.name).join(" & ")}
                        <span style={{color:C.muted,fontWeight:"normal",fontSize:"0.75rem"}}> · {weekLeaders[0].pts} pts</span>
                      </div>
                    </div>
                  </div>
                  {isAdmin&&weekLeaders.length>1&&(
                    <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                      <select value={tbId} onChange={e=>{const v=e.target.value;update({weekTiebreakers:{...weekTiebreakers,[selWkInt]:v||null}});}} style={{flex:1,background:C.surface,border:`1px solid ${C.border}`,borderRadius:"6px",color:C.text,padding:"5px 8px",fontSize:"0.78rem",fontFamily:"Georgia,serif"}}>
                        <option value="">— Set tiebreaker winner —</option>
                        {weekLeaders.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}
                      </select>
                      {tbId&&<button onClick={()=>update({weekTiebreakers:{...weekTiebreakers,[selWkInt]:null}})} style={{background:"none",border:`1px solid ${C.border}`,borderRadius:"5px",color:C.muted,padding:"5px 8px",cursor:"pointer",fontFamily:"Georgia,serif",fontSize:"0.72rem"}}>✕ Clear</button>}
                    </div>
                  )}
                </div>
              )}
              {selWk&&rounds.length===0&&<p style={{color:C.muted,marginTop:"12px"}}>No data for this week.</p>}
              {selWk&&rounds.map(round=>{
                const grps=getGroups(parseInt(selWk),round);
                return(
                  <div key={round} style={{marginTop:"16px"}}>
                    <div style={{color:C.accentLight,fontSize:"0.75rem",fontWeight:"bold",letterSpacing:"0.1em",marginBottom:"10px"}}>
                      {rounds.length>1?`GAME ${round}`:""}
                    </div>
                    <div style={{display:"flex",gap:"10px",flexWrap:"wrap"}}>
                      {grps.map(grp=>{
                        const sorted=[...grp.players].sort((a,b)=>a.position-b.position);
                        return(
                          <div key={grp.gameId} style={{...cardSt,flex:1,minWidth:"140px",padding:0,overflow:"hidden"}}>
                            <div style={{background:C.surface,padding:"7px 12px",fontSize:"0.72rem",fontWeight:"bold",
                              letterSpacing:"0.08em",color:C.muted,borderBottom:`1px solid ${C.border}`,
                              display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                              <span>{grp.label} · {sorted.length} players</span>
                              {isAdmin&&<button onClick={()=>{setAddPlayerModal({week:parseInt(selWk)});setAddPlayerGroupId(grp.gameId);setAddPlayerPid("");setAddPlayerPos("");}}
                                style={{background:"none",border:`1px solid ${C.green}`,color:C.green,borderRadius:"4px",padding:"2px 8px",cursor:"pointer",fontSize:"0.65rem",fontFamily:"Georgia,serif"}}>+ Add</button>}
                            </div>
                            {sorted.map(p=>{
                              const maxPosInGroup=Math.max(...sorted.map(x=>x.position));
                              const isFirst=p.position===1,isLast=p.position===maxPosInGroup;
                              const ekey=`${p.pid}-${selWk}-${p.gi}`;
                              const isEditing=gridEditKey===ekey;
                              return(
                                <div key={p.pid}>
                                  <div style={{display:"flex",alignItems:"center",gap:"8px",padding:"8px 12px",
                                    borderBottom:`1px solid ${C.border}`,
                                    background:isFirst?"#2a2200":isLast?"#1f0f0f":C.card}}>
                                    <span style={{fontSize:"0.72rem",fontWeight:"bold",minWidth:"28px",
                                      color:isFirst?C.gold:isLast?C.red:p.position===2?C.greenLight:C.muted}}>
                                      {ordinal(p.position)}
                                    </span>
                                    <span style={{flex:1,fontSize:"0.82rem",color:p.isGuest?C.accentLight:C.cream,fontWeight:"bold"}}>
                                      {p.name}{p.isGuest&&<span style={{color:C.muted,fontSize:"0.68rem",fontWeight:"normal",marginLeft:"5px"}}>guest</span>}
                                    </span>
                                    {p.sotd>0&&<span style={{fontSize:"0.7rem"}}>⭐</span>}
                                    <span style={{fontSize:"0.78rem",color:C.accent,fontWeight:"bold"}}>{p.pts}pt</span>
                                    {isAdmin&&!p.isGuest&&<button onClick={()=>{setGridEditKey(isEditing?null:ekey);setGridEditPos(String(p.position));setGridEditSotd(p.sotd||0);}}
                                      style={{background:"none",border:`1px solid ${C.border}`,color:C.muted,borderRadius:"4px",
                                        padding:"1px 6px",cursor:"pointer",fontSize:"0.65rem",fontFamily:"Georgia,serif"}}>✎</button>}
                                  </div>
                                  {isEditing&&isAdmin&&(
                                    <div style={{background:C.surface,padding:"10px 12px",borderBottom:`1px solid ${C.border}`}}>
                                      <div style={{fontSize:"0.65rem",color:C.muted,marginBottom:"6px",letterSpacing:"0.06em"}}>CHANGE POSITION</div>
                                      <select style={{...inputSt,marginBottom:"8px"}} value={gridEditPos} onChange={e=>setGridEditPos(e.target.value)}>
                                        {Array.from({length:p.actualGroupSize||p.groupSize},(_,i)=>i+1).map(n=>(
                                          <option key={n} value={n}>{ordinal(n)}</option>
                                        ))}
                                      </select>
                                      <div style={{fontSize:"0.65rem",color:C.muted,marginBottom:"6px",letterSpacing:"0.06em"}}>SHOT OF THE DAY</div>
                                      <input type="number" min="0" max="10" style={{...inputSt,marginBottom:"8px"}} value={gridEditSotd} onChange={e=>setGridEditSotd(e.target.value)}/>
                                      <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
                                        <button onClick={()=>saveGridPos(p.pid,parseInt(selWk),p.gi,parseInt(gridEditPos),gridEditSotd)}
                                          style={{...btnSt(C.green,true),padding:"5px 14px",fontSize:"0.78rem"}}>Save</button>
                                        <button onClick={()=>setGridEditKey(null)}
                                          style={{background:"none",border:`1px solid ${C.border}`,color:C.muted,borderRadius:"5px",
                                            padding:"5px 10px",cursor:"pointer",fontFamily:"Georgia,serif",fontSize:"0.78rem"}}>Cancel</button>
                                        <button onClick={()=>{if(window.confirm(`Remove ${p.name} from this game? Positions will be recalculated.`)){deleteGame(p.pid,parseInt(selWk),p.gi);setGridEditKey(null);}}}
                                          style={{...btnSt(C.red,true),padding:"5px 10px",fontSize:"0.78rem",marginLeft:"auto"}}>✕ Remove</button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {selWk&&absent.length>0&&(
                <div style={{marginTop:"16px"}}>
                  <div style={{color:C.muted,fontSize:"0.75rem",fontWeight:"bold",letterSpacing:"0.1em",marginBottom:"8px"}}>ABSENT THIS WEEK</div>
                  <div style={{...cardSt,padding:0,overflow:"hidden"}}>
                    {absent.map(p=>(
                      <div key={p.id} style={{display:"flex",alignItems:"center",gap:"8px",padding:"8px 12px",borderBottom:`1px solid ${C.border}`}}>
                        <span style={{fontSize:"0.72rem",color:C.muted,minWidth:"28px"}}>—</span>
                        <span style={{flex:1,fontSize:"0.82rem",color:C.muted}}>{p.name}</span>
                        <span style={{fontSize:"0.78rem",color:C.muted}}>1pt</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div style={{display:"flex",gap:"12px",flexWrap:"wrap",marginTop:"16px"}}>
                {[{col:C.gold,label:"1st place"},{col:C.greenLight,label:"2nd place"},{col:C.red,label:"Last place"}].map(({col,label})=>(
                  <div key={label} style={{display:"flex",alignItems:"center",gap:"5px"}}>
                    <div style={{width:"10px",height:"10px",borderRadius:"2px",background:col+"22",border:`1px solid ${col}44`}}/>
                    <span style={{color:C.muted,fontSize:"0.65rem"}}>{label}</span>
                  </div>
                ))}
                <span style={{color:C.muted,fontSize:"0.65rem"}}>⭐ = Shot of the Day</span>
              </div>
            </div>
          );
        })()}
          
        {tab==="venues"&&(
          <div>
            <h2 style={{color:C.cream,fontSize:"1rem",letterSpacing:"0.06em",marginBottom:"16px",borderBottom:`1px solid ${C.border}`,paddingBottom:"8px"}}>📍 Venues</h2>
            <div style={{...cardSt,marginBottom:"20px",borderColor:C.green+"55"}}>
              <h3 style={{color:C.greenLight,fontSize:"0.85rem",letterSpacing:"0.06em",margin:"0 0 12px"}}>ADD NEW VENUE</h3>
              <div style={{marginBottom:"10px"}}><label style={lbSt}>VENUE NAME</label><input style={inputSt} placeholder="e.g. Riverside Park Lawn" value={venueForm.name} onChange={e=>setVenueForm(f=>({...f,name:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&addVenue()}/></div>
              <div style={{marginBottom:"10px"}}><label style={lbSt}>YOUR RATING</label><StarRating value={venueForm.rating} onChange={r=>setVenueForm(f=>({...f,rating:r}))} size={28}/></div>
              <div style={{marginBottom:"12px"}}><label style={lbSt}>YOUR COMMENTS</label><textarea style={textareaSt} placeholder="Surface quality, parking, facilities…" value={venueForm.comment} onChange={e=>setVenueForm(f=>({...f,comment:e.target.value}))}/></div>
              <div style={{marginBottom:"14px",display:"flex",alignItems:"center",gap:"10px"}}>
                <input type="checkbox" id="venueGrill" checked={venueForm.hasGrill||false} onChange={e=>setVenueForm(f=>({...f,hasGrill:e.target.checked}))} style={{width:"18px",height:"18px",cursor:"pointer",accentColor:C.accent}}/>
                <label htmlFor="venueGrill" style={{color:C.cream,fontSize:"0.85rem",cursor:"pointer"}}>🔥 Has grills / BBQ facilities</label>
              </div>
              <button style={{...btnSt(C.green,true),width:"100%",padding:"10px"}} onClick={addVenue}>Add Venue</button>
            </div>
            {sortedVenues.length===0&&<p style={{color:C.muted}}>No venues yet!</p>}
            {isAdmin&&totalWeeks>0&&(
              <div style={{...cardSt,marginBottom:"20px",borderColor:C.blue+"55"}}>
                <h3 style={{color:C.blue,fontSize:"0.85rem",letterSpacing:"0.06em",margin:"0 0 12px"}}>📅 CORRECT WEEK VENUE</h3>
                <div style={{display:"flex",gap:"8px",alignItems:"flex-end"}}>
                  <div style={{flex:"0 0 90px"}}>
                    <label style={lbSt}>WEEK</label>
                    <select value={venueWeekPick} onChange={e=>setVenueWeekPick(e.target.value)} style={{...inputSt,padding:"7px 8px"}}>
                      <option value="">—</option>
                      {Array.from({length:totalWeeks},(_,i)=>i+1).map(w=><option key={w} value={w}>Week {w}{weekVenues[w]?" ✓":""}</option>)}
                    </select>
                  </div>
                  <div style={{flex:1}}>
                    <label style={lbSt}>VENUE</label>
                    <select value={venueWeekPick?weekVenues[venueWeekPick]||"":"" } onChange={e=>{if(venueWeekPick){const v=e.target.value;update({weekVenues:{...weekVenues,[venueWeekPick]:v||undefined}});notify(v?`Week ${venueWeekPick} venue set to ${v}.`:`Week ${venueWeekPick} venue cleared.`);}}} style={{...inputSt,padding:"7px 8px"}}>
                      <option value="">— select venue —</option>
                      {venues.map(v=><option key={v.id} value={v.name}>{v.name}</option>)}
                    </select>
                  </div>
                </div>
                {venueWeekPick&&weekVenues[venueWeekPick]&&(
                  <div style={{marginTop:"8px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                    <span style={{color:C.muted,fontSize:"0.72rem"}}>Week {venueWeekPick}: <span style={{color:C.cream}}>{weekVenues[venueWeekPick]}</span></span>
                    <button onClick={()=>{const nv={...weekVenues};delete nv[venueWeekPick];update({weekVenues:nv});notify("Venue override cleared.");}} style={{background:"none",border:`1px solid ${C.border}`,borderRadius:"5px",color:C.muted,padding:"3px 8px",cursor:"pointer",fontFamily:"Georgia,serif",fontSize:"0.7rem"}}>✕ Clear</button>
                  </div>
                )}
              </div>
            )}
            <div style={{display:"flex",flexDirection:"column",gap:"14px"}}>
              {sortedVenues.map((v,i)=>{
                const reviews=v.reviews||[];
                const avgRating=v.avgRating||0;
                const displayRating=Math.round(avgRating*10)/10;
                const totalReviews=reviews.length+(v.rating>0?1:0);
                return(
                  <div key={v.id} style={{...cardSt,border:`1px solid ${i===0&&avgRating>0?C.gold+"44":C.border}`,background:i===0&&avgRating>0?`linear-gradient(135deg,#1e1a0a,#22200e)`:C.card}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"10px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:"8px",flex:1,minWidth:0}}>
                        {i===0&&avgRating>0&&<span style={{fontSize:"1rem"}}>🏆</span>}
                        {v.imageUrl
                          ? <img src={v.imageUrl} alt={v.name} style={{width:"40px",height:"40px",borderRadius:"6px",objectFit:"cover",flexShrink:0}}/>
                          : <div style={{width:"40px",height:"40px",borderRadius:"6px",background:C.border,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.2rem",flexShrink:0}}>📍</div>
                        }
                        <div style={{minWidth:0}}>
                          <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
                            <div style={{color:i===0&&avgRating>0?C.accentLight:C.cream,fontWeight:"bold",fontSize:"0.9rem",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v.name}</div>
                          </div>
                          <div style={{marginTop:"3px"}}>
                            {v.hasGrill===true
                              ? <span style={{color:C.accent,fontSize:"0.72rem"}}>🔥 Grills available</span>
                              : <span style={{color:C.muted,fontSize:"0.72rem"}}>🚫 No grills</span>
                            }
                          </div>
                          <div style={{display:"flex",alignItems:"center",gap:"6px",marginTop:"2px",flexWrap:"wrap"}}>
                            <StarRating value={Math.round(avgRating)} size={13}/>
                            <span style={{color:C.muted,fontSize:"0.7rem"}}>{avgRating>0?`${displayRating}/5`:"Unrated"}{totalReviews>0&&` · ${totalReviews}`}</span>
                          </div>
                          <label style={{fontSize:"0.68rem",color:C.muted,cursor:"pointer",textDecoration:"underline",display:"block",marginTop:"3px"}}>
                            {v.imageUrl ? "Change photo" : "Upload photo"}
                            <input type="file" accept="image/*" style={{display:"none"}} onChange={async e=>{
                              const file = e.target.files[0]; if(!file) return;
                              const url = await uploadImage(file);
                              update({venues:venues.map(vn=>vn.id===v.id?{...vn,imageUrl:url}:vn)});
                            }}/>
                          </label>
                        </div>
                      </div>
                      <div style={{display:"flex",flexDirection:"column",gap:"5px",marginLeft:"8px",flexShrink:0}}>
                        <button onClick={()=>{setReviewVenue(v);setReviewForm({rating:0,comment:""}); }} style={{...btnSt(C.green,true),padding:"5px 10px",fontSize:"0.72rem"}}>⭐ Review</button>
                        {isAdmin&&<>
                          <button onClick={()=>setEditVenue({...v})} style={{...btnSt(C.blue,true),padding:"5px 10px",fontSize:"0.72rem"}}>Edit</button>
                          <button onClick={()=>removeVenue(v.id)} style={{background:"none",border:`1px solid ${C.red}`,color:C.red,borderRadius:"5px",padding:"5px 8px",cursor:"pointer",fontSize:"0.72rem",fontFamily:"Georgia,serif"}}>Remove</button>
                        </>}
                      </div>
                    </div>
                    {v.comment&&(
                      <div style={{background:C.surface,borderRadius:"6px",padding:"8px 10px",borderLeft:`3px solid ${C.accent}55`,marginBottom:"10px"}}>
                        <p style={{margin:0,color:C.muted,fontSize:"0.78rem",lineHeight:"1.5",fontStyle:"italic"}}>"{v.comment}"</p>
                      </div>
                    )}
                    {reviews.length>0&&(
                      <div>
                        <button onClick={()=>setCollapsedReviews(prev=>({...prev,[v.id]:!prev[v.id]}))} style={{display:"flex",alignItems:"center",gap:"5px",background:"transparent",border:"none",cursor:"pointer",padding:"0",marginBottom:collapsedReviews[v.id]?"0":"6px"}}>
                          <span style={{color:C.muted,fontSize:"0.65rem",letterSpacing:"0.1em"}}>MEMBER REVIEWS ({reviews.length})</span>
                          <span style={{color:C.muted,fontSize:"0.6rem"}}>{collapsedReviews[v.id]?"▶":"▼"}</span>
                        </button>
                        {!collapsedReviews[v.id]&&(
                          <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
                            {reviews.map(r=>(
                              <div key={r.id} style={{background:C.surface,borderRadius:"6px",padding:"8px 10px",display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:"8px"}}>
                                <div style={{flex:1}}>
                                  <div style={{display:"flex",alignItems:"center",gap:"6px",marginBottom:"3px",flexWrap:"wrap"}}>
                                    <span style={{color:C.cream,fontSize:"0.8rem",fontWeight:"bold"}}>{r.author}</span>
                                    <StarRating value={r.rating} size={11}/>
                                    <span style={{color:C.muted,fontSize:"0.68rem"}}>{r.date}</span>
                                  </div>
                                  {r.comment&&<p style={{margin:0,color:C.muted,fontSize:"0.76rem",lineHeight:"1.4",fontStyle:"italic"}}>"{r.comment}"</p>}
                                </div>
                                {(isAdmin||r.author===user.name)&&(
                                  <button onClick={()=>deleteReview(v.id,r.id)} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:"0.75rem",fontFamily:"Georgia,serif",padding:"2px 4px",flexShrink:0}}>✕</button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {reviews.length===0&&!v.comment&&<p style={{margin:0,color:C.border,fontSize:"0.74rem",fontStyle:"italic"}}>No reviews yet — be the first!</p>}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {tab==="logo"&&(
          <div style={{maxWidth:"700px",margin:"0 auto",padding:"16px 10px"}}>
            <h2 style={{color:C.cream,fontSize:"1rem",letterSpacing:"0.06em",
              marginBottom:"16px",borderBottom:`1px solid ${C.border}`,paddingBottom:"8px"}}>
              🏆 League Honours
            </h2>
            <LeagueHonours
              appState={appState}
              update={update}
              uploadImage={uploadImage}
              isAdmin={isAdmin}
              setLightbox={setLightbox}/>
          </div>
        )}

        {tab==="logo_old"&&(
          <div style={{maxWidth:"600px",margin:"0 auto",padding:"32px 16px",fontFamily:"Georgia,serif",overflowY:"auto"}}>

            <div style={{textAlign:"center",marginBottom:"36px"}}>
              <div style={{fontSize:"2.5rem",marginBottom:"8px"}}>🏆</div>
              <h2 style={{color:C.cream,fontSize:"1.4rem",letterSpacing:"0.08em",margin:"0 0 6px",fontWeight:"bold"}}>
                League Honours
              </h2>
              <p style={{color:C.muted,fontSize:"0.78rem",margin:0,letterSpacing:"0.06em"}}>
                Logo & motto winners by season
              </p>
            </div>

            {/* 2026 Season */}
            <div style={{color:C.accent,fontSize:"0.7rem",letterSpacing:"0.14em",marginBottom:"12px",textAlign:"center"}}>2026 SEASON</div>

            <div style={{...cardSt,border:`1px solid ${C.accent}55`,marginBottom:"14px",textAlign:"center"}}>
              <div style={{color:C.accent,fontSize:"0.65rem",letterSpacing:"0.12em",marginBottom:"12px"}}>OFFICIAL LEAGUE LOGO</div>
              <img
                src={LOGO_ENTRIES.find(e=>e.id==="l10")?.url}
                alt="2026 Logo"
                onClick={()=>setLightbox(LOGO_ENTRIES.find(e=>e.id==="l10")?.url)}
                style={{maxWidth:"240px",width:"100%",borderRadius:"10px",
                  border:`2px solid ${C.accent}`,cursor:"pointer",
                  boxShadow:"0 4px 24px rgba(0,0,0,0.5)",marginBottom:"12px"}}
              />
              <div style={{color:C.accentLight,fontSize:"0.95rem",fontWeight:"bold"}}>🥇 Steve D.</div>
              <div style={{color:C.muted,fontSize:"0.72rem",marginTop:"3px"}}>Logo design · 2026</div>
            </div>

            <div style={{...cardSt,border:`1px solid ${C.green}55`,marginBottom:"32px",textAlign:"center"}}>
              <div style={{color:C.greenLight,fontSize:"0.65rem",letterSpacing:"0.12em",marginBottom:"12px"}}>OFFICIAL LEAGUE MOTTO</div>
              <div style={{color:C.cream,fontSize:"1.2rem",fontStyle:"italic",lineHeight:"1.6",marginBottom:"12px"}}>
                "Nothing But a Mallet in the back<br/>and tinned fish in the front"
              </div>
              <div style={{color:C.greenLight,fontSize:"0.95rem",fontWeight:"bold"}}>🥇 Mark C.</div>
              <div style={{color:C.muted,fontSize:"0.72rem",marginTop:"3px"}}>Motto · 2026</div>
            </div>

            {/* 2025 Season */}
            <div style={{color:C.accent,fontSize:"0.7rem",letterSpacing:"0.14em",marginBottom:"12px",textAlign:"center"}}>2025 SEASON</div>

            <div style={{...cardSt,border:`1px solid ${C.accent}55`,marginBottom:"14px",textAlign:"center"}}>
              <div style={{color:C.accent,fontSize:"0.65rem",letterSpacing:"0.12em",marginBottom:"12px"}}>OFFICIAL LEAGUE LOGO</div>
              {appState.pastSeasons?.["2025"]?.logoUrl
                ? <img src={appState.pastSeasons["2025"].logoUrl} alt="2025 Logo"
                    onClick={()=>setLightbox(appState.pastSeasons["2025"].logoUrl)}
                    style={{maxWidth:"240px",width:"100%",borderRadius:"10px",
                      border:`2px solid ${C.accent}`,cursor:"pointer",
                      boxShadow:"0 4px 24px rgba(0,0,0,0.5)",marginBottom:"12px"}}/>
                : isAdmin
                  ? <label style={{display:"block",background:C.surface,border:`1px dashed ${C.border}`,
                      borderRadius:"8px",padding:"24px",cursor:"pointer",marginBottom:"12px",color:C.muted,fontSize:"0.78rem"}}>
                      📁 Upload 2025 logo
                      <input type="file" accept="image/*" style={{display:"none"}} onChange={async e=>{
                        const file=e.target.files[0]; if(!file) return;
                        const url=await uploadImage(file);
                        update({pastSeasons:{...appState.pastSeasons,["2025"]:{...(appState.pastSeasons?.["2025"]||{}),logoUrl:url}}});
                        notify("2025 logo uploaded!");
                      }}/>
                    </label>
                  : <div style={{color:C.border,fontSize:"0.78rem",padding:"20px",fontStyle:"italic"}}>Coming soon</div>
              }
              {appState.pastSeasons?.["2025"]?.logoWinner
                ? <div style={{color:C.accentLight,fontSize:"0.95rem",fontWeight:"bold"}}>🥇 {appState.pastSeasons["2025"].logoWinner}</div>
                : isAdmin && <input placeholder="Logo winner name…"
                    style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:"6px",
                      padding:"6px 10px",color:C.text,fontSize:"0.82rem",fontFamily:"Georgia,serif",
                      width:"100%",boxSizing:"border-box",textAlign:"center",outline:"none"}}
                    onBlur={e=>{if(e.target.value.trim())
                      update({pastSeasons:{...appState.pastSeasons,["2025"]:{...(appState.pastSeasons?.["2025"]||{}),logoWinner:e.target.value.trim()}}});
                    }}/>
              }
            </div>

            <div style={{...cardSt,border:`1px solid ${C.green}55`,marginBottom:"14px",textAlign:"center"}}>
              <div style={{color:C.greenLight,fontSize:"0.65rem",letterSpacing:"0.12em",marginBottom:"12px"}}>OFFICIAL LEAGUE MOTTO</div>
              {appState.pastSeasons?.["2025"]?.motto
                ? <div style={{color:C.cream,fontSize:"1.2rem",fontStyle:"italic",lineHeight:"1.6",marginBottom:"12px"}}>
                    "{appState.pastSeasons["2025"].motto}"
                  </div>
                : isAdmin && <textarea placeholder="Enter 2025 motto…"
                    style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:"6px",
                      padding:"8px 10px",color:C.text,fontSize:"0.85rem",fontFamily:"Georgia,serif",
                      width:"100%",boxSizing:"border-box",resize:"vertical",minHeight:"60px",outline:"none"}}
                    onBlur={e=>{if(e.target.value.trim())
                      update({pastSeasons:{...appState.pastSeasons,["2025"]:{...(appState.pastSeasons?.["2025"]||{}),motto:e.target.value.trim()}}});
                    }}/>
              }
              {appState.pastSeasons?.["2025"]?.mottoWinner
                ? <div style={{color:C.greenLight,fontSize:"0.95rem",fontWeight:"bold"}}>🥇 {appState.pastSeasons["2025"].mottoWinner}</div>
                : isAdmin && <input placeholder="Motto winner name…"
                    style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:"6px",
                      padding:"6px 10px",color:C.text,fontSize:"0.82rem",fontFamily:"Georgia,serif",
                      width:"100%",boxSizing:"border-box",textAlign:"center",outline:"none",marginTop:"8px"}}
                    onBlur={e=>{if(e.target.value.trim())
                      update({pastSeasons:{...appState.pastSeasons,["2025"]:{...(appState.pastSeasons?.["2025"]||{}),mottoWinner:e.target.value.trim()}}});
                    }}/>
              }
            </div>

          </div>
        )}

        {tab==="record"&&isAdmin&&(
          <div>
            <h2 style={{color:C.cream,fontSize:"1rem",letterSpacing:"0.06em",marginBottom:"12px",borderBottom:`1px solid ${C.border}`,paddingBottom:"8px"}}>Record Week Results</h2>

            <div style={{...cardSt,marginBottom:"12px"}}>
              <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
                <div><label style={lbSt}>WEEK #</label><select style={inputSt} value={gameWeek} onChange={e=>handleWeekChange(e.target.value)}>{weekOptions.map(w=><option key={w} value={w}>Week {w}</option>)}</select></div>
                <div><label style={lbSt}>GAME #</label><select style={inputSt} value={gameRound} onChange={e=>setGameRound(e.target.value)}><option value={1}>Game 1</option><option value={2}>Game 2</option><option value={3}>Game 3</option></select></div>
                <div><label style={lbSt}>📍 VENUE</label><select style={inputSt} value={gameVenue} onChange={e=>setGameVenue(e.target.value)}>{venues.map(v=><option key={v.id}>{v.name}</option>)}</select></div>
                <div><label style={lbSt}>DATE</label><input style={inputSt} type="date" value={gameDate} onChange={e=>setGameDate(e.target.value)}/></div>
              </div>
            </div>
            <div style={{...cardSt,marginBottom:"12px",background:C.surface}}>
              <p style={{margin:0,color:C.muted,fontSize:"0.75rem",lineHeight:"1.6"}}><strong style={{color:C.accentLight}}>Scoring:</strong> 1st = group size pts, last = 0. Absent players get 1 pt automatically.</p>
            </div>
            {absentPreview.length>0&&(
              <div style={{...cardSt,marginBottom:"12px",borderColor:C.red+"44",background:"#1a0f0f"}}>
                <div style={{display:"flex",alignItems:"center",gap:"6px",marginBottom:"6px"}}><span style={{color:C.red,fontSize:"0.8rem"}}>◌</span><span style={{color:C.red,fontSize:"0.78rem",fontWeight:"bold"}}>WILL BE MARKED ABSENT</span></div>
                <div style={{display:"flex",flexWrap:"wrap",gap:"5px"}}>{absentPreview.map(name=><span key={name} style={{background:C.red+"22",border:`1px solid ${C.red}44`,color:C.red,borderRadius:"4px",padding:"2px 8px",fontSize:"0.78rem"}}>{name}</span>)}</div>
              </div>
            )}
            {groups.map((grp,gi)=>{
              const allUsedIds=new Set(groups.flatMap(g=>g.players.map(r=>r.playerId)).filter(Boolean));
              const unselected=[...players].filter(p=>p.joinedWeek<=parseInt(gameWeek)&&!allUsedIds.has(String(p.id))&&!suspendedPlayers.includes(String(p.id))).sort((a,b)=>a.name.localeCompare(b.name));
              const ranked=grp.players.filter(r=>r.playerId);
              return(
              <div key={grp.id} style={{...cardSt,marginBottom:"10px"}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"12px"}}>
                  <span style={{color:C.accentLight,fontWeight:"bold",fontSize:"0.85rem"}}>Group {gi+1}</span>
                  {groups.length>1&&<button onClick={()=>removeGroup(grp.id)} style={{background:"none",border:`1px solid ${C.red}`,color:C.red,borderRadius:"4px",padding:"2px 8px",cursor:"pointer",fontSize:"0.72rem",fontFamily:"Georgia,serif"}}>Remove</button>}
                </div>

                {(unselected.length>0||true)&&(
                  <div style={{marginBottom:"12px"}}>
                    <div style={{color:C.muted,fontSize:"0.65rem",letterSpacing:"0.08em",marginBottom:"6px"}}>TAP TO ADD</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:"6px"}}>
                      {unselected.map(p=>(
                        <button key={p.id} onClick={()=>addRowToGroup(grp.id,String(p.id))}
                          style={{padding:"5px 14px",borderRadius:"20px",border:`1px solid ${C.border}`,
                            background:C.surface,cursor:"pointer",fontFamily:"Georgia,serif",
                            fontSize:"0.78rem",color:C.cream}}>
                          {p.name}
                        </button>
                      ))}
                      <button onClick={()=>handleGroupChange(prev=>prev.map(g=>g.id===grp.id?{...g,players:[...g.players,{isGuest:true,guestName:"",position:String(g.players.filter(r=>r.playerId||r.isGuest).length+1)}]}:g))}
                        style={{padding:"5px 14px",borderRadius:"20px",border:`1px solid ${C.accent}55`,
                          background:"transparent",cursor:"pointer",fontFamily:"Georgia,serif",
                          fontSize:"0.78rem",color:C.accentLight}}>
                        + Guest
                      </button>
                    </div>
                  </div>
                )}

                {ranked.length>0?(
                  <div>
                    <div style={{color:C.muted,fontSize:"0.65rem",letterSpacing:"0.08em",marginBottom:"6px"}}>FINISHING ORDER</div>
                    {ranked.map((row,ri)=>{
                      const p=players.find(x=>String(x.id)===String(row.playerId));
                      const pts=calcPoints(ri+1,ranked.length);
                      return(
                        <div key={ri} style={{display:"flex",alignItems:"center",gap:"8px",
                          background:C.surface,borderRadius:"8px",padding:"8px 10px",
                          marginBottom:"5px",border:`1px solid ${row.isGuest?C.accent+"44":C.border}`}}>
                          <span style={{color:C.accent,fontSize:"0.82rem",fontWeight:"bold",minWidth:"30px"}}>
                            {ri+1}{ri===0?"st":ri===1?"nd":ri===2?"rd":"th"}
                          </span>
                          {row.isGuest
                            ?<input value={row.guestName} onChange={e=>updateGroupRow(grp.id,grp.players.findIndex(r=>r===row),"guestName",e.target.value)}
                                placeholder="Guest name (optional)"
                                style={{...inputSt,flex:1,padding:"4px 8px",fontSize:"0.82rem",color:C.accentLight,background:C.bg}}/>
                            :<span style={{flex:1,color:C.cream,fontSize:"0.85rem"}}>{p?.name||row.playerId}</span>
                          }
                          <span style={{color:C.accent,fontWeight:"bold",fontSize:"0.8rem"}}>{pts}pt</span>
                          <div style={{display:"flex",flexDirection:"column",gap:"2px"}}>
                            <button disabled={ri===0} onClick={()=>{
                              const nl=[...ranked];[nl[ri],nl[ri-1]]=[nl[ri-1],nl[ri]];
                              const withPos=nl.map((r,i)=>({...r,position:String(i+1)}));
                              handleGroupChange(prev=>prev.map(g=>g.id===grp.id?{...g,players:withPos}:g));
                            }} style={{background:"none",border:`1px solid ${C.border}`,color:C.muted,borderRadius:"3px",padding:"0px 5px",cursor:"pointer",fontSize:"0.75rem",lineHeight:"1.5",opacity:ri===0?0.3:1}}>▲</button>
                            <button disabled={ri===ranked.length-1} onClick={()=>{
                              const nl=[...ranked];[nl[ri],nl[ri+1]]=[nl[ri+1],nl[ri]];
                              const withPos=nl.map((r,i)=>({...r,position:String(i+1)}));
                              handleGroupChange(prev=>prev.map(g=>g.id===grp.id?{...g,players:withPos}:g));
                            }} style={{background:"none",border:`1px solid ${C.border}`,color:C.muted,borderRadius:"3px",padding:"0px 5px",cursor:"pointer",fontSize:"0.75rem",lineHeight:"1.5",opacity:ri===ranked.length-1?0.3:1}}>▼</button>
                          </div>
                          <button onClick={()=>removeRowFromGroup(grp.id,grp.players.indexOf(row))}
                            style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:"1rem",padding:"2px"}}>✕</button>
                        </div>
                      );
                    })}
                  </div>
                ):(
                  <div style={{color:C.muted,fontSize:"0.78rem",fontStyle:"italic",padding:"4px 0"}}>Tap players above to add them</div>
                )}
              </div>
            );})}
            <button onClick={addGroup} style={{...btnSt(C.blue,true),marginBottom:"16px"}}>+ Add Group</button>
            <div style={{...cardSt,marginBottom:"16px",borderColor:C.gold+"55"}}>
              <div style={{display:"flex",alignItems:"center",gap:"6px",marginBottom:"10px"}}><span style={{fontSize:"1rem"}}>⭐</span><span style={{color:C.gold,fontWeight:"bold",fontSize:"0.85rem"}}>Shot of the Day</span><span style={{color:C.muted,fontSize:"0.72rem"}}>+1 bonus pt each</span></div>
              {sotdEntries.map((row,i)=>(
                <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 80px 26px",gap:"6px",marginBottom:"6px",alignItems:"center"}}>
                  <select style={inputSt} value={row.playerId} onChange={e=>updateSotdRow(i,"playerId",e.target.value)}><option value="">Player…</option>{players.filter(p=>!suspendedPlayers.includes(String(p.id))).map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
                  <input style={inputSt} type="number" min="1" max="10" value={row.count} onChange={e=>updateSotdRow(i,"count",e.target.value)} placeholder="# awards"/>
                  <button onClick={()=>removeSotdRow(i)} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:"1rem",padding:"2px"}}>✕</button>
                </div>
              ))}
              <button onClick={addSotdRow} style={{...btnSt(C.gold),padding:"6px 12px",fontSize:"0.75rem"}}>+ Add SOTD</button>
            </div>
            <button onClick={submitGames} style={{...btnSt(),padding:"12px",fontSize:"0.9rem",width:"100%"}}>Submit Week {gameWeek} Game {gameRound} Results</button>


          </div>
        )}

        {tab==="history"&&isAdmin&&(
          <div>
            <h2 style={{color:C.cream,fontSize:"1rem",letterSpacing:"0.06em",marginBottom:"12px",borderBottom:`1px solid ${C.border}`,paddingBottom:"8px"}}>Season Summary</h2>

            {(()=>{
              const colSet=new Set(), cols=[];
              players.forEach(p=>{
                Object.entries(weeklyGames[p.id]||{}).forEach(([wk,entries])=>{
                  entries.forEach(g=>{
                    const r=g.gameRound||1, key=`${wk}-${r}`;
                    if(!colSet.has(key)){colSet.add(key);cols.push({wk:parseInt(wk),round:r,key});}
                  });
                });
              });
              cols.sort((a,b)=>a.wk-b.wk||a.round-b.round);
              const wkGroups={};
              cols.forEach(c=>{if(!wkGroups[c.wk])wkGroups[c.wk]=[];wkGroups[c.wk].push(c);});
              const thSt={background:C.surface,borderRadius:"5px",padding:"5px 7px",fontSize:"0.62rem",
                color:C.muted,textAlign:"center",whiteSpace:"nowrap",minWidth:"40px",fontWeight:"normal"};
              const cellSt=(isWin,isLast)=>({
                borderRadius:"5px",padding:"4px 5px",textAlign:"center",minHeight:"34px",minWidth:"40px",
                display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:"1px",
                background:isWin?"#2a2200":isLast?"#1f0f0f":C.card,
                border:`1px solid ${C.border}`,
              });
              return(
                <div style={{overflowX:"auto",marginBottom:"20px"}}>
                  <table style={{borderCollapse:"separate",borderSpacing:"3px",minWidth:"100%"}}>
                    <thead>
                      <tr>
                        <th style={{...thSt,textAlign:"left",position:"sticky",left:0,zIndex:2,minWidth:"100px"}}>PLAYER</th>
                        {Object.entries(wkGroups).map(([wk,wcols])=>(
                          <th key={wk} colSpan={wcols.length} style={{padding:"0 3px 3px",verticalAlign:"bottom"}}>
                            <div style={{background:C.surface,borderRadius:"5px 5px 0 0",fontSize:"0.6rem",
                              letterSpacing:"0.08em",color:C.muted,padding:"3px 6px",textAlign:"center"}}>WK {wk}</div>
                          </th>
                        ))}
                        <th style={{...thSt,color:C.accent}}>TOT</th>
                        <th style={thSt}>🥇</th>
                        <th style={thSt}>⭐</th>
                        <th style={thSt}>ABS</th>
                      </tr>
                      <tr>
                        <th style={{...thSt,textAlign:"left",position:"sticky",left:0,zIndex:2}}></th>
                        {cols.map(col=>(
                          <th key={col.key} style={{padding:"0 3px 4px"}}>
                            <div style={{background:C.card,borderRadius:"0 0 5px 5px",fontSize:"0.56rem",
                              color:C.muted,padding:"2px 5px",textAlign:"center",borderTop:`1px solid ${C.border}`}}>
                              G{col.round}
                            </div>
                          </th>
                        ))}
                        <th/><th/><th/><th/>
                      </tr>
                    </thead>
                    <tbody>
                      {standings.map((p,ri)=>{
                        let wins=0,sotds=0,abs=0;
                        const medal=ri===0?"🥇":ri===1?"🥈":ri===2?"🥉":`${ri+1}.`;
                        return(
                          <tr key={p.id}>
                            <td style={{background:C.surface,borderRadius:"5px",padding:"6px 10px",
                              position:"sticky",left:0,zIndex:1,whiteSpace:"nowrap"}}>
                              <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
                                <span style={{fontSize:"0.78rem"}}>{medal}</span>
                                {p.imageUrl
                                  ?<img src={p.imageUrl} alt="" style={{width:"18px",height:"18px",borderRadius:"50%",objectFit:"cover",flexShrink:0}}/>
                                  :<div style={{width:"18px",height:"18px",borderRadius:"50%",background:C.border,flexShrink:0}}/>
                                }
                                <span style={{color:C.cream,fontSize:"0.78rem",fontWeight:"bold"}}>{p.name}</span>
                              </div>
                            </td>
                            {cols.map(col=>{
                              const entries=(weeklyGames[p.id]?.[col.wk]||[]).filter(g=>(g.gameRound||1)===col.round);
                              if(!entries.length){
                                abs++;
                                return(
                                  <td key={col.key} style={{padding:"2px"}}>
                                    <div style={cellSt(false,false)}>
                                      <span style={{color:C.muted,fontSize:"0.65rem"}}>—</span>
                                    </div>
                                  </td>
                                );
                              }
                              let wkPts=0,isWin=false,isLast=false,hasSotd=false;
                              const allAbsent=entries.every(g=>g.absent);
                              entries.forEach(g=>{
                                if(g.absent){abs++;return;}
                                wkPts+=g.pts+(g.sotd||0);
                                if(g.position===1)isWin=true;
                                if(g.position===(g.actualGroupSize||g.groupSize))isLast=true;
                                if(g.sotd>0)hasSotd=true;
                              });
                              if(allAbsent){
                                return(
                                  <td key={col.key} style={{padding:"2px"}}>
                                    <div style={cellSt(false,false)}>
                                      <span style={{color:C.muted,fontSize:"0.65rem"}}>—</span>
                                    </div>
                                  </td>
                                );
                              }
                              if(isWin)wins++;
                              if(hasSotd)sotds++;
                              return(
                                <td key={col.key} style={{padding:"2px"}}>
                                  <div style={cellSt(isWin,isLast)}>
                                    <span style={{fontSize:"0.72rem",fontWeight:"bold",
                                      color:isWin?C.gold:isLast?C.red:C.cream}}>{wkPts}pt</span>
                                    <span style={{fontSize:"0.58rem",lineHeight:1}}>
                                      {isWin?"🥇":isLast?"💀":""}{hasSotd?"⭐":""}
                                    </span>
                                  </div>
                                </td>
                              );
                            })}
                            <td style={{padding:"2px"}}>
                              <div style={{background:"#1e2a1e",borderRadius:"5px",padding:"4px",
                                textAlign:"center",minHeight:"34px",display:"flex",alignItems:"center",justifyContent:"center"}}>
                                <span style={{color:C.accent,fontWeight:"bold",fontSize:"0.82rem"}}>{p.pts}</span>
                              </div>
                            </td>
                            <td style={{padding:"2px"}}>
                              <div style={{background:C.surface,borderRadius:"5px",padding:"4px",
                                textAlign:"center",minHeight:"34px",display:"flex",alignItems:"center",justifyContent:"center"}}>
                                <span style={{color:C.gold,fontSize:"0.78rem"}}>{wins||"—"}</span>
                              </div>
                            </td>
                            <td style={{padding:"2px"}}>
                              <div style={{background:C.surface,borderRadius:"5px",padding:"4px",
                                textAlign:"center",minHeight:"34px",display:"flex",alignItems:"center",justifyContent:"center"}}>
                                <span style={{fontSize:"0.72px"}}>{sotds?"⭐".repeat(Math.min(sotds,3)):"—"}</span>
                              </div>
                            </td>
                            <td style={{padding:"2px"}}>
                              <div style={{background:C.surface,borderRadius:"5px",padding:"4px",
                                textAlign:"center",minHeight:"34px",display:"flex",alignItems:"center",justifyContent:"center"}}>
                                <span style={{color:C.muted,fontSize:"0.78rem"}}>{abs||"—"}</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}

            <div style={{display:"flex",gap:"10px",flexWrap:"wrap",marginBottom:"20px"}}>
              {[{col:C.gold,label:"1st place"},{col:C.red,label:"Last place"}].map(({col,label})=>(
                <div key={label} style={{display:"flex",alignItems:"center",gap:"5px"}}>
                  <div style={{width:"10px",height:"10px",borderRadius:"2px",background:col+"22",border:`1px solid ${col}44`}}/>
                  <span style={{color:C.muted,fontSize:"0.65rem"}}>{label}</span>
                </div>
              ))}
              <span style={{color:C.muted,fontSize:"0.65rem"}}>⭐ = Shot of the Day &nbsp;·&nbsp; — = absent</span>
            </div>
          </div>
        )}

        {tab==="admin"&&isAdmin&&(
          <div>
            <h2 style={{color:C.cream,fontSize:"1rem",letterSpacing:"0.06em",marginBottom:"16px",borderBottom:`1px solid ${C.border}`,paddingBottom:"8px"}}>⚙ Admin Tools</h2>

            {/* Sign-ups */}
            <div style={{...cardSt,marginBottom:"14px",borderColor:C.green+"44",background:"#0f1a0f"}}>
              <div style={{color:C.greenLight,fontSize:"0.78rem",fontWeight:"bold",letterSpacing:"0.06em",marginBottom:"10px"}}>🏑 WEEK {curSignupWk} SIGN-UPS</div>
              <div style={{display:"flex",gap:"8px",flexWrap:"wrap",marginBottom:"10px"}}>
                {!curSignup.open
                  ?<button onClick={()=>update({weekSignups:{...weekSignups,[curSignupWk]:{...curSignup,open:true}}})} style={{...btnSt(C.green,true),padding:"6px 14px",fontSize:"0.78rem"}}>Open sign-ups</button>
                  :<button onClick={()=>update({weekSignups:{...weekSignups,[curSignupWk]:{...curSignup,open:false}}})} style={{background:"none",border:`1px solid ${C.border}`,color:C.muted,borderRadius:"5px",padding:"6px 12px",cursor:"pointer",fontFamily:"Georgia,serif",fontSize:"0.78rem"}}>Close sign-ups</button>
                }
                {(curSignup.signups||[]).length>=2&&<button onClick={generateGroups} style={{...btnSt(C.blue,true),padding:"6px 14px",fontSize:"0.78rem"}}>⇄ Randomise groups</button>}
                {curSignup.groups&&!curSignup.published&&<button onClick={publishGroups} style={{...btnSt(C.accent),padding:"6px 14px",fontSize:"0.78rem"}}>✓ Publish groups</button>}
                {curSignup.published&&<button onClick={()=>{update({weekSignups:{...weekSignups,[curSignupWk]:{...curSignup,published:false}},publishedGroups:{week:curSignupWk,groups:curSignup.groups||[],published:false}});updateDoc(LEAGUE_DOC,{[`weekSignups.${curSignupWk}.published`]:false,"publishedGroups.published":false}).catch(e=>console.error(e));}} style={{background:"none",border:`1px solid ${C.border}`,color:C.muted,borderRadius:"5px",padding:"6px 12px",cursor:"pointer",fontFamily:"Georgia,serif",fontSize:"0.78rem"}}>Unpublish</button>}
              </div>
              {(curSignup.signups||[]).length>0&&(
                <>
                  <div style={{color:C.muted,fontSize:"0.72rem",marginBottom:"8px"}}>{(curSignup.signups||[]).length}/24 signed up{(curSignup.waitlist||[]).length>0&&` · ${curSignup.waitlist.length} waitlist`}</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:"5px",marginBottom:curSignup.groups?"10px":"0"}}>
                    {(curSignup.signups||[]).map(pid=>{const p=players.find(x=>String(x.id)===String(pid));return p?<span key={pid} style={{background:C.green+"22",border:`1px solid ${C.green}44`,color:C.greenLight,borderRadius:"12px",padding:"2px 10px",fontSize:"0.75rem"}}>✓ {p.name}</span>:null;})}
                    {(curSignup.waitlist||[]).map(pid=>{const p=players.find(x=>String(x.id)===String(pid));return p?<span key={pid} style={{background:C.accent+"22",border:`1px solid ${C.accent}44`,color:C.accentLight,borderRadius:"12px",padding:"2px 10px",fontSize:"0.75rem"}}>⏳ {p.name}</span>:null;})}
                  </div>
                </>
              )}
              {curSignup.groups&&(
                <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
                  {curSignup.groups.map((grp,gi)=>(
                    <div key={gi} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:"6px",padding:"8px 10px",flex:1,minWidth:"100px"}}>
                      <div style={{color:C.accentLight,fontSize:"0.68rem",fontWeight:"bold",marginBottom:"5px"}}>Group {gi+1}</div>
                      {grp.map(pid=>{const p=players.find(x=>String(x.id)===String(pid));return p?<div key={pid} style={{color:C.cream,fontSize:"0.75rem",padding:"2px 0"}}>{p.name}</div>:null;})}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Rain Out */}
            <div style={{...cardSt,marginBottom:"14px",borderColor:C.blue+"44",background:"#0a0f1a"}}>
              <div style={{color:C.blue,fontSize:"0.72rem",fontWeight:"bold",letterSpacing:"0.08em",marginBottom:"8px"}}>☔ RAIN OUT WEEK</div>
              <div style={{display:"flex",gap:"8px",alignItems:"center",flexWrap:"wrap"}}>
                <select id="rainOutWeekSel" style={inputSt} defaultValue="">
                  <option value="">Select week…</option>
                  {Array.from({length:maxWk+1},(_,i)=>i+1).map(w=><option key={w} value={w}>Week {w}</option>)}
                </select>
                <button onClick={()=>{
                  const sel=document.getElementById("rainOutWeekSel");
                  const wk=sel?.value; if(!wk){notify("Select a week first.");return;}
                  const nwg={...weeklyGames};
                  players.filter(p=>p.joinedWeek<=parseInt(wk)).forEach(p=>{
                    nwg[p.id]={...(nwg[p.id]||{}),[wk]:[{gameId:`rain-${wk}-${p.id}`,position:null,groupSize:null,pts:1,sotd:0,absent:true,label:"Rain Out"}]};
                  });
                  update({weeklyGames:nwg,totalWeeks:Math.max(totalWeeks,parseInt(wk))});
                  sel.value="";
                  notify(`Week ${wk} marked as rained out — everyone gets 1 pt!`);
                }} style={{...btnSt(C.blue,true),padding:"8px 14px",fontSize:"0.8rem"}}>Rain Out</button>
              </div>
              <p style={{color:C.muted,fontSize:"0.68rem",margin:"8px 0 0"}}>Marks all eligible players as absent with 1 point. Overwrites any existing data for that week.</p>
            </div>

            {/* Rebalance */}
            <div style={{...cardSt,marginBottom:"14px",borderColor:C.accent+"44",background:"#1a140a"}}>
              <div style={{color:C.accent,fontSize:"0.72rem",fontWeight:"bold",letterSpacing:"0.08em",marginBottom:"8px"}}>⚖ REBALANCE WEEK SCORES</div>
              <div style={{display:"flex",gap:"8px",alignItems:"center",flexWrap:"wrap"}}>
                <select id="rebalanceWeekSel" style={inputSt} defaultValue="">
                  <option value="">Select week to rebalance…</option>
                  {Array.from({length:maxWk},(_,i)=>i+1).map(w=><option key={w} value={w}>Week {w}</option>)}
                </select>
                <button onClick={()=>{
                  const sel=document.getElementById("rebalanceWeekSel");
                  const wk=sel?.value; if(!wk){notify("Select a week first.");return;}
                  const gameIdCounts={};
                  players.forEach(p=>{
                    (weeklyGames[p.id]?.[wk]||[]).forEach(g=>{
                      if(!g.absent&&g.gameId) gameIdCounts[g.gameId]=(gameIdCounts[g.gameId]||0)+1;
                    });
                  });
                  const maxGs=Math.max(1,...Object.values(gameIdCounts));
                  const gameIdMaxPos={};
                  players.forEach(p=>{(weeklyGames[p.id]?.[wk]||[]).forEach(g=>{if(!g.absent&&g.gameId&&g.position) gameIdMaxPos[g.gameId]=Math.max(gameIdMaxPos[g.gameId]||0,g.position);});});
                  const nwg={...weeklyGames};
                  players.forEach(p=>{
                    if(!(nwg[p.id]?.[wk])) return;
                    nwg[p.id]={...nwg[p.id],[wk]:nwg[p.id][wk].map(g=>{
                      if(g.absent||!g.position) return g;
                      return {...g,groupSize:maxGs,pts:g.position===gameIdMaxPos[g.gameId]?0:calcPoints(g.position,maxGs)};
                    })};
                  });
                  update({weeklyGames:nwg});
                  sel.value="";
                  notify(`Week ${wk} rebalanced to group size ${maxGs}!`);
                }} style={{...btnSt(C.accent),padding:"8px 14px",fontSize:"0.8rem"}}>Rebalance</button>
              </div>
              <p style={{color:C.muted,fontSize:"0.68rem",margin:"8px 0 0"}}>Recalculates all scores for a week so every group uses the largest group's size as the max points.</p>
            </div>

            {/* Delete Week */}
            <div style={{...cardSt,marginBottom:"14px",borderColor:C.red+"44",background:"#1a0f0f"}}>
              <div style={{color:C.red,fontSize:"0.72rem",fontWeight:"bold",letterSpacing:"0.08em",marginBottom:"8px"}}>⚠ DELETE WEEK DATA</div>
              <div style={{display:"flex",gap:"8px",alignItems:"center",flexWrap:"wrap"}}>
                <select id="deleteWeekSel" style={inputSt} defaultValue="">
                  <option value="">Select week to delete…</option>
                  {Array.from({length:maxWk},(_,i)=>i+1).map(w=><option key={w} value={w}>Week {w}</option>)}
                </select>
                <button onClick={()=>{
                  const sel=document.getElementById("deleteWeekSel");
                  const wk=sel?.value; if(!wk){notify("Select a week first.");return;}
                  const nwg={};
                  Object.entries(weeklyGames).forEach(([pid,weeks])=>{
                    nwg[pid]={...weeks};
                    delete nwg[pid][wk];
                  });
                  update({weeklyGames:nwg,totalWeeks:Math.max(1,...Object.values(nwg).flatMap(w=>Object.keys(w).map(Number)).filter(n=>!isNaN(n)))});
                  sel.value="";
                  notify(`Week ${wk} data deleted.`);
                }} style={{...btnSt(C.red,true),padding:"8px 14px",fontSize:"0.8rem"}}>Delete Week</button>
              </div>
              <p style={{color:C.muted,fontSize:"0.68rem",margin:"8px 0 0"}}>This removes all recorded scores for that week. Players will need to be re-recorded.</p>
            </div>

            {/* Announcement - superadmin only */}
            {user?.role==="superadmin"&&(
              <div style={{...cardSt,borderColor:C.accent+"44",background:"#1a1400"}}>
                <div style={{display:"flex",alignItems:"center",gap:"6px",marginBottom:"12px"}}>
                  <span style={{fontSize:"1rem"}}>📣</span>
                  <span style={{color:C.accentLight,fontWeight:"bold",fontSize:"0.85rem"}}>Login Screen Announcement</span>
                </div>
                <div style={{marginBottom:"10px"}}>
                  <label style={lbSt}>TITLE (optional)</label>
                  <input style={inputSt} value={announcement.title||""} placeholder="e.g. This week's venue change"
                    onChange={e=>update({announcement:{...announcement,title:e.target.value}})}/>
                </div>
                <div style={{marginBottom:"12px"}}>
                  <label style={lbSt}>MESSAGE</label>
                  <textarea style={textareaSt} value={announcement.body||""} placeholder="Write a message for all members to see on the login screen…"
                    onChange={e=>update({announcement:{...announcement,body:e.target.value}})}/>
                </div>
                <div style={{display:"flex",gap:"8px"}}>
                  <button style={{...btnSt(C.accent),flex:1}} onClick={()=>update({announcement:{...announcement}})}>Save Message</button>
                  {announcement.body&&<button style={{...btnSt(C.red,true)}} onClick={()=>update({announcement:{title:"",body:""}})}>Clear</button>}
                </div>
                {announcement.body&&<p style={{color:C.green,fontSize:"0.72rem",margin:"8px 0 0"}}>✓ Message is live on the login screen</p>}
              </div>
            )}

            {/* Push Notifications */}
            <div style={{borderTop:`1px solid ${C.border}`,paddingTop:"16px",marginTop:"8px"}}>
              <div style={{color:C.muted,fontSize:"0.65rem",letterSpacing:"0.1em",marginBottom:"12px"}}>PUSH NOTIFICATIONS</div>

              {/* Match Details notification */}
              <div style={{...cardSt,marginBottom:"14px",borderColor:C.green+"44",background:"#0a1a0f"}}>
                <div style={{color:C.greenLight,fontSize:"0.72rem",fontWeight:"bold",letterSpacing:"0.08em",marginBottom:"8px"}}>📅 MATCH DETAILS</div>
                <p style={{color:C.muted,fontSize:"0.68rem",margin:"0 0 10px",lineHeight:"1.5"}}>Sends next match date, time, and venue to all members. Add any extra notes below.</p>
                {(()=>{
                  const nextVenue=venues.find(v=>v.name===(appState.weekSignups?.[appState.nextMatchWeek||1]?.venue||venues[0]?.name))||venues[0];
                  const matchDate=appState.nextMatchDate||"TBD";
                  const matchTime=appState.nextMatchTime||"";
                  const matchWeek=appState.nextMatchWeek||1;
                  const sendMatchNotif=async()=>{
                    setMatchSending(true);
                    try{
                      const {collection,getDocs}=await import("firebase/firestore");
                      const {getFirestore}=await import("firebase/firestore");
                      const db2=getFirestore();
                      const snap=await getDocs(collection(db2,"pushSubscriptions"));
                      const subs=snap.docs.map(d=>d.data().subscription).filter(Boolean);
                      if(!subs.length){notify("No subscribers yet.");setMatchSending(false);return;}
                      const body=[nextVenue?.name,matchDate,matchTime,matchNote].filter(Boolean).join(" · ");
                      const res=await fetch("/.netlify/functions/send-push",{
                        method:"POST",headers:{"Content-Type":"application/json"},
                        body:JSON.stringify({subscriptions:subs,title:`🏑 Week ${matchWeek} – Match Details`,body,tag:"match-details"})
                      });
                      const data=await res.json();
                      const newPost={type:"match",title:`🏑 Week ${matchWeek} – Match Details`,body,sentAt:Date.now()};
                      update({loginPosts:[...(loginPosts||[]).slice(-4),newPost]});
                      notify(`Sent to ${data.sent} member${data.sent!==1?"s":""}!`);
                      setMatchNote("");
                    }catch(e){console.error(e);notify("Failed to send.");}
                    setMatchSending(false);
                  };
                  return(<>
                    <div style={{marginBottom:"10px"}}><label style={lbSt}>EXTRA NOTES (optional)</label><textarea style={textareaSt} value={matchNote} onChange={e=>setMatchNote(e.target.value)} placeholder="e.g. Meet at the east entrance, bring sunscreen"/></div>
                    <div style={{display:"flex",gap:"8px"}}>
                      <button style={{...btnSt(C.green,true),flex:1,padding:"9px",opacity:matchSending?0.6:1}} onClick={sendMatchNotif} disabled={matchSending}>{matchSending?"Sending…":"📤 Send to All Members"}</button>
                      {loginPosts.some(p=>p.type==="match")&&<button style={{...btnSt(C.red,true)}} onClick={()=>update({loginPosts:loginPosts.filter(p=>p.type!=="match")})}>Clear</button>}
                    </div>
                    {loginPosts.some(p=>p.type==="match")&&<p style={{color:C.green,fontSize:"0.72rem",margin:"6px 0 0"}}>✓ Match details visible on login screen</p>}
                  </>);
                })()}
              </div>

              {/* Week Results notification */}
              <div style={{...cardSt,marginBottom:"14px",borderColor:C.gold+"44",background:"#1a1400"}}>
                <div style={{color:C.gold,fontSize:"0.72rem",fontWeight:"bold",letterSpacing:"0.08em",marginBottom:"8px"}}>🏆 WEEK RESULTS</div>
                <p style={{color:C.muted,fontSize:"0.68rem",margin:"0 0 10px",lineHeight:"1.5"}}>Sends this week's winner and Shot of the Day to all members.</p>
                {(()=>{
                  const lastWk=Math.max(0,...Object.values(weeklyGames).flatMap(wg=>Object.keys(wg).map(Number)).filter(n=>!isNaN(n)));
                  if(!lastWk) return <p style={{color:C.muted,fontSize:"0.75rem"}}>No weeks recorded yet.</p>;
                  const totals=players.map(p=>{
                    const games=weeklyGames[p.id]?.[lastWk]||[];
                    const pts=games.reduce((s,g)=>s+(g.pts||0)+(g.sotd||0),0);
                    const absent=games.every(g=>g.absent);
                    const sotd=games.reduce((s,g)=>s+(g.sotd||0),0);
                    return{name:p.name,pts,absent,sotd};
                  }).filter(p=>!p.absent);
                  const maxPts=Math.max(0,...totals.map(p=>p.pts));
                  const winners=totals.filter(p=>p.pts===maxPts).map(p=>p.name);
                  const sotdPlayers=totals.filter(p=>p.sotd>0).map(p=>p.name);
                  const winnerStr=winners.join(" & ");
                  const sotdStr=sotdPlayers.length?sotdPlayers.join(" & "):"";
                  const sendResultsNotif=async()=>{
                    setResultsSending(true);
                    try{
                      const {collection,getDocs,getFirestore}=await import("firebase/firestore");
                      const db2=getFirestore();
                      const snap=await getDocs(collection(db2,"pushSubscriptions"));
                      const subs=snap.docs.map(d=>d.data().subscription).filter(Boolean);
                      if(!subs.length){notify("No subscribers yet.");setResultsSending(false);return;}
                      let body=`🥇 ${winnerStr} won Week ${lastWk} with ${maxPts} pts`;
                      if(sotdStr) body+=` · ⭐ Shot of the Day: ${sotdStr}`;
                      if(resultsNote) body+=` · ${resultsNote}`;
                      const res=await fetch("/.netlify/functions/send-push",{
                        method:"POST",headers:{"Content-Type":"application/json"},
                        body:JSON.stringify({subscriptions:subs,title:`🏑 Week ${lastWk} Results`,body,tag:"week-results"})
                      });
                      const data=await res.json();
                      const newPost={type:"results",title:`🏑 Week ${lastWk} Results`,body,sentAt:Date.now()};
                      update({loginPosts:[...(loginPosts||[]).slice(-4),newPost]});
                      notify(`Sent to ${data.sent} member${data.sent!==1?"s":""}!`);
                      setResultsNote("");
                    }catch(e){console.error(e);notify("Failed to send.");}
                    setResultsSending(false);
                  };
                  return(<>
                    <div style={{...cardSt,padding:"8px 12px",marginBottom:"10px",background:C.bg}}>
                      <div style={{color:C.cream,fontSize:"0.78rem",marginBottom:"3px"}}>🥇 <strong>{winnerStr}</strong> · {maxPts} pts</div>
                      {sotdStr&&<div style={{color:C.gold,fontSize:"0.75rem"}}>⭐ SOTD: {sotdStr}</div>}
                    </div>
                    <div style={{marginBottom:"10px"}}><label style={lbSt}>EXTRA NOTE (optional)</label><textarea style={textareaSt} value={resultsNote} onChange={e=>setResultsNote(e.target.value)} placeholder="e.g. Great game everyone, see you next week!"/></div>
                    <div style={{display:"flex",gap:"8px"}}>
                      <button style={{...btnSt(C.gold),flex:1,padding:"9px",opacity:resultsSending?0.6:1}} onClick={sendResultsNotif} disabled={resultsSending}>{resultsSending?"Sending…":"📤 Send to All Members"}</button>
                      {loginPosts.some(p=>p.type==="results")&&<button style={{...btnSt(C.red,true)}} onClick={()=>update({loginPosts:loginPosts.filter(p=>p.type!=="results")})}>Clear</button>}
                    </div>
                    {loginPosts.some(p=>p.type==="results")&&<p style={{color:C.green,fontSize:"0.72rem",margin:"6px 0 0"}}>✓ Results visible on login screen</p>}
                  </>);
                })()}
              </div>
            </div>
          </div>
        )}

                {tab==="profile"&&(()=>{
          const myPlayer = players.find(p=>p.name===user.name);
          const myStats = myPlayer ? standings.find(s=>s.id===myPlayer.id) : null;
          

          if(!myPlayer) return (
            <div>
              <h2 style={{color:C.cream,fontSize:"1rem",letterSpacing:"0.06em",marginBottom:"12px",borderBottom:`1px solid ${C.border}`,paddingBottom:"8px"}}>👤 My Profile</h2>
              <div style={{...cardSt,textAlign:"center",padding:"32px 16px"}}>
                <div style={{fontSize:"2.5rem",marginBottom:"12px"}}>🔍</div>
                <p style={{color:C.muted,fontSize:"0.88rem",margin:"0 0 6px"}}>You're not in the league yet.</p>
                <p style={{color:C.muted,fontSize:"0.78rem",margin:0}}>Ask your admin to add you as a player.</p>
              </div>
            </div>
          );

          const saveProfileName = () => {
            if(!profileName.trim()) return;
            const updatedPlayers = players.map(p=>p.id===myPlayer.id?{...p,name:profileName.trim()}:p);
            const updatedWG = {};
            Object.entries(weeklyGames).forEach(([pid,wk])=>{updatedWG[pid]=wk;});
            update({players:updatedPlayers,weeklyGames:updatedWG});
            setEditingProfileName(false);
            notify("Name updated!");
          };

          const saveProfileWeek = (wk) => {
            const jw = parseInt(wk);
            const preGames={};
            for(let w=1;w<jw;w++) preGames[w]=[{gameId:`pre-${w}`,position:null,groupSize:null,pts:1,sotd:0,absent:true,label:"Pre-join"}];
            const existingGames = weeklyGames[myPlayer.id]||{};
            const mergedGames = {...preGames};
            Object.entries(existingGames).forEach(([w,g])=>{ if(parseInt(w)>=jw) mergedGames[w]=g; });
            update({players:players.map(p=>p.id===myPlayer.id?{...p,joinedWeek:jw}:p), weeklyGames:{...weeklyGames,[myPlayer.id]:mergedGames}});
            notify("Joined week updated!");
          };

          return (
            <div>
              <h2 style={{color:C.cream,fontSize:"1rem",letterSpacing:"0.06em",marginBottom:"16px",borderBottom:`1px solid ${C.border}`,paddingBottom:"8px"}}>👤 My Profile</h2>
              {/* Photo + Name */}
              <div style={{...cardSt,marginBottom:"14px",display:"flex",alignItems:"center",gap:"14px"}}>
                <div style={{position:"relative",flexShrink:0}}>
                  {myPlayer.imageUrl
                    ? <img src={myPlayer.imageUrl} alt={myPlayer.name} style={{width:"72px",height:"72px",borderRadius:"50%",objectFit:"cover",border:`3px solid ${C.accent}`}}/>
                    : <div style={{width:"72px",height:"72px",borderRadius:"50%",background:C.border,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"2rem"}}>👤</div>
                  }
                  <label style={{position:"absolute",bottom:0,right:0,background:C.accent,borderRadius:"50%",width:"22px",height:"22px",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:"0.7rem"}}>
                    📷
                    <input type="file" accept="image/*" style={{display:"none"}} onChange={async e=>{
                      const file=e.target.files[0]; if(!file) return;
                      const url=await uploadImage(file);
                      update({players:players.map(p=>p.id===myPlayer.id?{...p,imageUrl:url}:p)});
                      notify("Photo updated!");
                    }}/>
                  </label>
                </div>
                <div style={{flex:1}}>
                  {editingProfileName ? (
                    <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
                      <input style={inputSt} value={profileName} onChange={e=>setProfileName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&saveProfileName()} autoFocus/>
                      <div style={{display:"flex",gap:"6px"}}>
                        <button style={{...btnSt(),flex:1,padding:"7px"}} onClick={saveProfileName}>Save</button>
                        <button style={{background:"none",border:`1px solid ${C.border}`,color:C.muted,borderRadius:"6px",padding:"7px 12px",cursor:"pointer",fontFamily:"Georgia,serif",fontSize:"0.8rem"}} onClick={()=>{setEditingProfileName(false);setProfileName(myPlayer.name);}}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                        <span style={{color:C.cream,fontWeight:"bold",fontSize:"1.1rem"}}>{myPlayer.name}</span>
                        <button onClick={()=>{setProfileName(myPlayer.name);setEditingProfileName(true);}} style={{background:"none",border:`1px solid ${C.border}`,color:C.muted,borderRadius:"4px",padding:"2px 7px",cursor:"pointer",fontSize:"0.65rem",fontFamily:"Georgia,serif"}}>✎ edit</button>
                      </div>
                      <div style={{color:C.muted,fontSize:"0.75rem",marginTop:"4px"}}>
                        <span style={{fontSize:"0.72rem",color:C.muted}}>Joined Week {myPlayer.joinedWeek||1}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              {/* Stats */}
              {myStats&&(
                <div style={{...cardSt,marginBottom:"14px"}}>
                  <h3 style={{color:C.accentLight,fontSize:"0.82rem",letterSpacing:"0.08em",margin:"0 0 12px"}}>MY STATS</h3>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"}}>
                    {[
                      ["Total Points",myStats.pts,C.accent],
                      ["MVP %",myStats.mvp!=="—"?`${myStats.mvp}%`:"—",C.blue],
                      ["Wins",myStats.wins,C.greenLight],
                      ["Weeks Attended",myStats.weeksAttended,C.muted],
                      ["Shot of the Day",myStats.sotdTotal>0?`⭐ ${myStats.sotdTotal}`:"—",C.gold],
                      ["Absences",myStats.absences,C.muted],
                    ].map(([label,val,col])=>(
                      <div key={label} style={{background:C.surface,borderRadius:"8px",padding:"10px 12px"}}>
                        <div style={{color:C.muted,fontSize:"0.65rem",letterSpacing:"0.08em",marginBottom:"4px"}}>{label.toUpperCase()}</div>
                        <div style={{color:col,fontWeight:"bold",fontSize:"1.1rem"}}>{val}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {/* League rank */}
              {myStats&&(
                <div style={{...cardSt,textAlign:"center"}}>
                  <div style={{color:C.muted,fontSize:"0.7rem",letterSpacing:"0.08em",marginBottom:"6px"}}>LEAGUE POSITION</div>
                  <div style={{fontSize:"2rem"}}><Medal rank={standings.findIndex(s=>s.id===myPlayer.id)+1}/></div>
                  <div style={{color:C.cream,fontSize:"0.85rem",marginTop:"4px"}}>#{standings.findIndex(s=>s.id===myPlayer.id)+1} of {standings.length}</div>
                </div>
              )}
            </div>
          );
        })()}

        {tab==="players"&&isAdmin&&(
          <div>
            <h2 style={{color:C.cream,fontSize:"1rem",letterSpacing:"0.06em",marginBottom:"12px",borderBottom:`1px solid ${C.border}`,paddingBottom:"8px"}}>Manage Players</h2>
            <div style={{...cardSt,marginBottom:"14px"}}>
              <p style={{color:C.muted,fontSize:"0.78rem",margin:"0 0 10px",lineHeight:"1.5"}}>Mid-season joiners get <strong style={{color:C.accent}}>1 pt</strong> auto-assigned for pre-join weeks.</p>
              <div style={{display:"flex",gap:"8px",marginBottom:"8px"}}>
                <div style={{flex:1}}><label style={lbSt}>PLAYER NAME</label><input style={inputSt} placeholder="Full name…" value={newName} onChange={e=>setNewName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addPlayer()}/></div>
                <div style={{width:"90px"}}><label style={lbSt}>JOINED WK</label><select style={inputSt} value={newWeek} onChange={e=>setNewWeek(parseInt(e.target.value))}>{weekOptions.map(w=><option key={w} value={w}>Wk {w}</option>)}</select></div>
              </div>
              <button style={{...btnSt(),width:"100%",padding:"10px"}} onClick={addPlayer}>Add Player</button>
            </div>
            {players.length===0&&<p style={{color:C.muted,fontSize:"0.84rem"}}>No players yet!</p>}
            <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
              {players.map(p=>(
                <div key={p.id} style={{...cardSt,padding:"10px 12px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                    {p.imageUrl
                      ? <img src={p.imageUrl} alt={p.name} style={{width:"36px",height:"36px",borderRadius:"50%",objectFit:"cover",border:`2px solid ${C.accent}`}}/>
                      : <div style={{width:"36px",height:"36px",borderRadius:"50%",background:C.border,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1rem"}}>👤</div>
                    }
                    <div>
                      <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
                        <span style={{color:C.cream,fontSize:"0.88rem"}}>{p.name}</span>
                        {p.joinedWeek>1&&<span style={{fontSize:"0.6rem",color:C.accent,background:C.accent+"22",padding:"1px 5px",borderRadius:"3px"}}>Wk {p.joinedWeek}</span>}
                      </div>
                      <label style={{fontSize:"0.68rem",color:C.muted,cursor:"pointer",textDecoration:"underline"}}>
                        {p.imageUrl ? "Change photo" : "Upload photo"}
                        <input type="file" accept="image/*" style={{display:"none"}} onChange={async e=>{
                          const file = e.target.files[0]; if(!file) return;
                          const url = await uploadImage(file);
                          const newPlayers = players.map(pl=>pl.id===p.id?{...pl,imageUrl:url}:pl);
                          persist({...appState,players:newPlayers});
                        }}/>
                      </label>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:"8px",alignItems:"center"}}>
                    <span style={{color:C.muted,fontSize:"0.78rem"}}>{totalPts(p.id,weeklyGames)}pt</span>
                    <select
                      title="Joined Week"
                      value={p.joinedWeek||1}
                      onChange={e=>{
                        const jw=parseInt(e.target.value);
                        update({players:players.map(pl=>pl.id===p.id?{...pl,joinedWeek:jw}:pl)});
                        notify("Joined week updated!");
                      }}
                      style={{background:"none",border:`1px solid ${C.border}`,color:C.muted,borderRadius:"4px",padding:"3px 6px",fontSize:"0.72rem",fontFamily:"Georgia,serif",cursor:"pointer"}}>
                      {Array.from({length:totalWeeks||1},(_,i)=>i+1).map(w=><option key={w} value={w}>Wk {w}</option>)}
                    </select>
                    <button onClick={()=>removePlayer(p.id)} style={{background:"none",border:`1px solid ${C.red}`,color:C.red,borderRadius:"4px",padding:"3px 8px",cursor:"pointer",fontSize:"0.72rem",fontFamily:"Georgia,serif"}}>Remove</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab==="dues"&&user?.role==="superadmin"&&(()=>{
          const DUE_AMTS=[10,15,20];
          const totalCollected=players.reduce((s,p)=>{const a=membershipDues[String(p.id)];return s+(typeof a==="number"?a:0);},0);
          const totalSpent=leagueExpenses.reduce((s,e)=>s+(e.amount||0),0);
          const balance=totalCollected-totalSpent;
          const paidCount=players.filter(p=>typeof membershipDues[String(p.id)]==="number"&&membershipDues[String(p.id)]>0).length;
          const amtBg={10:"#1a3a1a",15:"#0a2a40",20:"#3a2a00"};
          const amtColor={10:"#7ec87e",15:"#7ab8e8",20:"#e8c46a"};
          const amtBorder={10:"#4a9a4a",15:"#3a88cc",20:"#cc9a20"};
          return(
          <div style={{maxWidth:"600px",margin:"0 auto",padding:"16px 10px"}}>
            <h2 style={{color:C.cream,fontSize:"1rem",letterSpacing:"0.06em",marginBottom:"14px",borderBottom:`1px solid ${C.border}`,paddingBottom:"8px"}}>💰 Membership Dues</h2>

            {/* Treasury summary cards */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"10px",marginBottom:"16px"}}>
              {[
                {label:"Collected",val:`$${totalCollected}`,col:"#7ec87e"},
                {label:"Spent",val:`$${totalSpent}`,col:"#e87a7a"},
                {label:"Balance",val:`$${balance}`,col:balance>=0?"#7ec87e":"#e87a7a"}
              ].map(({label,val,col})=>(
                <div key={label} style={{background:C.surface,borderRadius:"8px",padding:"12px 10px",textAlign:"center",border:`1px solid ${C.border}`}}>
                  <div style={{color:C.muted,fontSize:"0.68rem",letterSpacing:"0.08em",marginBottom:"4px"}}>{label.toUpperCase()}</div>
                  <div style={{color:col,fontSize:"1.3rem",fontWeight:"bold"}}>{val}</div>
                </div>
              ))}
            </div>

            {/* Member dues list */}
            <div style={{...cardSt,marginBottom:"14px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"8px"}}>
                <span style={{color:C.cream,fontSize:"0.85rem",fontWeight:"bold"}}>Member Dues</span>
                <span style={{color:C.accent,fontSize:"0.72rem",letterSpacing:"0.06em"}}>{paidCount} / {players.length} PAID</span>
              </div>
              <div style={{height:"4px",background:C.surface,borderRadius:"2px",marginBottom:"14px"}}>
                <div style={{height:"4px",background:C.green,borderRadius:"2px",width:`${players.length>0?(paidCount/players.length)*100:0}%`,transition:"width 0.4s"}}/>
              </div>
              {(()=>{
                const sortedPlayers=[...players].sort((a,b)=>a.name.localeCompare(b.name));
                const unpaidPlayers=sortedPlayers.filter(p=>{const a=membershipDues[String(p.id)];return!(typeof a==="number"&&a>0)&&!suspendedPlayers.includes(String(p.id));});
                const suspendedDuePlayers=sortedPlayers.filter(p=>{const a=membershipDues[String(p.id)];return!(typeof a==="number"&&a>0)&&suspendedPlayers.includes(String(p.id));});
                const paidPlayers=sortedPlayers.filter(p=>{const a=membershipDues[String(p.id)];return typeof a==="number"&&a>0;});
                const renderCard=(p)=>{
                  const curAmt=typeof membershipDues[String(p.id)]==="number"?membershipDues[String(p.id)]:0;
                  const paid=curAmt>0;
                  const isSuspended=suspendedPlayers.includes(String(p.id));
                  const weeksInLeague=Math.max(1,(totalWeeks||1)-(p.joinedWeek||1)+1);
                  const gamesPlayed=Object.values(weeklyGames[String(p.id)]||{}).filter(g=>g&&!g.absent).length;
                  const toggleSuspend=()=>{
                    const newList=isSuspended?suspendedPlayers.filter(x=>x!==String(p.id)):[...suspendedPlayers,String(p.id)];
                    update({suspendedPlayers:newList});
                    notify(isSuspended?`${p.name} reinstated.`:`${p.name} suspended.`);
                  };
                  const leftBorderCol=paid?C.green:isSuspended?C.red:C.border;
                  return(
                    <div key={p.id} style={{background:C.bg,border:`1px solid ${isSuspended?C.red+"44":C.border}`,borderLeft:`3px solid ${leftBorderCol}`,borderRadius:"0 8px 8px 0",padding:"8px 10px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"7px"}}>
                        {p.imageUrl
                          ?<img src={p.imageUrl} alt={p.name} style={{width:"30px",height:"30px",borderRadius:"50%",objectFit:"cover",border:`2px solid ${paid?C.green:isSuspended?C.red:C.border}`,flexShrink:0}}/>
                          :<div style={{width:"30px",height:"30px",borderRadius:"50%",background:C.surface,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.8rem",flexShrink:0}}>👤</div>
                        }
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{display:"flex",alignItems:"center",gap:"5px"}}>
                            <span style={{color:C.cream,fontSize:"0.82rem",fontWeight:"bold",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.name}</span>
                            {isSuspended&&<span style={{background:C.red+"22",border:`1px solid ${C.red}44`,color:C.red,borderRadius:"4px",padding:"1px 5px",fontSize:"0.6rem",fontWeight:"bold",flexShrink:0}}>SUSPENDED</span>}
                          </div>
                          <div style={{color:C.muted,fontSize:"0.65rem"}}>{weeksInLeague} wk{weeksInLeague!==1?"s":""} · {gamesPlayed} game{gamesPlayed!==1?"s":""}</div>
                        </div>
                      </div>
                      <div style={{display:"flex",gap:"4px",marginBottom:paid?"0":"4px"}}>
                        <button
                          onClick={()=>{const nd={...membershipDues,[String(p.id)]:0};update({membershipDues:nd});notify("Marked unpaid.");}}
                          style={{flex:1,background:curAmt===0?"#2a1a1a":"transparent",border:`1px solid ${curAmt===0?"#e87a7a":C.border}`,borderRadius:"5px",color:curAmt===0?"#e87a7a":C.muted,padding:"4px 0",cursor:"pointer",fontSize:"0.7rem",fontWeight:"bold"}}>—</button>
                        {DUE_AMTS.map(amt=>(
                          <button key={amt}
                            onClick={()=>{const nd={...membershipDues,[String(p.id)]:amt};update({membershipDues:nd});notify(`Dues set to $${amt}!`);}}
                            style={{flex:1,background:curAmt===amt?amtBg[amt]:"transparent",border:`1px solid ${curAmt===amt?amtBorder[amt]:C.border}`,borderRadius:"5px",color:curAmt===amt?amtColor[amt]:C.muted,padding:"4px 0",cursor:"pointer",fontSize:"0.7rem",fontWeight:"bold"}}>
                            ${amt}
                          </button>
                        ))}
                      </div>
                      {!paid&&(
                        <button onClick={toggleSuspend} style={{width:"100%",background:isSuspended?"#1a0800":"transparent",border:`1px solid ${isSuspended?"#cc6600":C.red+"55"}`,borderRadius:"5px",color:isSuspended?"#cc9933":C.red,padding:"4px 0",cursor:"pointer",fontSize:"0.7rem",fontWeight:"bold"}}>
                          {isSuspended?"✓ Reinstate":"🚫 Suspend"}
                        </button>
                      )}
                    </div>
                  );
                };
                return(<>
                  {unpaidPlayers.length>0&&(
                    <div style={{marginBottom:"14px"}}>
                      <div style={{color:C.muted,fontSize:"0.68rem",letterSpacing:"0.08em",marginBottom:"8px"}}>OUTSTANDING ({unpaidPlayers.length})</div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px"}}>
                        {unpaidPlayers.map(p=>renderCard(p))}
                      </div>
                    </div>
                  )}
                  {suspendedDuePlayers.length>0&&(
                    <div style={{marginBottom:"14px"}}>
                      <button
                        onClick={()=>setSuspendedCollapsed(v=>!v)}
                        style={{display:"flex",alignItems:"center",gap:"6px",background:"transparent",border:"none",cursor:"pointer",padding:"0",marginBottom:"8px"}}>
                        <span style={{color:C.red,fontSize:"0.68rem",letterSpacing:"0.08em"}}>🚫 SUSPENDED ({suspendedDuePlayers.length})</span>
                        <span style={{color:C.muted,fontSize:"0.65rem"}}>{suspendedCollapsed?"▶":"▼"}</span>
                      </button>
                      {!suspendedCollapsed&&(
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px"}}>
                          {suspendedDuePlayers.map(p=>renderCard(p))}
                        </div>
                      )}
                    </div>
                  )}
                  {paidPlayers.length>0&&(
                    <div>
                      <button
                        onClick={()=>setPaidCollapsed(v=>!v)}
                        style={{display:"flex",alignItems:"center",gap:"6px",background:"transparent",border:"none",cursor:"pointer",padding:"0",marginBottom:"8px"}}>
                        <span style={{color:C.muted,fontSize:"0.68rem",letterSpacing:"0.08em"}}>PAID ({paidPlayers.length})</span>
                        <span style={{color:C.muted,fontSize:"0.65rem"}}>{paidCollapsed?"▶":"▼"}</span>
                      </button>
                      {!paidCollapsed&&(
                        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"6px"}}>
                          {paidPlayers.map(p=>renderCard(p))}
                        </div>
                      )}
                    </div>
                  )}
                </>);
              })()}
            </div>
            {/* Expenses ledger */}
            <div style={{...cardSt}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"12px"}}>
                <span style={{color:C.cream,fontSize:"0.85rem",fontWeight:"bold"}}>Expenses</span>
                <button
                  onClick={()=>{setShowExpenseForm(v=>!v);setExpForm({desc:"",amount:""}); }}
                  style={{background:"transparent",border:`1px solid ${C.accent}`,borderRadius:"6px",color:C.accent,padding:"4px 10px",cursor:"pointer",fontSize:"0.75rem",fontFamily:"Georgia,serif"}}>
                  {showExpenseForm?"✕ Cancel":"+ Add"}
                </button>
              </div>
              {showExpenseForm&&(
                <div style={{background:C.surface,borderRadius:"8px",padding:"12px",marginBottom:"12px",display:"flex",flexDirection:"column",gap:"8px"}}>
                  <input
                    value={expForm.desc}
                    onChange={e=>setExpForm(f=>({...f,desc:e.target.value}))}
                    placeholder="Description (e.g. Mallets & wickets)"
                    style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:"6px",color:C.cream,padding:"7px 10px",fontSize:"0.82rem",fontFamily:"Georgia,serif",width:"100%"}}/>
                  <div style={{display:"flex",gap:"8px"}}>
                    <input
                      type="number"
                      value={expForm.amount}
                      onChange={e=>setExpForm(f=>({...f,amount:e.target.value}))}
                      placeholder="Amount ($)"
                      style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:"6px",color:C.cream,padding:"7px 10px",fontSize:"0.82rem",fontFamily:"Georgia,serif",width:"120px"}}/>
                    <button
                      onClick={()=>{
                        const amt=parseFloat(expForm.amount);
                        if(!expForm.desc.trim()||isNaN(amt)||amt<=0){notify("Enter a description and amount.");return;}
                        const entry={id:Date.now(),desc:expForm.desc.trim(),amount:amt,date:new Date().toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})};
                        update({leagueExpenses:[...leagueExpenses,entry]});
                        setShowExpenseForm(false);
                        setExpForm({desc:"",amount:""});
                        notify("Expense added!");
                      }}
                      style={{background:C.green+"33",border:`1px solid ${C.green}`,borderRadius:"6px",color:C.green,padding:"7px 14px",cursor:"pointer",fontSize:"0.82rem",fontFamily:"Georgia,serif",fontWeight:"bold"}}>
                      Save
                    </button>
                  </div>
                </div>
              )}
              {leagueExpenses.length===0&&!showExpenseForm&&(
                <div style={{color:C.muted,fontSize:"0.78rem",textAlign:"center",padding:"16px 0"}}>No expenses recorded yet.</div>
              )}
              <div style={{display:"flex",flexDirection:"column",gap:"0"}}>
                {[...leagueExpenses].reverse().map((e,i)=>(
                  <div key={e.id} style={{display:"flex",alignItems:"center",gap:"10px",padding:"9px 0",borderBottom:i<leagueExpenses.length-1?`1px solid ${C.border}`:"none"}}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{color:C.cream,fontSize:"0.85rem",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{e.desc}</div>
                      <div style={{color:C.muted,fontSize:"0.68rem"}}>{e.date}</div>
                    </div>
                    <div style={{color:"#e87a7a",fontSize:"0.88rem",fontWeight:"bold",flexShrink:0}}>-${e.amount.toFixed(2)}</div>
                    <button
                      onClick={()=>{if(window.confirm(`Remove "${e.desc}"?`)){update({leagueExpenses:leagueExpenses.filter(x=>x.id!==e.id)});notify("Expense removed.");}}}
                      style={{background:"transparent",border:"none",color:C.muted,cursor:"pointer",fontSize:"0.9rem",padding:"2px 4px",lineHeight:1}}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          );
        })()}
      </div>
    </div>
  );
}
// ── League Honours helpers ────────────────────────────────────────────────────
function laurelBranchSVG(col, W, H) {
  const N=16; const parts=[];
  const x0=W/2,y0=H*0.97,x3=W/2,y3=H*0.03;
  const bow=-W*0.65;
  const x1=W/2+bow,y1=H*0.72,x2=W/2+bow,y2=H*0.28;
  function bez(t,a,b,c,d){const u=1-t;return u*u*u*a+3*u*u*t*b+3*u*t*t*c+t*t*t*d;}
  function bezT(t,a,b,c,d){const u=1-t;return 3*(u*u*(b-a)+2*u*t*(c-b)+t*t*(d-c));}
  for(let i=0;i<N;i++){
    const t=i/(N-1);
    const sx=bez(t,x0,x1,x2,x3),sy=bez(t,y0,y1,y2,y3);
    const tx=bezT(t,x0,x1,x2,x3),ty=bezT(t,y0,y1,y2,y3);
    const stemAngle=Math.atan2(ty,tx);
    const side2=(i%2===0)?1:-1;
    const perpAngle=stemAngle+Math.PI/2;
    const lx=sx+Math.cos(perpAngle)*3*side2,ly=sy+Math.sin(perpAngle)*3*side2;
    const leafBaseAngle=stemAngle+(side2>0?Math.PI/2:-Math.PI/2);
    const fan=(1-t)*0.25;
    const leafAngle=leafBaseAngle+(side2>0?fan:-fan);
    const siz=0.75+Math.sin(t*Math.PI)*0.25;
    const lLen=22*siz,lWid=14*siz,lw2=lWid/2;
    const leafPath=`M 0,0 C ${lw2},${-lLen*0.1} ${lw2*1.1},${-lLen*0.5} 0,${-lLen} C ${-lw2*1.1},${-lLen*0.5} ${-lw2},${-lLen*0.1} 0,0`;
    const rotateDeg=(leafAngle*180/Math.PI)+90;
    const shade=0.78+Math.sin(t*Math.PI)*0.18;
    parts.push(`<g transform="translate(${lx.toFixed(1)},${ly.toFixed(1)}) rotate(${rotateDeg.toFixed(1)})"><path d="${leafPath}" fill="${col}" opacity="${shade.toFixed(2)}"/><line x1="0" y1="0" x2="0" y2="${(-lLen*0.85).toFixed(1)}" stroke="rgba(0,0,0,0.18)" stroke-width="1"/></g>`);
  }
  parts.push(`<path d="M${x0},${y0} C${x1},${y1} ${x2},${y2} ${x3},${y3}" stroke="${col}" stroke-width="2" fill="none" opacity="0.45"/>`);
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${parts.join('')}</svg>`;
}

function LeagueHonours({appState, update, uploadImage, isAdmin, setLightbox}) {
  const [honoursTab, setHonoursTab] = useState("contest");
  const [season,     setSeason]     = useState("2026");
  const [openYears,  setOpenYears]  = useState({"2026":true});

  const lh = appState.leagueHonours || {seasons:{},awards:{}};
  const CONTEST_YEARS=["2026","2025"];
  const ALL_YEARS=["2026","2025","2024","2023","2022","2021","2020"];

  const updateLH=(patch)=>{
    update({leagueHonours:{...lh,...patch}});
  };
  const updateSeason=(yr,patch)=>{
    updateLH({seasons:{...lh.seasons,[yr]:{...(lh.seasons?.[yr]||{}),...patch}}});
  };
  const updateAwards=(yr,newList)=>{
    updateLH({awards:{...lh.awards,[yr]:newList}});
  };

  const col={contest:"#c9a84c",awards:"#5a9a50"};
  const BW=90,BH=340;

  const tabBtn=(id,label)=>(
    <button key={id} onClick={()=>setHonoursTab(id)} style={{
      background:"none",border:"none",
      borderBottom:`2px solid ${honoursTab===id?C.accent:"transparent"}`,
      padding:"9px 20px",fontFamily:"Georgia,serif",fontSize:"0.82rem",
      color:honoursTab===id?C.accentLight:C.muted,cursor:"pointer",
      fontWeight:honoursTab===id?"bold":"normal",
    }}>{label}</button>
  );

  const ContestCard=({yr,gold})=>{
    const s=lh.seasons?.[yr]||{};
    const cardCol=gold?"#c9a84c":"#5a9a50";
    const branch=laurelBranchSVG(cardCol,BW,BH);
    const label=gold?"OFFICIAL LEAGUE LOGO":"OFFICIAL LEAGUE MOTTO";
    return(
      <div style={{background:C.card,border:`1px solid ${cardCol}55`,borderRadius:"14px",
        padding:"20px 8px 18px",textAlign:"center",flex:1,minWidth:"240px",maxWidth:"300px"}}>
        <div style={{fontSize:"0.6rem",letterSpacing:"0.14em",color:cardCol,
          fontWeight:"bold",marginBottom:"10px"}}>{label}</div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{width:"100%",display:"flex",flexDirection:"column",alignItems:"center",gap:"8px"}}>
            {gold?(
              s.logoUrl
                ?<img src={s.logoUrl} alt="logo" onClick={()=>setLightbox(s.logoUrl)}
                    style={{width:"100%",maxWidth:"220px",borderRadius:"10px",objectFit:"contain",
                      border:`1px solid ${cardCol}55`,boxShadow:"0 4px 20px rgba(0,0,0,0.5)",cursor:"pointer"}}/>
                :(isAdmin&&<label style={{width:"120px",height:"120px",background:C.surface,
                    border:`1px dashed ${cardCol}66`,borderRadius:"10px",display:"flex",
                    flexDirection:"column",alignItems:"center",justifyContent:"center",
                    gap:"6px",cursor:"pointer"}}>
                    <span style={{fontSize:"1.5rem"}}>📁</span>
                    <span style={{fontSize:"0.65rem",color:cardCol}}>Upload logo</span>
                    <input type="file" accept="image/*" style={{display:"none"}} onChange={async e=>{
                      const file=e.target.files[0];if(!file)return;
                      const url=await uploadImage(file);
                      updateSeason(yr,{logoUrl:url});
                    }}/>
                  </label>)
            ):(
              s.motto
                ?<div style={{fontSize:"1.05rem",fontStyle:"italic",color:C.cream,
                    lineHeight:"1.6",padding:"0 4px"}}>"{s.motto}"</div>
                :<div style={{fontSize:"0.75rem",color:C.muted,fontStyle:"italic",padding:"20px 0"}}>
                    No motto set yet
                  </div>
            )}
          </div>
          
        </div>
        {(gold?s.logoWinner:s.mottoWinner)&&(
          <div style={{fontSize:"0.9rem",fontWeight:"bold",color:C.cream,marginTop:"8px"}}>
            🥇 {gold?s.logoWinner:s.mottoWinner}
          </div>
        )}
        <div style={{fontSize:"0.7rem",color:C.muted,marginTop:"3px"}}>{yr} Season</div>
      </div>
    );
  };

  return(
    <div>
      {/* Sub-tabs */}
      <div style={{display:"flex",borderBottom:`1px solid ${C.border}`,marginBottom:"20px"}}>
        {tabBtn("contest","Contest Winners")}
        {tabBtn("awards","Awards")}
      </div>

      {/* ── Contest Winners ── */}
      {honoursTab==="contest"&&(
        <div>
          {/* Season selector */}
          <div style={{display:"flex",gap:"6px",marginBottom:"20px",justifyContent:"center"}}>
            {CONTEST_YEARS.map(yr=>(
              <button key={yr} onClick={()=>setSeason(yr)} style={{
                padding:"6px 16px",borderRadius:"6px",cursor:"pointer",
                fontFamily:"Georgia,serif",fontSize:"0.8rem",
                background:season===yr?C.accent:C.surface,
                color:season===yr?C.bg:C.muted,
                border:`1px solid ${season===yr?C.accent:C.border}`,
              }}>{yr} Season</button>
            ))}
          </div>

          {/* Cards */}
          <div style={{display:"flex",flexWrap:"wrap",justifyContent:"center",gap:"16px",marginBottom:"20px"}}>
            <ContestCard yr={season} gold={true}/>
            <ContestCard yr={season} gold={false}/>
          </div>

          {/* Edit fields — admin only */}
          {isAdmin&&(
            <div style={{background:C.surface,border:`1px solid ${C.border}`,
              borderRadius:"10px",padding:"14px 16px"}}>
              <div style={{color:C.muted,fontSize:"0.65rem",letterSpacing:"0.1em",marginBottom:"12px"}}>
                EDIT {season} CONTEST WINNERS
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"}}>
                <div>
                  <label style={{color:C.muted,fontSize:"0.68rem",display:"block",marginBottom:"3px"}}>Logo winner</label>
                  <input value={lh.seasons?.[season]?.logoWinner||""}
                    onChange={e=>updateSeason(season,{logoWinner:e.target.value})}
                    placeholder="e.g. Steve D."
                    style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"6px",
                      padding:"7px 10px",color:C.text,fontSize:"0.82rem",
                      fontFamily:"Georgia,serif",outline:"none",width:"100%",boxSizing:"border-box"}}/>
                </div>
                <div>
                  <label style={{color:C.muted,fontSize:"0.68rem",display:"block",marginBottom:"3px"}}>Motto winner</label>
                  <input value={lh.seasons?.[season]?.mottoWinner||""}
                    onChange={e=>updateSeason(season,{mottoWinner:e.target.value})}
                    placeholder="e.g. Mark C."
                    style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"6px",
                      padding:"7px 10px",color:C.text,fontSize:"0.82rem",
                      fontFamily:"Georgia,serif",outline:"none",width:"100%",boxSizing:"border-box"}}/>
                </div>
                <div style={{gridColumn:"1/-1"}}>
                  <label style={{color:C.muted,fontSize:"0.68rem",display:"block",marginBottom:"3px"}}>Motto text</label>
                  <textarea value={lh.seasons?.[season]?.motto||""}
                    onChange={e=>updateSeason(season,{motto:e.target.value})}
                    placeholder="Enter the season motto…" rows={2}
                    style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"6px",
                      padding:"7px 10px",color:C.text,fontSize:"0.82rem",resize:"vertical",
                      fontFamily:"Georgia,serif",outline:"none",width:"100%",boxSizing:"border-box"}}/>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Awards ── */}
      {honoursTab==="awards"&&(
        <div>
          {ALL_YEARS.map(yr=>{
            const list=lh.awards?.[yr]||[{title:"League Champion",recipient:"",pinned:true}];
            const champ=list[0];
            const rest=list.slice(1);
            const isOpen=openYears[yr];
            return(
              <div key={yr} style={{marginBottom:"10px"}}>
                <div onClick={()=>setOpenYears(p=>({...p,[yr]:!p[yr]}))}
                  style={{display:"flex",alignItems:"center",justifyContent:"space-between",
                    cursor:"pointer",padding:"10px 14px",background:C.surface,
                    border:`1px solid ${C.border}`,borderRadius:"8px",marginBottom:"6px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                    <span style={{color:C.cream,fontSize:"0.9rem",fontWeight:"bold"}}>{yr}</span>
                    {champ.recipient&&<span style={{color:C.muted,fontSize:"0.75rem"}}>
                      🏆 {champ.recipient}
                    </span>}
                  </div>
                  <span style={{color:C.muted,fontSize:"0.75rem"}}>{isOpen?"▲":"▼"}</span>
                </div>
                {isOpen&&(
                  <div style={{border:`1px solid ${C.border}`,borderRadius:"10px",overflow:"hidden"}}>
                    {/* League Champion */}
                    <div style={{background:C.card,padding:"12px 16px",
                      display:"flex",alignItems:"center",gap:"12px"}}>
                      <span style={{fontSize:"1.2rem"}}>🏆</span>
                      <div style={{flex:1}}>
                        <div style={{color:"#c9a84c",fontSize:"0.62rem",letterSpacing:"0.1em",marginBottom:"3px"}}>
                          LEAGUE CHAMPION
                        </div>
                        {isAdmin
                          ?<input value={champ.recipient||""} placeholder="Champion name…"
                              onChange={e=>{const nl=[...list];nl[0]={...nl[0],recipient:e.target.value};updateAwards(yr,nl);}}
                              style={{border:"none",background:"transparent",padding:0,
                                color:C.cream,fontSize:"0.88rem",fontWeight:"bold",
                                fontFamily:"Georgia,serif",width:"100%",outline:"none"}}/>
                          :<span style={{color:C.cream,fontSize:"0.88rem",fontWeight:"bold"}}>
                              {champ.recipient||"—"}
                            </span>
                        }
                      </div>
                    </div>
                    {/* Other awards */}
                    <div style={{borderTop:`1px solid ${C.border}`}}>
                      {rest.map((a,ri)=>(
                        <div key={ri} style={{display:"flex",alignItems:"center",gap:"10px",
                          padding:"9px 14px",borderBottom:`1px solid ${C.border}`}}>
                          <span style={{fontSize:"0.9rem"}}>🎖</span>
                          {isAdmin?(
                            <>
                              <input value={a.title} placeholder="Award name…"
                                onChange={e=>{const nl=[...list];nl[ri+1]={...nl[ri+1],title:e.target.value};updateAwards(yr,nl);}}
                                style={{flex:1,background:C.surface,border:`1px solid ${C.border}`,
                                  borderRadius:"5px",padding:"5px 8px",color:C.text,
                                  fontSize:"0.78rem",fontFamily:"Georgia,serif",outline:"none"}}/>
                              <input value={a.recipient} placeholder="Recipient…"
                                onChange={e=>{const nl=[...list];nl[ri+1]={...nl[ri+1],recipient:e.target.value};updateAwards(yr,nl);}}
                                style={{flex:1,background:C.surface,border:`1px solid ${C.border}`,
                                  borderRadius:"5px",padding:"5px 8px",color:C.text,
                                  fontSize:"0.78rem",fontFamily:"Georgia,serif",outline:"none"}}/>
                              <button onClick={()=>{const nl=[...list];nl.splice(ri+1,1);updateAwards(yr,nl);}}
                                style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:"0.9rem"}}>✕</button>
                            </>
                          ):(
                            <div style={{flex:1}}>
                              <span style={{color:C.muted,fontSize:"0.78rem"}}>{a.title}</span>
                              {a.recipient&&<span style={{color:C.cream,fontSize:"0.78rem",marginLeft:"8px",fontWeight:"bold"}}>{a.recipient}</span>}
                            </div>
                          )}
                        </div>
                      ))}
                      {isAdmin&&(
                        <div style={{padding:"8px 14px"}}>
                          <button onClick={()=>updateAwards(yr,[...list,{title:"",recipient:""}])}
                            style={{width:"100%",padding:"6px",borderRadius:"6px",
                              border:`1px dashed ${C.border}`,background:"none",
                              fontFamily:"Georgia,serif",fontSize:"0.75rem",
                              color:C.muted,cursor:"pointer"}}>
                            + Add Award
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Cloudinary photo picker ──────────────────────────────────────────────────
function CloudinaryPicker({onSelect, onClose, appState}) {
  const allImages = [
    ...LOGO_ENTRIES.map(e=>({url:e.url,label:"Logo entry"})),
    ...(appState?.players||[]).filter(p=>p.imageUrl).map(p=>({url:p.imageUrl,label:p.name})),
    ...(appState?.venues||[]).filter(v=>v.imageUrl).map(v=>({url:v.imageUrl,label:v.name})),
  ];

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:2000,
      display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"14px",
        padding:"20px",maxWidth:"560px",width:"100%",maxHeight:"80vh",display:"flex",flexDirection:"column"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"16px"}}>
          <span style={{color:C.cream,fontWeight:"bold",fontSize:"0.95rem"}}>Choose a photo</span>
          <button onClick={onClose} style={{background:"none",border:"none",color:C.muted,
            cursor:"pointer",fontSize:"1.2rem"}}>✕</button>
        </div>
        <div style={{overflowY:"auto",flex:1}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(100px,1fr))",gap:"8px"}}>
            {allImages.map((img,i)=>(
              <div key={i} onClick={()=>{onSelect(img.url);onClose();}}
                style={{cursor:"pointer",borderRadius:"8px",overflow:"hidden",
                  border:`1px solid ${C.border}`,aspectRatio:"1",
                  transition:"border-color .15s"}}
                onMouseEnter={e=>e.currentTarget.style.borderColor=C.accent}
                onMouseLeave={e=>e.currentTarget.style.borderColor=C.border}>
                <img src={img.url} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

