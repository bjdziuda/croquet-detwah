// src/ParkTracer.jsx
import { useState, useRef, useEffect, useCallback } from "react";

function normalizePixels(pts, worldW=760, worldH=960, margin=40) {
  const xs=pts.map(p=>p.x), ys=pts.map(p=>p.y);
  const x0=Math.min(...xs),x1=Math.max(...xs);
  const y0=Math.min(...ys),y1=Math.max(...ys);
  const pxW=x1-x0||1, pxH=y1-y0||1;
  const avW=worldW-margin*2, avH=worldH-margin*2;
  const sc=Math.min(avW/pxW, avH/pxH);
  const ox=margin+(avW-pxW*sc)/2, oy=margin+(avH-pxH*sc)/2;
  return pts.map(p=>({x:Math.round(ox+(p.x-x0)*sc),y:Math.round(oy+(p.y-y0)*sc)}));
}

function buildOutput(pts, name) {
  const id=name.toLowerCase().replace(/[^a-z0-9]+/g,'_');
  const xs=pts.map(p=>p.x), ys=pts.map(p=>p.y);
  const cx=Math.round((Math.min(...xs)+Math.max(...xs))/2);
  const sy=Math.max(...ys)-80, fy=Math.min(...ys)+80;
  const rows=[];
  for(let i=0;i<pts.length;i+=5)
    rows.push(pts.slice(i,i+5).map(p=>`{x:${p.x},y:${p.y}}`).join(', '));
  return `  {\n    id:"${id}", name:"${name}", icon:"🏞️",\n    bounds:{w:760,h:960},\n    startPeg:{x:${cx},y:${sy}}, finishPeg:{x:${cx},y:${fy}},\n    perimeter:[\n      ${rows.join(',\n      ')},\n    ],\n  },`;
}

export default function ParkTracer() {
  const canvasRef=useRef(null); const imgRef=useRef(null); const fileRef=useRef(null);
  const ptsRef=useRef([]); const closedRef=useRef(false);
  const zoomRef=useRef(1); const panRef=useRef({x:0,y:0}); const dragRef=useRef(null);

  const [imgLoaded,setImgLoaded]=useState(false);
  const [pts,setPts]=useState([]); const [closed,setClosed]=useState(false);
  const [zoom,setZoom]=useState(1); const [output,setOutput]=useState(null);
  const [copied,setCopied]=useState(false); const [parkName,setParkName]=useState("My Park");
  const [dropping,setDropping]=useState(false);

  const draw=useCallback(()=>{
    const canvas=canvasRef.current; if(!canvas)return;
    const ctx=canvas.getContext("2d"); const W=canvas.width,H=canvas.height;
    ctx.clearRect(0,0,W,H); ctx.fillStyle="#1a2a1a"; ctx.fillRect(0,0,W,H);
    const z=zoomRef.current,pan=panRef.current;
    if(imgRef.current){const iw=imgRef.current.naturalWidth,ih=imgRef.current.naturalHeight;ctx.drawImage(imgRef.current,W/2+pan.x-iw*z/2,H/2+pan.y-ih*z/2,iw*z,ih*z);}
    const tp=ptsRef.current,cl=closedRef.current; if(!tp.length)return;
    const toS=(ix,iy)=>[canvasRef.current.width/2+panRef.current.x+ix*zoomRef.current,canvasRef.current.height/2+panRef.current.y+iy*zoomRef.current];
    const spts=tp.map(p=>toS(p.x,p.y));
    if(cl&&spts.length>=3){ctx.beginPath();ctx.moveTo(spts[0][0],spts[0][1]);spts.slice(1).forEach(([x,y])=>ctx.lineTo(x,y));ctx.closePath();ctx.fillStyle="rgba(232,208,128,0.2)";ctx.fill();ctx.strokeStyle="#e8d080";ctx.lineWidth=3;ctx.setLineDash([]);ctx.stroke();}
    if(!cl&&spts.length>=2){ctx.beginPath();ctx.moveTo(spts[0][0],spts[0][1]);spts.slice(1).forEach(([x,y])=>ctx.lineTo(x,y));ctx.strokeStyle="#e8d080";ctx.lineWidth=3;ctx.setLineDash([9,5]);ctx.lineCap="round";ctx.stroke();ctx.setLineDash([]);}
    spts.forEach(([sx,sy],i)=>{
      const isFirst=i===0,canClose=isFirst&&tp.length>=3&&!cl;
      if(canClose){ctx.beginPath();ctx.arc(sx,sy,20,0,Math.PI*2);ctx.strokeStyle="rgba(232,208,128,0.4)";ctx.lineWidth=2;ctx.setLineDash([3,3]);ctx.stroke();ctx.setLineDash([]);}
      ctx.beginPath();ctx.arc(sx,sy,isFirst?10:6,0,Math.PI*2);ctx.fillStyle=isFirst?"#e8d080":"#b8e050";ctx.strokeStyle="rgba(0,0,0,0.6)";ctx.lineWidth=2;ctx.fill();ctx.stroke();
      if(!isFirst&&tp.length>4){ctx.fillStyle="rgba(0,0,0,0.75)";ctx.font="bold 8px Georgia";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(i+1,sx,sy);}
      const lbl=(txt,x,y)=>{ctx.font="bold 11px Georgia";ctx.textAlign="center";ctx.textBaseline="middle";ctx.strokeStyle="rgba(0,0,0,0.85)";ctx.lineWidth=3;ctx.strokeText(txt,x,y);ctx.fillStyle="#e8d080";ctx.fillText(txt,x,y);};
      if(isFirst)lbl("START",sx,sy+26);
      if(canClose)lbl("← click to close",sx,sy-28);
    });
    if(tp.length&&!cl){ctx.font="12px Georgia";ctx.textAlign="left";ctx.textBaseline="top";ctx.fillStyle="rgba(232,208,128,0.8)";ctx.fillText(`${tp.length} pts`,10,10);}
  },[]);

  const reDraw=useCallback(()=>requestAnimationFrame(draw),[draw]);
  useEffect(()=>{reDraw();},[pts,closed,zoom,reDraw]);

  const loadBlob=useCallback((blob)=>{
    const url=URL.createObjectURL(blob); const img=new Image();
    img.onload=()=>{
      imgRef.current=img; ptsRef.current=[];closedRef.current=false;
      setPts([]);setClosed(false);setOutput(null);setCopied(false);setImgLoaded(true);
      const canvas=canvasRef.current;if(!canvas)return;
      const sc=Math.min(canvas.width/img.naturalWidth,canvas.height/img.naturalHeight)*0.95;
      zoomRef.current=sc;setZoom(sc);panRef.current={x:0,y:0};
      setTimeout(reDraw,50);URL.revokeObjectURL(url);
    };
    img.src=url;
  },[reDraw]);

  useEffect(()=>{
    const fn=(e)=>{const item=[...(e.clipboardData?.items||[])].find(i=>i.type.startsWith("image/"));if(item){e.preventDefault();loadBlob(item.getAsFile());}};
    window.addEventListener("paste",fn);return()=>window.removeEventListener("paste",fn);
  },[loadBlob]);

  useEffect(()=>{
    const over=(e)=>{e.preventDefault();setDropping(true);};
    const leave=(e)=>{if(!e.relatedTarget)setDropping(false);};
    const drop=(e)=>{e.preventDefault();setDropping(false);const file=[...(e.dataTransfer?.files||[])].find(f=>f.type.startsWith("image/"));if(file)loadBlob(file);};
    window.addEventListener("dragover",over);window.addEventListener("dragleave",leave);window.addEventListener("drop",drop);
    return()=>{window.removeEventListener("dragover",over);window.removeEventListener("dragleave",leave);window.removeEventListener("drop",drop);};
  },[loadBlob]);

  const getXY=(e)=>{const c=canvasRef.current;if(!c)return null;const r=c.getBoundingClientRect();const s=e.touches?e.touches[0]:e;return[(s.clientX-r.left)*(c.width/r.width),(s.clientY-r.top)*(c.height/r.height)];};
  const canvasToImg=(cx,cy)=>{const z=zoomRef.current,p=panRef.current,c=canvasRef.current;return{x:(cx-c.width/2-p.x)/z,y:(cy-c.height/2-p.y)/z};};
  const imgToCanvas=(ix,iy)=>{const z=zoomRef.current,p=panRef.current,c=canvasRef.current;return[c.width/2+p.x+ix*z,c.height/2+p.y+iy*z];};

  const onDown=(e)=>{if(!imgLoaded)return;const xy=getXY(e);if(!xy)return;dragRef.current={start:xy,pan:{...panRef.current},moved:false};};
  const onMove=(e)=>{if(!dragRef.current)return;const xy=getXY(e);if(!xy)return;const dx=xy[0]-dragRef.current.start[0],dy=xy[1]-dragRef.current.start[1];if(Math.sqrt(dx*dx+dy*dy)>4)dragRef.current.moved=true;panRef.current={x:dragRef.current.pan.x+dx,y:dragRef.current.pan.y+dy};reDraw();};
  const onUp=(e)=>{const d=dragRef.current;dragRef.current=null;if(!d||d.moved||closedRef.current||!imgLoaded)return;const xy=getXY(e);if(!xy)return;const ip=canvasToImg(xy[0],xy[1]);const tp=ptsRef.current;if(tp.length>=3){const[fsx,fsy]=imgToCanvas(tp[0].x,tp[0].y);if(Math.sqrt((xy[0]-fsx)**2+(xy[1]-fsy)**2)<22){doClose();return;}}const np=[...tp,ip];ptsRef.current=np;setPts([...np]);};

  useEffect(()=>{const c=canvasRef.current;if(!c)return;const fn=(e)=>{e.preventDefault();const nz=Math.max(0.05,Math.min(20,zoomRef.current*(e.deltaY<0?1.12:1/1.12)));zoomRef.current=nz;setZoom(nz);reDraw();};c.addEventListener("wheel",fn,{passive:false});return()=>c.removeEventListener("wheel",fn);},[reDraw]);

  const doClose=()=>{const tp=ptsRef.current;if(tp.length<3)return;closedRef.current=true;setClosed(true);setOutput(buildOutput(normalizePixels(tp),parkName.trim()||"My Park"));reDraw();};
  const doUndo=()=>{if(closedRef.current)return;const np=ptsRef.current.slice(0,-1);ptsRef.current=np;setPts([...np]);};
  const doReset=()=>{ptsRef.current=[];closedRef.current=false;setPts([]);setClosed(false);setOutput(null);setCopied(false);reDraw();};
  const doFit=()=>{const c=canvasRef.current,img=imgRef.current;if(!c||!img)return;const sc=Math.min(c.width/img.naturalWidth,c.height/img.naturalHeight)*0.95;zoomRef.current=sc;setZoom(sc);panRef.current={x:0,y:0};reDraw();};
  const copy=()=>{navigator.clipboard.writeText(output).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2500);});};

  const btn=(active=false,danger=false)=>({background:danger?"#3a1010":active?"#1e4a1e":"#172512",color:danger?"#ff8080":active?"#e8d080":"#c0d0b0",border:`1.5px solid ${danger?"#6a2020":active?"#50a050":"#2a4020"}`,borderRadius:5,padding:"5px 12px",cursor:"pointer",fontSize:12,fontFamily:"Georgia,serif",whiteSpace:"nowrap",flexShrink:0});

  return(
    <div style={{fontFamily:"Georgia,serif",background:"#0a120a",height:"100%",display:"flex",flexDirection:"column",overflow:"hidden",position:"relative"}}>
      {dropping&&<div style={{position:"absolute",inset:0,zIndex:100,background:"rgba(10,40,10,0.92)",display:"flex",alignItems:"center",justifyContent:"center",border:"4px dashed #50a050",pointerEvents:"none"}}><div style={{color:"#e8d080",fontSize:22,fontWeight:"bold"}}>Drop image here</div></div>}

      <div style={{background:"#060c06",borderBottom:"1px solid #1a341a",padding:"6px 12px",flexShrink:0,display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
        <span style={{color:"#e8d080",fontSize:13,fontWeight:"bold",letterSpacing:2,flexShrink:0}}>🗺 Park Tracer</span>
        <button style={{...btn(),border:"1.5px solid #50a050",color:"#e8d080",background:"#1e4a1e"}} onClick={()=>fileRef.current?.click()}>📁 Load Image</button>
        <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>{const f=e.target.files?.[0];if(f){loadBlob(f);e.target.value="";}}}/>
        <input value={parkName} onChange={e=>setParkName(e.target.value)} placeholder="Park name"
          style={{background:"#0d1a0e",border:"1px solid #2a4a2a",borderRadius:4,padding:"4px 8px",color:"#e8d080",fontSize:12,fontFamily:"Georgia,serif",width:120}}/>
        {imgLoaded&&<>
          <button style={{...btn(),padding:"4px 9px"}} onClick={()=>{zoomRef.current=Math.min(20,zoomRef.current*1.2);setZoom(zoomRef.current);reDraw();}}>＋</button>
          <button style={{...btn(),padding:"4px 9px"}} onClick={()=>{zoomRef.current=Math.max(0.05,zoomRef.current/1.2);setZoom(zoomRef.current);reDraw();}}>－</button>
          <button style={{...btn(),padding:"4px 9px"}} onClick={doFit}>Fit</button>
          <span style={{color:"#608060",fontSize:11}}>{Math.round(zoom*100)}%</span>
          {!closed&&pts.length>0&&<button style={btn()} onClick={doUndo}>↩ Undo</button>}
          {!closed&&pts.length>=3&&<button style={btn(true)} onClick={doClose}>⬡ Close</button>}
          {(pts.length>0||output)&&<button style={btn(false,true)} onClick={doReset}>✕</button>}
          {pts.length>0&&<span style={{color:"#608060",fontSize:11}}>{pts.length} pts{closed?" ✓":""}</span>}
        </>}
      </div>

      <div style={{flex:1,position:"relative",minHeight:0}}>
        <canvas ref={canvasRef} width={1200} height={800}
          style={{width:"100%",height:"100%",display:"block",cursor:imgLoaded?(closed?"default":"crosshair"):"default"}}
          onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={()=>{dragRef.current=null;}}
          onTouchStart={onDown} onTouchMove={e=>{e.preventDefault();onMove(e);}} onTouchEnd={onUp}/>

        {!imgLoaded&&(
          <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:14,padding:20,pointerEvents:"none"}}>
            <div style={{fontSize:48}}>🗺</div>
            <div style={{color:"#e8d080",fontSize:17,fontWeight:"bold",letterSpacing:2,textAlign:"center"}}>Load a Park Screenshot</div>
            <div style={{display:"flex",gap:12,flexWrap:"wrap",justifyContent:"center"}}>
              {[["📁","Upload","Click Load Image above"],["⌘V","Paste","Screenshot then ⌘V / Ctrl+V"],["🖱","Drag & Drop","Drag image file onto window"]].map(([icon,title,desc])=>(
                <div key={title} style={{background:"#111e12",border:"2px solid #2a5a2a",borderRadius:10,padding:"14px 18px",textAlign:"center",maxWidth:170}}>
                  <div style={{fontSize:22,marginBottom:6,color:"#e8d080"}}>{icon} {title}</div>
                  <div style={{color:"#708870",fontSize:11,lineHeight:1.6}}>{desc}</div>
                </div>
              ))}
            </div>
            <div style={{color:"#2a5020",fontSize:11}}>Tip: use Google Maps satellite view zoomed into the park</div>
          </div>
        )}

        {imgLoaded&&!closed&&(
          <div style={{position:"absolute",bottom:10,left:"50%",transform:"translateX(-50%)",background:"rgba(0,0,0,0.82)",color:"#a0c890",fontSize:11,padding:"5px 16px",borderRadius:16,border:"1px solid #2a4a2a",pointerEvents:"none",whiteSpace:"nowrap"}}>
            {pts.length===0?"Click park edge to place points · scroll to zoom · drag to pan":pts.length<3?`${pts.length} pt${pts.length>1?"s":""} — keep going`:`${pts.length} pts — click first dot or ⬡ Close`}
          </div>
        )}
        {closed&&<div style={{position:"absolute",top:8,right:8,background:"rgba(0,0,0,0.8)",border:"1px solid #50a050",borderRadius:6,padding:"4px 12px",color:"#80d060",fontSize:11}}>✓ {pts.length} points traced</div>}
      </div>

      {output&&(
        <div style={{background:"#060c06",borderTop:"1px solid #1a341a",padding:"8px 12px",flexShrink:0}}>
          <div style={{display:"flex",gap:7,alignItems:"center",flexWrap:"wrap",marginBottom:5}}>
            <span style={{color:"#e8d080",fontSize:11}}>Paste into <code style={{color:"#80c080"}}>DETROIT_PARKS</code> in CroquetGame.jsx</span>
            <button style={btn(true)} onClick={copy}>{copied?"✓ Copied!":"📋 Copy"}</button>
            <button style={btn()} onClick={doReset}>↩ Trace Another</button>
          </div>
          <pre style={{background:"#0d1a0e",border:"1px solid #2a4a2a",borderRadius:4,padding:"6px 10px",fontSize:10,color:"#80c080",fontFamily:"'Courier New',monospace",maxHeight:110,overflowY:"auto",margin:0}}>{output}</pre>
        </div>
      )}
    </div>
  );
}
