import { useState, useMemo, useRef, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, onSnapshot, setDoc } from "firebase/firestore";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import CroquetGame from './CroquetGame';
import ParkTracer  from './ParkTracer';

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
  players: [], weeklyGames: {}, totalWeeks: 1,
  leagueName: "Croquet De-Twah", leagueLogo: null,
  venues: DEFAULT_VENUES.map((name,i) => ({id:i+1,name,rating:0,comment:"",timesPlayed:0,reviews:[]})),
  votes: {},
  joinCode: "croquet2026",
  nextVenueId: null,
};

function LoginScreen({onLogin, joinCode, nextMatch}) {
  const [mode, setMode]         = useState("choose");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [viewerName, setViewerName] = useState("");
  const [err, setErr]           = useState("");
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [showJoinCode, setShowJoinCode] = useState(false);

  const tryAdmin = () => {
    const match = DEFAULT_ADMINS.find(a => a.username===username.trim() && a.password===password);
    if (match) onLogin({name:match.username, role:match.role});
    else setErr("Invalid username or password.");
  };
  const tryViewer = () => {
    if (!viewerName.trim()) { setErr("Please enter your name."); return; }
    const name = viewerName.trim();
    if(joinCodeInput.trim()) {
      if(joinCodeInput.trim()===joinCode) {
        onLogin({name, role:"self-register", onError:(msg)=>setErr(msg)});
      } else {
        setErr("Invalid join code.");
      }
    } else {
      onLogin({name, role:"viewer"});
    }
  };

  const iSt = {background:C.surface,border:`1px solid ${C.border}`,borderRadius:"8px",color:C.text,padding:"12px 14px",fontSize:"0.95rem",fontFamily:"Georgia,serif",outline:"none",width:"100%",boxSizing:"border-box"};
  const bSt = (col=C.accent) => ({background:`linear-gradient(135deg,${col},${col}bb)`,border:"none",borderRadius:"8px",color:col===C.accent?C.bg:C.text,padding:"12px 20px",fontFamily:"Georgia,serif",fontSize:"0.95rem",fontWeight:"bold",cursor:"pointer",width:"100%",letterSpacing:"0.04em"});

  return (
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Georgia,serif",padding:"24px"}}>
      <div style={{maxWidth:"400px",width:"100%"}}>
        <div style={{textAlign:"center",marginBottom:"24px"}}>
          <div style={{fontSize:"3.5rem",marginBottom:"12px"}}>🔵</div>
          <h1 style={{color:C.cream,fontSize:"2rem",margin:"0 0 6px",letterSpacing:"0.05em",fontWeight:"bold"}}>Croquet De-Twah</h1>
          <p style={{color:C.muted,fontSize:"0.85rem",margin:0,letterSpacing:"0.08em",textTransform:"uppercase"}}>2026 Season</p>
        </div>
        {nextMatch&&(
          <div style={{background:C.card,border:`1px solid ${C.accent}44`,borderRadius:"12px",padding:"14px 16px",marginBottom:"24px"}}>
            <div style={{color:C.accent,fontSize:"0.65rem",letterSpacing:"0.1em",marginBottom:"8px"}}>NEXT MATCH</div>
            <div style={{display:"flex",gap:"12px",alignItems:"center"}}>
              {nextMatch.imageUrl
                ? <img src={nextMatch.imageUrl} alt={nextMatch.name} style={{width:"56px",height:"56px",borderRadius:"8px",objectFit:"cover",flexShrink:0}}/>
                : <div style={{width:"56px",height:"56px",borderRadius:"8px",background:C.border,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.5rem",flexShrink:0}}>📍</div>
              }
              <div style={{flex:1}}>
                <div style={{color:C.cream,fontWeight:"bold",fontSize:"0.95rem",marginBottom:"2px"}}>{nextMatch.name}</div>
                <div style={{color:C.accentLight,fontSize:"0.8rem",marginBottom:"4px"}}>📅 {nextMatch.date} · 6:30pm</div>
                <div style={{display:"flex",gap:"8px",alignItems:"center",flexWrap:"wrap"}}>
                  <StarRating value={Math.round(nextMatch.avgRating||0)} size={12}/>
                  <span style={{color:nextMatch.hasGrill?C.accent:C.muted,fontSize:"0.72rem"}}>{nextMatch.hasGrill?"🔥 Grills":"🚫 No grills"}</span>
                </div>
              </div>
            </div>
          </div>
        )}
        {mode==="choose" && (
          <div style={{display:"flex",flexDirection:"column",gap:"14px"}}>
            <button onClick={()=>setMode("admin")} style={{...bSt(),padding:"16px"}}>🔐 Admin Login</button>
            <button onClick={()=>setMode("player")} style={{...bSt(C.green),padding:"16px",color:C.text}}>🏑 Player Login</button>
            <button onClick={()=>setMode("viewer")} style={{background:"none",border:`1px solid ${C.border}`,borderRadius:"8px",color:C.muted,padding:"12px 20px",fontFamily:"Georgia,serif",fontSize:"0.85rem",cursor:"pointer"}}>👁 View as Guest</button>
            <p style={{color:C.muted,fontSize:"0.72rem",textAlign:"center",margin:"0",lineHeight:"1.6"}}>
              Players use their name + join code to register.<br/>Guests can browse but won't have a profile.
            </p>
          </div>
        )}
        {mode==="admin" && (
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"12px",padding:"24px"}}>
            <h2 style={{color:C.accentLight,fontSize:"1rem",margin:"0 0 20px",letterSpacing:"0.06em"}}>ADMIN LOGIN</h2>
            {err&&<div style={{background:C.red+"22",border:`1px solid ${C.red}44`,borderRadius:"6px",padding:"10px 14px",color:C.red,fontSize:"0.82rem",marginBottom:"16px"}}>{err}</div>}
            <div style={{marginBottom:"14px"}}><label style={{color:C.muted,fontSize:"0.7rem",letterSpacing:"0.1em",display:"block",marginBottom:"6px"}}>USERNAME</label><input style={iSt} value={username} onChange={e=>{setUsername(e.target.value);setErr("");}} placeholder="Enter username" onKeyDown={e=>e.key==="Enter"&&tryAdmin()}/></div>
            <div style={{marginBottom:"20px"}}><label style={{color:C.muted,fontSize:"0.7rem",letterSpacing:"0.1em",display:"block",marginBottom:"6px"}}>PASSWORD</label><input style={iSt} type="password" value={password} onChange={e=>{setPassword(e.target.value);setErr("");}} placeholder="Enter password" onKeyDown={e=>e.key==="Enter"&&tryAdmin()}/></div>
            <button style={bSt()} onClick={tryAdmin}>Sign In</button>
            <button onClick={()=>{setMode("choose");setErr("");}} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:"0.82rem",fontFamily:"Georgia,serif",marginTop:"14px",display:"block",width:"100%",textAlign:"center"}}>← Back</button>
          </div>
        )}
        {mode==="player" && (
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"12px",padding:"24px"}}>
            <h2 style={{color:C.greenLight,fontSize:"1rem",margin:"0 0 20px",letterSpacing:"0.06em"}}>🏑 PLAYER LOGIN</h2>
            {err&&<div style={{background:C.red+"22",border:`1px solid ${C.red}44`,borderRadius:"6px",padding:"10px 14px",color:C.red,fontSize:"0.82rem",marginBottom:"16px"}}>{err}</div>}
            <div style={{marginBottom:"20px"}}><label style={{color:C.muted,fontSize:"0.7rem",letterSpacing:"0.1em",display:"block",marginBottom:"6px"}}>YOUR NAME</label><input style={iSt} value={viewerName} onChange={e=>{setViewerName(e.target.value);setErr("");}} placeholder="e.g. Margaret H." onKeyDown={e=>e.key==="Enter"&&tryViewer()}/></div>
            {!showJoinCode&&<p onClick={()=>setShowJoinCode(true)} style={{color:C.muted,fontSize:"0.75rem",textAlign:"center",cursor:"pointer",textDecoration:"underline",marginBottom:"16px"}}>New player? Register with a join code</p>}
            {showJoinCode&&(
              <div style={{marginBottom:"20px"}}>
                <label style={{color:C.muted,fontSize:"0.7rem",letterSpacing:"0.1em",display:"block",marginBottom:"6px"}}>JOIN CODE</label>
                <input style={iSt} value={joinCodeInput} onChange={e=>{setJoinCodeInput(e.target.value);setErr("");}} placeholder="Enter join code…" onKeyDown={e=>e.key==="Enter"&&tryViewer()}/>
              </div>
            )}
            <button style={{...bSt(C.green),color:C.text}} onClick={tryViewer}>Enter League →</button>
            <button onClick={()=>{setMode("choose");setErr("");setShowJoinCode(false);}} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:"0.82rem",fontFamily:"Georgia,serif",marginTop:"14px",display:"block",width:"100%",textAlign:"center"}}>← Back</button>
          </div>
        )}
        {mode==="viewer" && (
          <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"12px",padding:"24px"}}>
            <h2 style={{color:C.greenLight,fontSize:"1rem",margin:"0 0 20px",letterSpacing:"0.06em"}}>JOIN / VIEW</h2>
            {err&&<div style={{background:C.red+"22",border:`1px solid ${C.red}44`,borderRadius:"6px",padding:"10px 14px",color:C.red,fontSize:"0.82rem",marginBottom:"16px"}}>{err}</div>}
            <div style={{marginBottom:"20px"}}><label style={{color:C.muted,fontSize:"0.7rem",letterSpacing:"0.1em",display:"block",marginBottom:"6px"}}>YOUR NAME</label><input style={iSt} value={viewerName} onChange={e=>{setViewerName(e.target.value);setErr("");}} placeholder="e.g. Margaret H." onKeyDown={e=>e.key==="Enter"&&tryViewer()}/></div>
            <button style={{...bSt(C.green),color:C.text}} onClick={tryViewer}>View League →</button>
            <button onClick={()=>{setMode("choose");setErr("");}} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:"0.82rem",fontFamily:"Georgia,serif",marginTop:"14px",display:"block",width:"100%",textAlign:"center"}}>← Back</button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser]         = useState(null);
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

  if (!user) return <LoginScreen onLogin={(u)=>{
    if(u.role==="self-register") {
      const existing = appState.players.find(p=>p.name.toLowerCase()===u.name.toLowerCase());
      if(existing) {
        u.onError("That name is already taken — please choose a different name or log in as a Guest with that name.");
        return;
      } else {
        const id=Date.now();
        persist({...appState,players:[...appState.players,{id,name:u.name,joinedWeek:1}],weeklyGames:{...appState.weeklyGames,[id]:{}}});
        setUser({name:u.name,role:"viewer"});
      }
    } else {
      setUser(u);
    }
  }} joinCode={appState?.joinCode||"croquet2026"} nextMatch={nextMatch}/>;
  return <LeagueApp user={user} isAdmin={isAdmin} appState={appState} persist={persist} saving={saving} onLogout={()=>setUser(null)} uploadImage={uploadImage}/>;
}

function LeagueApp({user, isAdmin, appState, persist, saving, onLogout, uploadImage}) {
  const {players, weeklyGames, totalWeeks, leagueName, leagueLogo, venues} = appState;
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

  const [gameWeek, setGameWeek]     = useState(1);
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
  const [editingProfileName, setEditingProfileName] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileWeek, setProfileWeek] = useState(1);

  const votes = appState.votes || {};

  const notify = msg => { setNote(msg); setTimeout(()=>setNote(""),3500); };
  const maxWk  = Math.max(totalWeeks,...players.map(p=>p.joinedWeek||1),1);
  const weekOptions = Array.from({length:maxWk+3},(_,i)=>i+1);

  const computeAbsentPreview = (grps,wk,plrs) => {
    const ids=new Set(grps.flatMap(g=>g.players.map(r=>r.playerId)).filter(Boolean));
    return plrs.filter(p=>p.joinedWeek<=parseInt(wk)&&!ids.has(String(p.id))).map(p=>p.name);
  };
  const handleGroupChange = updater => {
    setGroups(prev=>{ const next=updater(prev); setAbsentPreview(computeAbsentPreview(next,gameWeek,players)); return next; });
  };
  const handleWeekChange = wk => { setGameWeek(wk); setAbsentPreview(computeAbsentPreview(groups,wk,players)); };

  const handleLogoUpload = e => {
    const file=e.target.files?.[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=ev=>update({leagueLogo:ev.target.result});
    reader.readAsDataURL(file);
  };

  const standings = useMemo(()=>[...players].map(p=>{
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
  const addRowToGroup=gid=>handleGroupChange(prev=>prev.map(g=>g.id===gid?{...g,players:[...g.players,{playerId:"",position:""}]}:g));
  const removeRowFromGroup=(gid,idx)=>handleGroupChange(prev=>prev.map(g=>g.id===gid?{...g,players:g.players.filter((_,i)=>i!==idx)}:g));
  const updateGroupRow=(gid,idx,field,val)=>handleGroupChange(prev=>prev.map(g=>g.id===gid?{...g,players:g.players.map((r,i)=>i===idx?{...r,[field]:val}:r)}:g));
  const addSotdRow=()=>setSotdEntries(prev=>[...prev,{playerId:"",count:1}]);
  const removeSotdRow=idx=>setSotdEntries(prev=>prev.filter((_,i)=>i!==idx));
  const updateSotdRow=(idx,field,val)=>setSotdEntries(prev=>prev.map((r,i)=>i===idx?{...r,[field]:val}:r));

  const submitGames = () => {
    const wk=parseInt(gameWeek); let errors=[],updates={};
    groups.forEach((grp,gi)=>{
      const rows=grp.players.filter(r=>r.playerId&&r.position);
      if(rows.length<2){errors.push(`Group ${gi+1} needs at least 2 players.`);return;}
      const pos=rows.map(r=>parseInt(r.position));
      if(new Set(pos).size!==pos.length){errors.push(`Group ${gi+1} has duplicate positions.`);return;}
      if(Math.max(...pos)!==rows.length){errors.push(`Group ${gi+1}: positions must run 1 to ${rows.length}.`);return;}
      const gameId=`g-${Date.now()}-${gi}`;
      rows.forEach(r=>{
        const p2=parseInt(r.position),pts=calcPoints(p2,rows.length);
        if(!updates[r.playerId]) updates[r.playerId]={};
        if(!updates[r.playerId][wk]) updates[r.playerId][wk]=[];
        updates[r.playerId][wk].push({gameId,position:p2,groupSize:rows.length,pts,sotd:0,absent:false,label:`Gp ${gi+1}`,venue:gameVenue,date:gameDate});
      });
    });
    if(errors.length){notify(errors[0]);return;}
    const sotdMap={};
    sotdEntries.filter(s=>s.playerId).forEach(s=>{sotdMap[s.playerId]=(sotdMap[s.playerId]||0)+parseInt(s.count||1);});
    const includedIds=new Set(Object.keys(updates));
    const autoAbsent=players.filter(p=>p.joinedWeek<=wk&&!includedIds.has(String(p.id)));
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
    update({weeklyGames:nwg,venues:venues.map(v=>v.name===gameVenue?{...v,timesPlayed:(v.timesPlayed||0)+1}:v),totalWeeks:Math.max(totalWeeks,wk)});
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
    const nwg={...weeklyGames,[pid]:{...weeklyGames[pid],[week]:(weeklyGames[pid][week]||[]).filter((_,i)=>i!==gameIdx)}};
    update({weeklyGames:nwg}); setEditModal(null); notify("Entry deleted.");
  };
  const toggleChart=id=>setChartPlayers(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]);

  const inputSt={background:C.surface,border:`1px solid ${C.border}`,borderRadius:"6px",color:C.text,padding:"8px 10px",fontSize:"0.85rem",fontFamily:"Georgia,serif",outline:"none",width:"100%",boxSizing:"border-box"};
  const textareaSt={...inputSt,resize:"vertical",minHeight:"70px",lineHeight:"1.5"};
  const btnSt=(col=C.accent,light=false)=>({background:`linear-gradient(135deg,${col},${col}bb)`,border:"none",borderRadius:"6px",color:light?C.text:C.bg,padding:"9px 16px",fontFamily:"Georgia,serif",fontSize:"0.84rem",fontWeight:"bold",cursor:"pointer",letterSpacing:"0.03em",whiteSpace:"nowrap"});
  const tabSt=t=>({padding:"8px 10px",border:"none",cursor:"pointer",fontFamily:"Georgia,serif",fontSize:"0.72rem",letterSpacing:"0.03em",background:tab===t?C.accent:"transparent",color:tab===t?C.bg:C.muted,borderBottom:tab===t?`2px solid ${C.accent}`:"2px solid transparent",transition:"all 0.2s",fontWeight:tab===t?"bold":"normal",flexShrink:0});
  const cardSt={background:C.card,border:`1px solid ${C.border}`,borderRadius:"10px",padding:"14px"};
  const lbSt={color:C.muted,fontSize:"0.69rem",letterSpacing:"0.1em",display:"block",marginBottom:"5px"};

  const allTabs=[["standings","⚑ Standings"],["chart","📈 Progress"],["venues","📍 Venues"],["vote","🗳 Vote"],["profile","👤 Profile"],
    ...(user?.role==="superadmin"?[["minigame","⛳ Mini-Game"],["tracer","🗺 Park Tracer"]]:[]),
    ...(isAdmin?[["record","✦ Record"],["history","◷ History"],["players","✤ Players"]]:[])
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
                <button style={{...btnSt(C.red,true),flex:1}} onClick={()=>deleteGame(pid,week,gameIdx)}>Delete</button>
                <button style={{background:"none",border:`1px solid ${C.border}`,color:C.muted,borderRadius:"6px",padding:"9px 12px",cursor:"pointer",fontFamily:"Georgia,serif",fontSize:"0.84rem"}} onClick={()=>setEditModal(null)}>Cancel</button>
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
              style={{width:"44px",height:"44px",borderRadius:"50%",border:`2px ${isAdmin?"dashed":"solid"} ${C.border}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:isAdmin?"pointer":"default",overflow:"hidden",flexShrink:0,background:C.surface,position:"relative"}}
              onMouseEnter={e=>{if(isAdmin){e.currentTarget.style.borderColor=C.accent;}}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;}}>
              {leagueLogo?<img src={leagueLogo} alt="logo" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontSize:"1.3rem",lineHeight:1}}>🔵</span>}
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
      <CommissionerOverlays tab={tab} user={user} setTab={setTab}/>

      <div style={{maxWidth:"1020px",margin:"0 auto",padding:"16px 10px"}}>

        {tab==="standings"&&(
          <div>
            <h2 style={{color:C.cream,fontSize:"1rem",letterSpacing:"0.06em",marginBottom:"12px",borderBottom:`1px solid ${C.border}`,paddingBottom:"8px"}}>Season Standings</h2>
            {standings.length===0&&<p style={{color:C.muted}}>No players yet{isAdmin?" — add some in the Players tab":"."}!</p>}
            {/* Mobile: simplified card layout */}
            <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
              {standings.map((p,i)=>(
                <div key={p.id} style={{background:i===0&&p.pts>0?`linear-gradient(135deg,#1e3018,#253d20)`:C.card,border:`1px solid ${i===0&&p.pts>0?C.accent+"55":C.border}`,borderRadius:"9px",padding:"10px 12px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:"8px",marginBottom:"6px"}}>
                    <Medal rank={i+1}/>
                    {p.imageUrl
                      ? <img src={p.imageUrl} alt={p.name} style={{width:"32px",height:"32px",borderRadius:"50%",objectFit:"cover",border:`2px solid ${i===0&&p.pts>0?C.accent:C.border}`}}/>
                      : <div style={{width:"32px",height:"32px",borderRadius:"50%",background:C.border,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.9rem",flexShrink:0}}>👤</div>
                    }
                    <span style={{fontWeight:"bold",color:i===0&&p.pts>0?C.accentLight:C.cream,fontSize:"0.95rem",flex:1}}>{p.name}</span>
                    {p.joinedWeek>1&&<span style={{fontSize:"0.6rem",color:C.accent,background:C.accent+"22",padding:"1px 5px",borderRadius:"3px"}}>Wk {p.joinedWeek}</span>}
                    <span style={{color:C.accent,fontWeight:"bold",fontSize:"1.1rem"}}>{p.pts}</span>
                  </div>
                  <div style={{display:"flex",gap:"12px",flexWrap:"wrap"}}>
                    <span style={{color:C.blue,fontSize:"0.75rem"}}>MVP: {p.mvp}{p.mvp!=="—"?"%":""}</span>
                    <span style={{color:C.greenLight,fontSize:"0.75rem"}}>Wins: {p.wins}</span>
                    <span style={{color:C.muted,fontSize:"0.75rem"}}>Att: {p.weeksAttended}</span>
                    {p.sotdTotal>0&&<span style={{color:C.gold,fontSize:"0.75rem"}}>⭐{p.sotdTotal}</span>}
                    <span style={{color:C.muted,fontSize:"0.75rem"}}>Abs: {p.absences}</span>
                  </div>
                </div>
              ))}
            </div>
            <p style={{color:C.muted,fontSize:"0.68rem",marginTop:"10px"}}>MVP % = total pts ÷ max possible pts.</p>
          </div>
        )}

        {tab==="chart"&&(
          <div>
            <h2 style={{color:C.cream,fontSize:"1rem",letterSpacing:"0.06em",marginBottom:"10px",borderBottom:`1px solid ${C.border}`,paddingBottom:"8px"}}>Season Progress</h2>
            {players.length===0&&<p style={{color:C.muted}}>No players yet.</p>}
            <div style={{display:"flex",flexWrap:"wrap",gap:"6px",marginBottom:"14px"}}>
              {players.map((p,i)=>{const on=chartPlayers.includes(p.id),col=LINE_COLORS[i%LINE_COLORS.length];return<button key={p.id} onClick={()=>toggleChart(p.id)} style={{padding:"4px 10px",borderRadius:"20px",border:`1px solid ${on?col:C.border}`,background:on?col+"33":"transparent",color:on?col:C.muted,cursor:"pointer",fontSize:"0.74rem",fontFamily:"Georgia,serif"}}>{p.name}</button>;})}
            </div>
            <div style={{...cardSt,padding:"12px 4px 12px 0"}}>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={chartData} margin={{top:8,right:12,left:0,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border}/>
                  <XAxis dataKey="week" tick={{fill:C.muted,fontSize:10,fontFamily:"Georgia,serif"}} axisLine={{stroke:C.border}} tickLine={false}/>
                  <YAxis tick={{fill:C.muted,fontSize:10,fontFamily:"Georgia,serif"}} axisLine={false} tickLine={false}/>
                  <Tooltip contentStyle={{background:C.card,border:`1px solid ${C.border}`,borderRadius:"8px",fontFamily:"Georgia,serif",fontSize:"0.75rem"}} labelStyle={{color:C.cream,fontWeight:"bold"}}/>
                  <Legend wrapperStyle={{fontFamily:"Georgia,serif",fontSize:"0.7rem",paddingTop:"8px"}}/>
                  {players.filter(p=>chartPlayers.includes(p.id)).map(p=><Line key={p.id} type="monotone" dataKey={p.name} stroke={LINE_COLORS[players.findIndex(x=>x.id===p.id)%LINE_COLORS.length]} strokeWidth={2} dot={{r:2}} activeDot={{r:5}}/>)}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

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
                        <div style={{color:C.muted,fontSize:"0.65rem",letterSpacing:"0.1em",marginBottom:"6px"}}>MEMBER REVIEWS</div>
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
                      </div>
                    )}
                    {reviews.length===0&&!v.comment&&<p style={{margin:0,color:C.border,fontSize:"0.74rem",fontStyle:"italic"}}>No reviews yet — be the first!</p>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab==="vote"&&(()=>{
          const alreadyVoted = !!votes[user.name];
          const logoResults = runRCV(LOGO_ENTRIES, votes, "logo");
          const mottoResults = runRCV(MOTTO_ENTRIES, votes, "motto");
          const totalVoters = Object.keys(votes).length;

          const Results = () => (
            <div>
              <h3 style={{color:C.accentLight,fontSize:"0.9rem",letterSpacing:"0.06em",marginBottom:"12px"}}>LIVE RESULTS — LOGO</h3>
              <div style={{display:"flex",flexWrap:"wrap",gap:"8px",marginBottom:"20px"}}>
                {logoResults.map((e,i)=>(
                  <div key={e.id} style={{...cardSt,padding:"8px",textAlign:"center",opacity:e.eliminated?0.4:1,border:`1px solid ${i===0?C.gold+"66":C.border}`}}>
                    <img src={e.url} alt="" onClick={()=>setLightbox(e.url)} style={{width:"70px",height:"70px",objectFit:"cover",borderRadius:"6px",display:"block",marginBottom:"4px",cursor:"pointer"}}/>
                    <div style={{color:i===0?C.gold:C.muted,fontSize:"0.7rem",fontWeight:i===0?"bold":"normal"}}>{i===0?"🏆 ":""}{e.votes}v</div>
                  </div>
                ))}
              </div>
              <h3 style={{color:C.accentLight,fontSize:"0.9rem",letterSpacing:"0.06em",marginBottom:"10px"}}>LIVE RESULTS — MOTTO</h3>
              <div style={{display:"flex",flexDirection:"column",gap:"6px",marginBottom:"20px"}}>
                {mottoResults.map((e,i)=>(
                  <div key={e.id} style={{...cardSt,padding:"10px 12px",display:"flex",justifyContent:"space-between",alignItems:"center",opacity:e.eliminated?0.4:1,border:`1px solid ${i===0?C.gold+"66":C.border}`}}>
                    <span style={{color:i===0?C.gold:C.cream,fontSize:"0.82rem"}}>{i===0?"🏆 ":""}{e.text}</span>
                    <span style={{color:C.muted,fontSize:"0.75rem",marginLeft:"8px",whiteSpace:"nowrap"}}>{e.votes}v</span>
                  </div>
                ))}
              </div>
              {isAdmin&&totalVoters>0&&(
                <div style={{...cardSt,borderColor:C.red+"44"}}>
                  <h3 style={{color:C.red,fontSize:"0.82rem",letterSpacing:"0.06em",margin:"0 0 10px"}}>⚙ MANAGE VOTES</h3>
                  <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
                    {Object.entries(votes).map(([name,v])=>(
                      <div key={name} style={{background:C.surface,borderRadius:"6px",padding:"10px 12px"}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"8px"}}>
                          <span style={{color:C.cream,fontSize:"0.85rem",fontWeight:"bold"}}>{name}</span>
                          <button onClick={()=>{const nv={...votes};delete nv[name];update({votes:nv});notify(`Vote from ${name} deleted.`);}} style={{background:"none",border:`1px solid ${C.red}`,color:C.red,borderRadius:"4px",padding:"3px 8px",cursor:"pointer",fontSize:"0.72rem",fontFamily:"Georgia,serif"}}>Delete</button>
                        </div>
                        <div style={{marginBottom:"6px"}}>
                          <div style={{color:C.muted,fontSize:"0.65rem",letterSpacing:"0.08em",marginBottom:"4px"}}>LOGO RANKING</div>
                          <div style={{display:"flex",flexWrap:"wrap",gap:"4px"}}>
                            {(v.logoRanking||[]).map((id,i)=>{
                              const entry=LOGO_ENTRIES.find(e=>e.id===id);
                              return entry?(
                                <div key={id} style={{display:"flex",alignItems:"center",gap:"3px",background:C.card,borderRadius:"4px",padding:"2px 6px"}}>
                                  <span style={{color:C.accent,fontSize:"0.65rem",fontWeight:"bold"}}>#{i+1}</span>
                                  <img src={entry.url} alt="" style={{width:"20px",height:"20px",objectFit:"cover",borderRadius:"2px"}}/>
                                </div>
                              ):null;
                            })}
                          </div>
                        </div>
                        <div>
                          <div style={{color:C.muted,fontSize:"0.65rem",letterSpacing:"0.08em",marginBottom:"4px"}}>MOTTO RANKING</div>
                          <div style={{display:"flex",flexDirection:"column",gap:"2px"}}>
                            {(v.mottoRanking||[]).map((id,i)=>{
                              const entry=MOTTO_ENTRIES.find(e=>e.id===id);
                              return entry?(
                                <div key={id} style={{display:"flex",alignItems:"center",gap:"6px"}}>
                                  <span style={{color:C.accent,fontSize:"0.65rem",fontWeight:"bold",minWidth:"20px"}}>#{i+1}</span>
                                  <span style={{color:C.muted,fontSize:"0.72rem"}}>{entry.text}</span>
                                </div>
                              ):null;
                            })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );

          const RankList = ({entries, ranking, setRanking, type}) => {
            const unranked = entries.filter(e=>!ranking.includes(e.id));
            const move = (id, dir) => {
              const idx = ranking.indexOf(id);
              if(idx===-1) return;
              const next = [...ranking];
              const swap = idx+dir;
              if(swap<0||swap>=next.length) return;
              [next[idx],next[swap]]=[next[swap],next[idx]];
              setRanking(next);
            };
            const addToRanking = id => setRanking(prev=>[...prev,id]);
            const removeFromRanking = id => setRanking(prev=>prev.filter(x=>x!==id));
            return (
              <div>
                {ranking.length>0&&(
                  <div style={{marginBottom:"14px"}}>
                    <div style={{color:C.accent,fontSize:"0.68rem",letterSpacing:"0.1em",marginBottom:"6px"}}>YOUR RANKING</div>
                    {ranking.map((id,i)=>{
                      const entry=entries.find(e=>e.id===id);
                      if(!entry) return null;
                      return(
                        <div key={id} style={{...cardSt,padding:"8px 10px",marginBottom:"5px",display:"flex",alignItems:"center",gap:"8px",border:`1px solid ${C.accent}44`}}>
                          <span style={{color:C.accent,fontWeight:"bold",fontSize:"0.9rem",minWidth:"22px"}}>#{i+1}</span>
                          {type==="logo"
                            ? <img src={entry.url} alt={`Logo ${id}`} onClick={()=>setLightbox(entry.url)} style={{width:"50px",height:"50px",objectFit:"cover",borderRadius:"5px",cursor:"pointer"}}/>
                            : <span style={{color:C.cream,fontSize:"0.82rem",flex:1}}>{entry.text}</span>
                          }
                          <div style={{display:"flex",flexDirection:"column",gap:"2px",marginLeft:"auto"}}>
                            <button onClick={()=>move(id,-1)} disabled={i===0} style={{background:"none",border:`1px solid ${C.border}`,color:C.muted,borderRadius:"3px",padding:"1px 7px",cursor:"pointer",fontSize:"0.8rem"}}>▲</button>
                            <button onClick={()=>move(id,1)} disabled={i===ranking.length-1} style={{background:"none",border:`1px solid ${C.border}`,color:C.muted,borderRadius:"3px",padding:"1px 7px",cursor:"pointer",fontSize:"0.8rem"}}>▼</button>
                          </div>
                          <button onClick={()=>removeFromRanking(id)} style={{background:"none",border:`1px solid ${C.red}`,color:C.red,borderRadius:"4px",padding:"3px 7px",cursor:"pointer",fontSize:"0.72rem"}}>✕</button>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div style={{color:C.muted,fontSize:"0.68rem",letterSpacing:"0.08em",marginBottom:"8px"}}>
                  {ranking.length===0?"TAP TO RANK (in order of preference)":"UNRANKED — tap to add to your ranking"}
                </div>
                <div style={{display:"flex",flexWrap:"wrap",gap:"8px"}}>
                  {unranked.map(entry=>(
                    <div key={entry.id} onClick={()=>addToRanking(entry.id)}
                      style={{cursor:"pointer",border:`1px solid ${C.border}`,borderRadius:"8px",overflow:"hidden",background:C.surface}}>
                      {type==="logo"
                        ? <img src={entry.url} alt={`Logo ${entry.id}`} onClick={(ev)=>{ev.stopPropagation();setLightbox(entry.url);}} style={{width:"85px",height:"85px",objectFit:"cover",display:"block"}}/>
                        : <div style={{padding:"10px 12px",color:C.cream,fontSize:"0.8rem",maxWidth:"200px"}}>{entry.text}</div>
                      }
                      {type==="logo"&&<div style={{textAlign:"center",padding:"3px",color:C.muted,fontSize:"0.65rem"}}>+ rank</div>}
                    </div>
                  ))}
                </div>
              </div>
            );
          };

          return (
            <div>
              {lightbox&&(
                <div onClick={()=>setLightbox(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.92)",zIndex:2000,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
                  <img src={lightbox} alt="Full size" style={{maxWidth:"95vw",maxHeight:"90vh",objectFit:"contain",borderRadius:"8px"}}/>
                  <div style={{position:"absolute",top:"16px",right:"16px",color:"white",fontSize:"1.5rem"}}>✕</div>
                </div>
              )}
              <h2 style={{color:C.cream,fontSize:"1rem",letterSpacing:"0.06em",marginBottom:"4px",borderBottom:`1px solid ${C.border}`,paddingBottom:"8px"}}>🗳 Vote — 2026 Logo & Motto</h2>
              <p style={{color:C.muted,fontSize:"0.75rem",marginBottom:"16px"}}>{totalVoters} member{totalVoters!==1?"s":""} have voted so far.</p>
              {alreadyVoted ? (
                <div>
                  <div style={{...cardSt,borderColor:C.green+"55",background:"#0d1f0d",marginBottom:"20px",padding:"14px 16px"}}>
                    <p style={{color:C.greenLight,margin:0,fontWeight:"bold"}}>✓ Your vote has been recorded!</p>
                    <p style={{color:C.muted,fontSize:"0.78rem",margin:"4px 0 0"}}>Voting is locked — one vote per member.</p>
                  </div>
                  <Results/>
                </div>
              ) : (
                <div>
                  {isAdmin&&<div style={{marginBottom:"20px"}}><Results/><hr style={{borderColor:C.border,margin:"20px 0"}}/></div>}
                  <div style={{...cardSt,marginBottom:"20px"}}>
                    <h3 style={{color:C.accentLight,fontSize:"0.88rem",letterSpacing:"0.06em",margin:"0 0 10px"}}>STEP 1 — RANK THE LOGOS</h3>
                    <p style={{color:C.muted,fontSize:"0.75rem",margin:"0 0 12px",lineHeight:"1.5"}}>Tap logos to rank them. Use ▲▼ to reorder. Tap image to enlarge.</p>
                    <RankList entries={LOGO_ENTRIES} ranking={logoRanking} setRanking={setLogoRanking} type="logo"/>
                  </div>
                  <div style={{...cardSt,marginBottom:"20px"}}>
                    <h3 style={{color:C.accentLight,fontSize:"0.88rem",letterSpacing:"0.06em",margin:"0 0 10px"}}>STEP 2 — RANK THE MOTTOS</h3>
                    <p style={{color:C.muted,fontSize:"0.75rem",margin:"0 0 12px",lineHeight:"1.5"}}>Tap mottos to rank them. Use ▲▼ to reorder.</p>
                    <RankList entries={MOTTO_ENTRIES} ranking={mottoRanking} setRanking={setMottoRanking} type="motto"/>
                  </div>
                  <button onClick={submitVote} style={{...btnSt(),padding:"12px 32px",fontSize:"0.9rem",width:"100%"}}>Submit My Vote 🗳</button>
                </div>
              )}
            </div>
          );
        })()}

        {tab==="record"&&isAdmin&&(
          <div>
            <h2 style={{color:C.cream,fontSize:"1rem",letterSpacing:"0.06em",marginBottom:"12px",borderBottom:`1px solid ${C.border}`,paddingBottom:"8px"}}>Record Week Results</h2>
            <div style={{...cardSt,marginBottom:"12px"}}>
              <div style={{display:"flex",flexDirection:"column",gap:"10px"}}>
                <div><label style={lbSt}>WEEK #</label><select style={inputSt} value={gameWeek} onChange={e=>handleWeekChange(e.target.value)}>{weekOptions.map(w=><option key={w} value={w}>Week {w}</option>)}</select></div>
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
            {groups.map((grp,gi)=>(
              <div key={grp.id} style={{...cardSt,marginBottom:"10px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"8px"}}>
                  <span style={{color:C.accentLight,fontWeight:"bold",fontSize:"0.85rem"}}>Group {gi+1}</span>
                  {groups.length>1&&<button onClick={()=>removeGroup(grp.id)} style={{background:"none",border:`1px solid ${C.red}`,color:C.red,borderRadius:"4px",padding:"2px 8px",cursor:"pointer",fontSize:"0.72rem",fontFamily:"Georgia,serif"}}>Remove</button>}
                </div>
                {grp.players.map((row,ri)=>{
                  const pts=row.position?calcPoints(parseInt(row.position),grp.players.length):"—";
                  return(
                    <div key={ri} style={{display:"grid",gridTemplateColumns:"1fr 100px 40px 26px",gap:"6px",marginBottom:"6px",alignItems:"center"}}>
                      <select style={inputSt} value={row.playerId} onChange={e=>updateGroupRow(grp.id,ri,"playerId",e.target.value)}><option value="">Player…</option>{players.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
                      <select style={inputSt} value={row.position} onChange={e=>updateGroupRow(grp.id,ri,"position",e.target.value)}><option value="">Place…</option>{Array.from({length:grp.players.length},(_,i)=>i+1).map(n=><option key={n} value={n}>{n}{n===1?"st":n===2?"nd":n===3?"rd":"th"}</option>)}</select>
                      <div style={{textAlign:"center",color:C.accent,fontWeight:"bold",fontSize:"0.85rem"}}>{pts}</div>
                      <button onClick={()=>removeRowFromGroup(grp.id,ri)} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:"1rem",padding:"2px"}}>✕</button>
                    </div>
                  );
                })}
                <button onClick={()=>addRowToGroup(grp.id)} style={{...btnSt(C.green,true),padding:"6px 12px",fontSize:"0.75rem",marginTop:"4px"}}>+ Add Player</button>
              </div>
            ))}
            <button onClick={addGroup} style={{...btnSt(C.blue,true),marginBottom:"16px"}}>+ Add Group</button>
            <div style={{...cardSt,marginBottom:"16px",borderColor:C.gold+"55"}}>
              <div style={{display:"flex",alignItems:"center",gap:"6px",marginBottom:"10px"}}><span style={{fontSize:"1rem"}}>⭐</span><span style={{color:C.gold,fontWeight:"bold",fontSize:"0.85rem"}}>Shot of the Day</span><span style={{color:C.muted,fontSize:"0.72rem"}}>+1 bonus pt each</span></div>
              {sotdEntries.map((row,i)=>(
                <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 80px 26px",gap:"6px",marginBottom:"6px",alignItems:"center"}}>
                  <select style={inputSt} value={row.playerId} onChange={e=>updateSotdRow(i,"playerId",e.target.value)}><option value="">Player…</option>{players.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
                  <input style={inputSt} type="number" min="1" max="10" value={row.count} onChange={e=>updateSotdRow(i,"count",e.target.value)} placeholder="# awards"/>
                  <button onClick={()=>removeSotdRow(i)} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:"1rem",padding:"2px"}}>✕</button>
                </div>
              ))}
              <button onClick={addSotdRow} style={{...btnSt(C.gold),padding:"6px 12px",fontSize:"0.75rem"}}>+ Add SOTD</button>
            </div>
            <button onClick={submitGames} style={{...btnSt(),padding:"12px",fontSize:"0.9rem",width:"100%"}}>Submit Week {gameWeek} Results</button>
          </div>
        )}

        {tab==="history"&&isAdmin&&(
          <div>
            <h2 style={{color:C.cream,fontSize:"1rem",letterSpacing:"0.06em",marginBottom:"12px",borderBottom:`1px solid ${C.border}`,paddingBottom:"8px"}}>Score History — tap to edit</h2>
            {players.length===0&&<p style={{color:C.muted}}>No data yet.</p>}
            {Array.from({length:maxWk},(_,i)=>maxWk-i).map(wk=>{
              const hasData=players.some(p=>(weeklyGames[p.id]?.[wk]||[]).length>0);
              if(!hasData) return null;
              return(
                <div key={wk} style={{marginBottom:"16px"}}>
                  <div style={{color:C.accentLight,fontSize:"0.8rem",fontWeight:"bold",letterSpacing:"0.1em",marginBottom:"6px"}}>WEEK {wk}</div>
                  <div style={{display:"flex",flexDirection:"column",gap:"4px"}}>
                    {players.map(p=>(weeklyGames[p.id]?.[wk]||[]).map((g,gi)=>(
                      <div key={`${p.id}-${gi}`} onClick={()=>openEdit(p.id,wk,gi,g)}
                        style={{...cardSt,padding:"9px 12px",display:"flex",alignItems:"center",gap:"8px",cursor:"pointer"}}>
                        <span style={{color:C.cream,fontSize:"0.85rem",fontWeight:"bold",flex:1}}>{p.name}</span>
                        <span style={{color:C.muted,fontSize:"0.72rem",background:C.surface,padding:"1px 6px",borderRadius:"4px"}}>{g.label}</span>
                        <span style={{color:C.muted,fontSize:"0.72rem"}}>{g.absent?"Absent":g.position?`${g.position}/${g.groupSize}`:"—"}</span>
                        <span style={{color:C.accent,fontWeight:"bold",fontSize:"0.85rem"}}>{g.pts}pt</span>
                        {g.sotd>0&&<span style={{color:C.gold,fontSize:"0.78rem"}}>⭐+{g.sotd}</span>}
                        <span style={{color:C.muted,fontSize:"0.7rem"}}>✎</span>
                      </div>
                    )))}
                  </div>
                </div>
              );
            })}
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
                        <label style={lbSt}>JOINED WEEK</label>
                        <select style={{...inputSt,width:"auto",padding:"4px 8px",fontSize:"0.78rem"}} value={profileWeek} onChange={e=>{setProfileWeek(parseInt(e.target.value));saveProfileWeek(e.target.value);}}>
                          {weekOptions.map(w=><option key={w} value={w}>Week {w}</option>)}
                        </select>
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
                    <button onClick={()=>removePlayer(p.id)} style={{background:"none",border:`1px solid ${C.red}`,color:C.red,borderRadius:"4px",padding:"3px 8px",cursor:"pointer",fontSize:"0.72rem",fontFamily:"Georgia,serif"}}>Remove</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
// ── Commissioner-only overlays ──────────────────────────────────────────────

function CommissionerOverlays({tab, user, setTab}) {
  if(user?.role!=="superadmin") return null;
  const backBtn = (
    <button
      onClick={()=>setTab("standings")}
      style={{position:"absolute",top:8,right:8,zIndex:510,
        background:"rgba(0,0,0,0.75)",color:"#e8d080",
        border:"1px solid #2a4a2a",borderRadius:6,
        padding:"5px 14px",cursor:"pointer",
        fontFamily:"Georgia,serif",fontSize:12,letterSpacing:1}}>
      ← League
    </button>
  );
  if(tab==="minigame") return(
    <div style={{position:"fixed",inset:0,zIndex:500}}>
      {backBtn}
      <CroquetGame
        currentPlayer={{id:"commissioner",name:"Commissioner"}}
        isCommissioner={true}/>
    </div>
  );
  if(tab==="tracer") return(
    <div style={{position:"fixed",inset:0,zIndex:500}}>
      {backBtn}
      <ParkTracer/>
    </div>
  );
  return null;
}