import { useEffect, useRef, useState, useCallback } from "react";
import { doc, getDoc, setDoc, getDocs, deleteDoc, collection, query, orderBy } from "firebase/firestore";

// ─── DETROIT PARK BOUNDARIES ─────────────────────────────────────────────────
// Normalized from real OSM lat/lon boundaries. cos(lat) aspect correction applied.
// Each park fills the 760×960 court bounds — shape is what makes it recognizable.
const DETROIT_PARKS = [
  {
    id:"custom", name:"Custom (Blank)", icon:"✏️",
    bounds:{w:760,h:960},
    startPeg:{x:380,y:880}, finishPeg:{x:380,y:80},
    perimeter:[],
  },
];

// ─── COURSE ──────────────────────────────────────────────────────────────────
const DEFAULT_COURSE = {
  id:"custom", name:"New Course", bounds:{w:760,h:960},
  startPeg:{x:380,y:880}, finishPeg:{x:380,y:80},
  wickets:[], obstacles:[], perimeter:[], zones:[],
};

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const CW=620,CH=420,BALL_R=9,FRICTION=0.979,MIN_SPEED=0.13;
const MAX_DRAG_W=130,MAX_POWER=20,WALL_T=6;
const WICKET_HALF=22,WICKET_POST=6,SUBSTEPS=5,CAM_SMOOTH=0.072;
const TRAIL_MAX=200,HIT_RADIUS=32;

// ─── GEOMETRY ────────────────────────────────────────────────────────────────
const d2=(ax,ay,bx,by)=>Math.sqrt((ax-bx)**2+(ay-by)**2);
function segClosest(px,py,ax,ay,bx,by){
  const dx=bx-ax,dy=by-ay,L=dx*dx+dy*dy;
  if(!L)return{x:ax,y:ay};
  const t=Math.max(0,Math.min(1,((px-ax)*dx+(py-ay)*dy)/L));
  return{x:ax+t*dx,y:ay+t*dy};
}
function reflect(vx,vy,nx,ny,rest=0.62){
  const dot=vx*nx+vy*ny;
  return{vx:(vx-2*dot*nx)*rest,vy:(vy-2*dot*ny)*rest};
}
function wicketPosts(w){
  const r=(w.angle*Math.PI)/180;
  return[
    {x:w.x-Math.cos(r)*WICKET_HALF,y:w.y-Math.sin(r)*WICKET_HALF},
    {x:w.x+Math.cos(r)*WICKET_HALF,y:w.y+Math.sin(r)*WICKET_HALF},
  ];
}
function wicketSide(bx,by,w){
  const r=(w.angle*Math.PI)/180;
  return(bx-w.x)*(-Math.sin(r))+(by-w.y)*Math.cos(r);
}
function inGateLane(bx,by,w){
  const r=(w.angle*Math.PI)/180;
  return Math.abs((bx-w.x)*Math.cos(r)+(by-w.y)*Math.sin(r))<WICKET_HALF-WICKET_POST*0.5+2;
}
// eslint-disable-next-line no-unused-vars
function rectHit(rx,ry,rw,rh,px,py){return px>=rx&&px<=rx+rw&&py>=ry&&py<=ry+rh;}

// Point-in-rotated-ellipse test
function inEllipse(px,py,cx,cy,rx,ry,angle){
  const cos=Math.cos(-angle),sin=Math.sin(-angle);
  const dx=px-cx,dy=py-cy;
  const lx=dx*cos-dy*sin,ly=dx*sin+dy*cos;
  return (lx*lx)/(rx*rx)+(ly*ly)/(ry*ry)<=1;
}
function camTarget(ball,nextIdx,course){
  const tgt=nextIdx<course.wickets.length?course.wickets[nextIdx]:course.finishPeg;
  const mx=ball.x*0.38+tgt.x*0.62,my=ball.y*0.38+tgt.y*0.62;
  const dist=d2(ball.x,ball.y,tgt.x,tgt.y);
  return{x:mx,y:my,scale:Math.min(2.6,Math.max(0.52,280/Math.max(dist,70)))};
}
const w2c=(wx,wy,cam)=>({cx:CW/2+(wx-cam.x)*cam.scale,cy:CH/2+(wy-cam.y)*cam.scale});
const c2w=(cx,cy,cam)=>({x:cam.x+(cx-CW/2)/cam.scale,y:cam.y+(cy-CH/2)/cam.scale});

// ─── SHARED DRAW FUNCTIONS ───────────────────────────────────────────────────
function drawCourt(ctx,course,cam){
  const{w,h}=course.bounds;
  const sc=cam.scale;
  const hasPoly=course.perimeter&&course.perimeter.length>2;
  const rng=(seed)=>{let s=seed;return()=>{s=(s*1664525+1013904223)&0xffffffff;return(s>>>0)/0xffffffff;};};

  const courtPath=()=>{
    ctx.beginPath();
    if(hasPoly){
      const fp=w2c(course.perimeter[0].x,course.perimeter[0].y,cam);
      ctx.moveTo(fp.cx,fp.cy);
      course.perimeter.slice(1).forEach(pt=>{const p=w2c(pt.x,pt.y,cam);ctx.lineTo(p.cx,p.cy);});
    } else {
      const tl=w2c(0,0,cam),tr=w2c(w,0,cam),br=w2c(w,h,cam),bl=w2c(0,h,cam);
      ctx.moveTo(tl.cx,tl.cy);ctx.lineTo(tr.cx,tr.cy);ctx.lineTo(br.cx,br.cy);ctx.lineTo(bl.cx,bl.cy);
    }
    ctx.closePath();
  };

  // ── Rough uncut background ────────────────────────────────────────────────
  ctx.fillStyle="#2e5828"; ctx.fillRect(0,0,CW,CH);

  // Rough grass — longer, more varied tufts outside the court
  const randOuter=rng(42);
  ctx.save();
  for(let i=0;i<500;i++){
    const gx=randOuter()*CW, gy=randOuter()*CH;
    const gl=4+randOuter()*9, ga=(randOuter()-.15)*Math.PI;
    const bright=randOuter()>.6;
    ctx.strokeStyle=`rgba(${bright?45:25},${bright?95:65},${bright?20:10},${0.5+randOuter()*.35})`;
    ctx.lineWidth=0.7+randOuter()*.9;
    ctx.beginPath(); ctx.moveTo(gx,gy);
    ctx.lineTo(gx+Math.cos(ga)*gl,gy+Math.sin(ga)*gl); ctx.stroke();
  }
  ctx.restore();

  // ── Court lawn ────────────────────────────────────────────────────────────
  ctx.save();
  courtPath();
  ctx.shadowColor="rgba(0,0,0,0.5)"; ctx.shadowBlur=22;
  ctx.fillStyle="#5aaa48"; ctx.fill(); ctx.shadowBlur=0;
  ctx.clip();

  // Mow stripes — alternating light/dark bands
  for(let sy=0;sy<h;sy+=60){
    const p1=w2c(0,sy,cam),p2=w2c(w,sy,cam),p3=w2c(w,sy+60,cam),p4=w2c(0,sy+60,cam);
    ctx.beginPath(); ctx.moveTo(p1.cx,p1.cy); ctx.lineTo(p2.cx,p2.cy);
    ctx.lineTo(p3.cx,p3.cy); ctx.lineTo(p4.cx,p4.cy); ctx.closePath();
    ctx.fillStyle=Math.floor(sy/60)%2===0?"rgba(0,0,0,0.07)":"rgba(255,255,255,0.04)"; ctx.fill();
  }

  // ── Grass tufts scattered across the court ────────────────────────────────
  // Seeded so they don't flicker. Drawn in world coords, clipped to court.
  const randG=rng(137);
  const tufts=Math.round(500*cam.scale*cam.scale); // more tufts when zoomed in
  for(let i=0;i<Math.min(tufts,800);i++){
    // Distribute tufts across world space
    const wx2=randG()*w, wy2=randG()*h;
    const sp=w2c(wx2,wy2,cam);
    const bladeCount=2+Math.floor(randG()*3); // 2-4 blades per tuft
    for(let b=0;b<bladeCount;b++){
      const offsetX=(randG()-.5)*5*cam.scale;
      const offsetY=(randG()-.5)*5*cam.scale;
      const bx=sp.cx+offsetX, by=sp.cy+offsetY;
      const angle=-Math.PI*0.5+(randG()-.5)*1.1; // mostly upward, some lean
      const len=(2+randG()*4)*cam.scale;
      const curl=(randG()-.5)*0.6; // blade curl at tip
      const bright=randG()>.55;
      const alpha=0.25+randG()*.35;
      ctx.strokeStyle=bright
        ?`rgba(100,180,60,${alpha})`
        :`rgba(40,110,30,${alpha})`;
      ctx.lineWidth=Math.max(0.4,0.6*cam.scale);
      ctx.beginPath();
      ctx.moveTo(bx,by);
      // Slightly curved blade
      ctx.quadraticCurveTo(
        bx+Math.cos(angle+curl)*len*0.5,
        by+Math.sin(angle+curl)*len*0.5,
        bx+Math.cos(angle+curl)*len,
        by+Math.sin(angle+curl)*len
      );
      ctx.stroke();
    }
    // Occasional darker shadow patch at tuft base
    if(randG()>.7){
      ctx.fillStyle=`rgba(0,0,0,${0.06+randG()*.06})`;
      ctx.beginPath(); ctx.ellipse(sp.cx,sp.cy,3*cam.scale,1.5*cam.scale,0,0,Math.PI*2);
      ctx.fill();
    }
  }

  ctx.restore();

  // ── Ragged grass fringe along court edge ──────────────────────────────────
  const perimPts = hasPoly
    ? course.perimeter.map(pt=>w2c(pt.x,pt.y,cam))
    : (()=>{const tl=w2c(0,0,cam),tr=w2c(w,0,cam),br=w2c(w,h,cam),bl=w2c(0,h,cam);return[tl,tr,br,bl,tl];})();
  const rand2=rng(99);
  ctx.save();
  for(let seg=0;seg<perimPts.length-1;seg++){
    const pa=perimPts[seg],pb=perimPts[seg+1];
    const segLen=d2(pa.cx,pa.cy,pb.cx,pb.cy);
    const steps=Math.round(segLen/5);
    if(steps<1)continue;
    const nx=-(pb.cy-pa.cy)/Math.max(1,segLen);
    const ny= (pb.cx-pa.cx)/Math.max(1,segLen);
    for(let i=0;i<steps;i++){
      const t2=i/steps;
      const ex=pa.cx+(pb.cx-pa.cx)*t2, ey=pa.cy+(pb.cy-pa.cy)*t2;
      const jitter=(rand2()-.5)*3;
      const inset=0+rand2()*2, len=5+rand2()*8;
      const lean=(rand2()-.5)*0.7;
      const bright=rand2()>.5;
      ctx.strokeStyle=`rgba(${bright?35:20},${bright?90:60},${bright?18:10},${0.45+rand2()*.4})`;
      ctx.lineWidth=0.7+rand2()*.7;
      ctx.beginPath();
      ctx.moveTo(ex+nx*inset+jitter,ey+ny*inset);
      ctx.quadraticCurveTo(
        ex+nx*(inset+len*.5)+lean*4, ey+ny*(inset+len*.5)+lean*4,
        ex+nx*(inset+len)+jitter*1.5, ey+ny*(inset+len)
      );
      ctx.stroke();
    }
  }
  ctx.restore();

  // ── Boundary line ─────────────────────────────────────────────────────────
  courtPath();
  ctx.strokeStyle="rgba(255,255,255,0.88)"; ctx.lineWidth=Math.max(2,2.5*sc); ctx.stroke();
}

// Seeded RNG for stable noise
function seededRng(seed){
  let s=seed;
  return ()=>{s=(s*1664525+1013904223)&0xffffffff;return(s>>>0)/0xffffffff;};
}

// Draw a soft organic blob polygon (for pond shape)
// pts control points around an ellipse with noise offsets
function blobPath(ctx,cx,cy,rx,ry,angle,seed,noiseFactor=0.18,pts=14){
  const rng=seededRng(seed);
  ctx.beginPath();
  for(let i=0;i<pts;i++){
    const a=(i/pts)*Math.PI*2;
    const noise=1+(rng()-.5)*noiseFactor*2;
    const lx=Math.cos(a)*rx*noise, ly=Math.sin(a)*ry*noise;
    const cosA=Math.cos(angle),sinA=Math.sin(angle);
    const x=cx+lx*cosA-ly*sinA, y=cy+lx*sinA+ly*cosA;
    i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
  }
  ctx.closePath();
}

function drawObstacles(ctx,course,cam){
  for(const obs of course.obstacles){

    // ── TREE ──────────────────────────────────────────────────────────────────
    if(obs.type==="tree"){
      const p=w2c(obs.x,obs.y,cam),r=obs.r*cam.scale;
      const rng=seededRng(obs.x*31+obs.y*17);

      // Ground shadow
      ctx.save();ctx.globalAlpha=0.25;
      ctx.beginPath();ctx.ellipse(p.cx+r*.5,p.cy+r*.6,r*1.05,r*.42,0.4,0,Math.PI*2);
      ctx.fillStyle="#1a3010";ctx.fill();ctx.restore();

      // Trunk
      const tw=Math.max(2,r*.16),th=Math.max(3,r*.28);
      const tg=ctx.createLinearGradient(p.cx-tw,p.cy,p.cx+tw,p.cy);
      tg.addColorStop(0,"#3a1e06");tg.addColorStop(0.4,"#6b3a12");tg.addColorStop(1,"#3a1e06");
      ctx.fillStyle=tg;ctx.fillRect(p.cx-tw/2,p.cy-th*.3,tw,th);

      // Canopy blobs — offset positions seeded from position
      const blobs=[
        {ox:0,oy:0,rs:1.0},
        {ox:(rng()-.5)*r*.5,oy:(rng()-.5)*r*.35,rs:0.68+rng()*.1},
        {ox:(rng()-.5)*r*.5,oy:(rng()-.5)*r*.35,rs:0.60+rng()*.1},
        {ox:(rng()-.5)*r*.4,oy:-r*.2-rng()*r*.15,rs:0.55+rng()*.08},
        {ox:(rng()-.5)*r*.3,oy:(rng()-.5)*r*.3,rs:0.50+rng()*.08},
      ];
      blobs.forEach(({ox,oy,rs},bi)=>{
        const bx=p.cx+ox,by=p.cy+oy,br=r*rs;
        const g=ctx.createRadialGradient(bx-br*.3,by-br*.35,br*.05,bx,by,br);
        g.addColorStop(0,bi===0?"#62c048":"#52b038");
        g.addColorStop(0.5,bi===0?"#3d8830":"#2f7028");
        g.addColorStop(1,"#1a4a12");
        ctx.beginPath();ctx.arc(bx,by,br,0,Math.PI*2);ctx.fillStyle=g;ctx.fill();
      });

      // Outline
      ctx.beginPath();ctx.arc(p.cx,p.cy,r,0,Math.PI*2);
      ctx.strokeStyle="rgba(15,40,8,0.45)";ctx.lineWidth=Math.max(0.8,r*.05);ctx.stroke();

      // Sunlit highlight NW
      const hg=ctx.createRadialGradient(p.cx-r*.28,p.cy-r*.32,0,p.cx-r*.25,p.cy-r*.3,r*.4);
      hg.addColorStop(0,"rgba(150,240,100,0.42)");hg.addColorStop(1,"rgba(150,240,100,0)");
      ctx.beginPath();ctx.arc(p.cx-r*.25,p.cy-r*.3,r*.4,0,Math.PI*2);ctx.fillStyle=hg;ctx.fill();

    // ── WATER (pond — organic blob) ───────────────────────────────────────────
    } else if(obs.type==="water"){
      const p=w2c(obs.x,obs.y,cam);
      const rx=(obs.rx||obs.w/2||40)*cam.scale;
      const ry=(obs.ry||obs.h/2||28)*cam.scale;
      const ang=obs.angle||0;

      // Shore shadow
      ctx.save();ctx.globalAlpha=0.22;
      blobPath(ctx,p.cx+rx*.08,p.cy+ry*.12,rx*1.08,ry*1.08,ang,obs.x+7,0.22);
      ctx.fillStyle="#0a2030";ctx.fill();ctx.restore();

      // Water body — shallow to deep
      const wg=ctx.createRadialGradient(p.cx-rx*.2,p.cy-ry*.15,rx*.05,p.cx,p.cy,Math.max(rx,ry));
      wg.addColorStop(0,"#5db5d8");wg.addColorStop(0.4,"#2f80b8");wg.addColorStop(1,"#153d6a");
      blobPath(ctx,p.cx,p.cy,rx,ry,ang,obs.x,0.2);
      ctx.fillStyle=wg;ctx.fill();

      // Shore edge highlight
      blobPath(ctx,p.cx,p.cy,rx,ry,ang,obs.x,0.2);
      ctx.strokeStyle="rgba(100,190,240,0.45)";ctx.lineWidth=Math.max(1.5,2*cam.scale);ctx.stroke();

      // Shimmer lines — 3 short curved streaks
      ctx.save();
      blobPath(ctx,p.cx,p.cy,rx,ry,ang,obs.x,0.2);
      ctx.clip();
      ctx.strokeStyle="rgba(200,240,255,0.35)";ctx.lineWidth=Math.max(0.8,cam.scale);
      for(let i=0;i<3;i++){
        const sx=p.cx-rx*.4+rx*.4*i,sy=p.cy-ry*.2+ry*.2*i;
        const sw=rx*.3+rx*.1*i;
        ctx.beginPath();ctx.moveTo(sx,sy);
        ctx.bezierCurveTo(sx+sw*.3,sy-3*cam.scale,sx+sw*.7,sy+2*cam.scale,sx+sw,sy);ctx.stroke();
      }
      ctx.restore();

    // ── SLOPE (mound — rotated ellipse with topo lines) ───────────────────────
    } else if(obs.type==="slope"){
      const p=w2c(obs.x,obs.y,cam);
      const rx=(obs.rx||obs.w/2||50)*cam.scale;
      const ry=(obs.ry||obs.h/2||30)*cam.scale;
      // angle: direction the slope falls toward (downhill)
      const ang=obs.angle!==undefined?obs.angle:Math.atan2(obs.dy||0,obs.dx||0);

      // Soft shadow
      ctx.save();ctx.globalAlpha=0.18;
      ctx.beginPath();ctx.ellipse(p.cx+rx*.12,p.cy+ry*.18,rx*1.05,ry*1.05,ang,0,Math.PI*2);
      ctx.fillStyle="#1a2a08";ctx.fill();ctx.restore();

      // Terrain fill — gradient uphill=bright, downhill=dark
      const upX=Math.cos(ang+Math.PI),upY=Math.sin(ang+Math.PI);
      const tg=ctx.createLinearGradient(
        p.cx+upX*rx,p.cy+upY*ry,
        p.cx-upX*rx,p.cy-upY*ry
      );
      tg.addColorStop(0,"rgba(210,230,150,0.75)");
      tg.addColorStop(0.45,"rgba(130,170,80,0.6)");
      tg.addColorStop(1,"rgba(40,70,20,0.7)");
      ctx.beginPath();ctx.ellipse(p.cx,p.cy,rx,ry,ang,0,Math.PI*2);
      ctx.fillStyle=tg;ctx.fill();

      // Topo contour lines — concentric ellipses
      ctx.save();
      ctx.beginPath();ctx.ellipse(p.cx,p.cy,rx,ry,ang,0,Math.PI*2);ctx.clip();
      ctx.strokeStyle="rgba(80,110,40,0.3)";ctx.lineWidth=Math.max(0.5,0.7*cam.scale);
      const rings=4;
      for(let i=1;i<rings;i++){
        const s=i/rings;
        ctx.beginPath();ctx.ellipse(p.cx,p.cy,rx*s,ry*s,ang,0,Math.PI*2);ctx.stroke();
      }
      ctx.restore();

      // Outer rim
      ctx.beginPath();ctx.ellipse(p.cx,p.cy,rx,ry,ang,0,Math.PI*2);
      ctx.strokeStyle="rgba(140,180,70,0.5)";ctx.lineWidth=Math.max(1,1.2*cam.scale);ctx.stroke();

      // Downhill arrow
      const arL=Math.min(rx,ry)*.5;
      const ax=p.cx+Math.cos(ang)*arL,ay=p.cy+Math.sin(ang)*arL;
      ctx.strokeStyle="rgba(240,220,80,0.9)";ctx.fillStyle="rgba(240,220,80,0.9)";
      ctx.lineWidth=Math.max(1.2,1.6*cam.scale);
      ctx.beginPath();ctx.moveTo(p.cx,p.cy);ctx.lineTo(ax,ay);ctx.stroke();
      const as=Math.max(4,5*cam.scale);
      ctx.save();ctx.translate(ax,ay);ctx.rotate(ang);
      ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(-as,-as*.45);ctx.lineTo(-as,as*.45);
      ctx.closePath();ctx.fill();ctx.restore();
    // ── IMAGE OBJECT ──────────────────────────────────────────────────────────
    } else if(obs.type==="image"&&obs.src){
      const p=w2c(obs.x,obs.y,cam);
      const img=getImg(obs.src);
      if(img.complete&&img.naturalWidth){
        const w=(obs.w||80)*cam.scale, h=(obs.h||80)*cam.scale;
        ctx.save();
        ctx.translate(p.cx,p.cy);
        ctx.rotate(obs.angle||0);
        ctx.globalAlpha=obs.opacity||1;
        ctx.drawImage(img,-w/2,-h/2,w,h);
        ctx.globalAlpha=1;
        ctx.restore();
      }
    }
  }
}

function drawPeg(ctx,peg,label,cam,glowing,t){
  const p=w2c(peg.x,peg.y,cam),sc=cam.scale;
  const pw=Math.max(6,9*sc),ph=Math.max(18,30*sc);
  if(glowing){
    const pulse=Math.sin(t/350)*.5+.5;
    ctx.beginPath();ctx.arc(p.cx,p.cy-ph*.5,(pw+12+pulse*7)*.9,0,Math.PI*2);
    ctx.strokeStyle=`rgba(255,220,50,${.25+pulse*.35})`;ctx.lineWidth=3;ctx.stroke();
  }
  ctx.beginPath();ctx.ellipse(p.cx+2,p.cy+3,pw*.7,pw*.3,0,0,Math.PI*2);
  ctx.fillStyle="rgba(0,0,0,0.3)";ctx.fill();
  ["#cc2020","#eeeeee","#1a44cc","#eeeeee","#cc2020"].forEach((c,i)=>{
    ctx.fillStyle=c;ctx.fillRect(p.cx-pw/2,p.cy-ph+i*(ph/5),pw,ph/5+.5);
  });
  ctx.strokeStyle="#111";ctx.lineWidth=Math.max(1,1.2*sc);ctx.strokeRect(p.cx-pw/2,p.cy-ph,pw,ph);
  ctx.font=`bold ${Math.max(9,10*sc)}px Georgia`;ctx.textAlign="center";ctx.textBaseline="middle";
  ctx.strokeStyle="#000";ctx.lineWidth=3;ctx.strokeText(label,p.cx,p.cy-ph-10*sc);
  ctx.fillStyle="#fff";ctx.fillText(label,p.cx,p.cy-ph-10*sc);
}

function drawWicket(ctx,w,passed,active,cam){
  const posts=wicketPosts(w),sc=cam.scale;
  const wireW=Math.max(1.4,2.2*sc),shadowW=wireW+Math.max(0.8,1.4*sc);
  const hoopH=Math.max(14,28*sc),arcR=Math.max(6,WICKET_HALF*sc*0.48);
  const wireCol=passed?"#3aaa3a":active?"#f0f0e8":"#d4d0c0";
  const pc0=w2c(posts[0].x,posts[0].y,cam),pc1=w2c(posts[1].x,posts[1].y,cam);
  const top0={cx:pc0.cx,cy:pc0.cy-hoopH},top1={cx:pc1.cx,cy:pc1.cy-hoopH};
  const midCx=(top0.cx+top1.cx)/2,midCy=(top0.cy+top1.cy)/2-arcR*0.55;
  if(active){
    const gp=w2c(w.x,w.y,cam);
    ctx.beginPath();ctx.arc(gp.cx,gp.cy-hoopH*.5,WICKET_HALF*sc+10,0,Math.PI*2);
    ctx.fillStyle="rgba(255,255,160,0.09)";ctx.fill();
  }
  const hoopPath=()=>{
    ctx.beginPath();ctx.moveTo(pc0.cx,pc0.cy);ctx.lineTo(top0.cx,top0.cy);
    ctx.quadraticCurveTo(midCx,midCy,top1.cx,top1.cy);ctx.lineTo(pc1.cx,pc1.cy);
  };
  ctx.save();ctx.translate(Math.max(1.5,2.5*sc),Math.max(1,2*sc));hoopPath();
  ctx.strokeStyle="rgba(0,0,0,0.22)";ctx.lineWidth=shadowW;ctx.lineCap="round";ctx.lineJoin="round";
  ctx.stroke();ctx.restore();
  hoopPath();
  ctx.strokeStyle=wireCol;ctx.lineWidth=wireW;ctx.lineCap="round";ctx.lineJoin="round";ctx.stroke();
  ctx.beginPath();ctx.moveTo(top0.cx,top0.cy-wireW*.3);
  ctx.quadraticCurveTo(midCx,midCy-wireW*.5,top1.cx,top1.cy-wireW*.3);
  ctx.strokeStyle=passed?"rgba(160,255,160,.55)":active?"rgba(255,255,255,.65)":"rgba(255,255,255,.28)";
  ctx.lineWidth=Math.max(0.6,wireW*.38);ctx.stroke();
  [pc0,pc1].forEach(pc=>{
    ctx.beginPath();ctx.arc(pc.cx,pc.cy,Math.max(1.5,2.2*sc),0,Math.PI*2);
    ctx.fillStyle=passed?"#2a8a2a":active?"#ccc8b8":"#b0ac9c";ctx.fill();
  });
  const mp=w2c(w.x,w.y,cam),badgeY=midCy-Math.max(7,9*sc),br2=Math.max(7,8*sc);
  ctx.beginPath();ctx.arc(mp.cx,badgeY,br2,0,Math.PI*2);
  ctx.fillStyle=passed?"rgba(20,70,20,.82)":active?"rgba(30,28,18,.88)":"rgba(20,20,16,.72)";
  ctx.fill();ctx.strokeStyle=passed?"#40b040":active?"#d4cc60":"#666";ctx.lineWidth=1;ctx.stroke();
  ctx.fillStyle=passed?"#70e870":active?"#eeea80":"#a8a898";
  ctx.font=`${Math.max(6,8*sc)}px Georgia`;ctx.textAlign="center";ctx.textBaseline="middle";
  ctx.fillText(passed?"✓":w.id,mp.cx,badgeY);
}

// Image cache — load once, draw every frame
const IMG_CACHE = new Map();
function getImg(src){
  if(IMG_CACHE.has(src)) return IMG_CACHE.get(src);
  const img = new Image();
  img.src = src;
  IMG_CACHE.set(src, img);
  return img;
}

function drawBall(ctx,ball,cam,color="#d8d4c0"){
  const p=w2c(ball.x,ball.y,cam),r=BALL_R*cam.scale;
  // Shadow
  ctx.beginPath();ctx.ellipse(p.cx+r*.2,p.cy+r*.25,r*1.15,r*.42,0,0,Math.PI*2);
  ctx.fillStyle="rgba(0,0,0,0.32)";ctx.fill();
  // Parse color for gradient — lighten for top, darken for bottom
  const grad=ctx.createRadialGradient(p.cx-r*.35,p.cy-r*.38,r*.06,p.cx,p.cy,r);
  grad.addColorStop(0,"#ffffff");
  grad.addColorStop(0.28,color);
  grad.addColorStop(0.75,color);
  grad.addColorStop(1,"rgba(0,0,0,0.4)");
  ctx.beginPath();ctx.arc(p.cx,p.cy,r,0,Math.PI*2);ctx.fillStyle=grad;ctx.fill();
  ctx.strokeStyle="rgba(0,0,0,0.3)";ctx.lineWidth=Math.max(0.8,cam.scale*.7);ctx.stroke();
  // Specular
  ctx.beginPath();ctx.ellipse(p.cx-r*.3,p.cy-r*.33,r*.22,r*.16,-0.5,0,Math.PI*2);
  ctx.fillStyle="rgba(255,255,255,0.82)";ctx.fill();
}

function drawAim(ctx,s,cam){
  if(!s.dragStart||!s.dragCurrent)return 0;
  const bp=w2c(s.ball.x,s.ball.y,cam),dp=w2c(s.dragCurrent.x,s.dragCurrent.y,cam);
  const ddx=s.dragStart.x-s.dragCurrent.x,ddy=s.dragStart.y-s.dragCurrent.y;
  const pct=Math.min(Math.sqrt(ddx*ddx+ddy*ddy)/MAX_DRAG_W,1),angle=Math.atan2(ddy,ddx);
  ctx.save();
  ctx.strokeStyle="rgba(255,255,255,0.2)";ctx.lineWidth=1.5;ctx.setLineDash([3,6]);
  ctx.beginPath();ctx.moveTo(bp.cx,bp.cy);ctx.lineTo(dp.cx,dp.cy);ctx.stroke();ctx.setLineDash([]);
  const te=w2c(s.ball.x+Math.cos(angle)*(60+pct*260),s.ball.y+Math.sin(angle)*(60+pct*260),cam);
  const col=pct>.75?"rgba(220,55,55,.92)":pct>.42?"rgba(220,155,25,.92)":"rgba(90,220,90,.92)";
  ctx.strokeStyle=col;ctx.lineWidth=2.2;ctx.setLineDash([8,5]);
  ctx.beginPath();ctx.moveTo(bp.cx,bp.cy);ctx.lineTo(te.cx,te.cy);ctx.stroke();ctx.setLineDash([]);
  const aa=Math.atan2(te.cy-bp.cy,te.cx-bp.cx);
  ctx.save();ctx.translate(te.cx,te.cy);ctx.rotate(aa);
  ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(-9,-4.5);ctx.lineTo(-9,4.5);ctx.closePath();
  ctx.fillStyle=col;ctx.fill();ctx.restore();
  ctx.beginPath();ctx.arc(bp.cx,bp.cy,BALL_R*cam.scale+8+pct*6,0,Math.PI*2);
  ctx.strokeStyle=col.replace(".92",".38");ctx.lineWidth=2.2;ctx.stroke();
  ctx.restore();return Math.round(pct*100);
}

function drawTrail(ctx,trail,cam){
  for(let i=1;i<trail.length;i++){
    const a=w2c(trail[i-1].x,trail[i-1].y,cam),b=w2c(trail[i].x,trail[i].y,cam),prog=i/trail.length;
    ctx.beginPath();ctx.moveTo(a.cx,a.cy);ctx.lineTo(b.cx,b.cy);
    ctx.strokeStyle=`rgba(255,225,30,${prog*.6})`;ctx.lineWidth=Math.max(1,2*cam.scale*prog);ctx.stroke();
  }
}

function drawMinimap(ctx,course,ball,nextIdx,cam,trail){
  const mx=12,my=12,mw=68,mh=Math.round(mw*course.bounds.h/course.bounds.w);
  const scx=mw/course.bounds.w,scy=mh/course.bounds.h;
  ctx.fillStyle="rgba(0,0,0,0.52)";ctx.beginPath();ctx.roundRect(mx-3,my-3,mw+6,mh+6,4);ctx.fill();
  ctx.strokeStyle="rgba(255,255,255,0.18)";ctx.lineWidth=1;ctx.stroke();
  ctx.fillStyle="#5a9e4a";ctx.fillRect(mx,my,mw,mh);
  for(let i=1;i<trail.length;i++){
    const a=trail[i-1],b=trail[i];ctx.beginPath();
    ctx.moveTo(mx+a.x*scx,my+a.y*scy);ctx.lineTo(mx+b.x*scx,my+b.y*scy);
    ctx.strokeStyle=`rgba(255,225,30,${(i/trail.length)*.65})`;ctx.lineWidth=1;ctx.stroke();
  }
  course.wickets.forEach((w,i)=>{
    ctx.beginPath();ctx.arc(mx+w.x*scx,my+w.y*scy,2.5,0,Math.PI*2);
    ctx.fillStyle=i<nextIdx?"#50c050":i===nextIdx?"#ffff50":"#777";ctx.fill();
  });
  [[course.startPeg,"#aaa"],[course.finishPeg,"#f0c030"]].forEach(([pg,c])=>{
    ctx.beginPath();ctx.arc(mx+pg.x*scx,my+pg.y*scy,3,0,Math.PI*2);ctx.fillStyle=c;ctx.fill();
  });
  ctx.beginPath();ctx.arc(mx+ball.x*scx,my+ball.y*scy,3.5,0,Math.PI*2);
  ctx.fillStyle="#fff";ctx.fill();ctx.strokeStyle="#333";ctx.lineWidth=.8;ctx.stroke();
  const vx=mx+(cam.x-CW/(2*cam.scale))*scx,vy=my+(cam.y-CH/(2*cam.scale))*scy;
  ctx.strokeStyle="rgba(255,255,100,.5)";ctx.lineWidth=1;
  ctx.strokeRect(vx,vy,(CW/cam.scale)*scx,(CH/cam.scale)*scy);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SURFACE ZONES
// ═══════════════════════════════════════════════════════════════════════════════
const SURFACE_TYPES = [
  {id:"none",    label:"None",     color:null},
  {id:"water",   label:"Water",    color:"#2a6898"},
  {id:"mound",   label:"Mound",    color:"#8aaa50"},
  {id:"gravel",  label:"Gravel",   color:"#a09070"},
  {id:"concrete",label:"Concrete", color:"#b0b0a8"},
];

function drawZones(ctx,course,cam){
  if(!course.zones) return;
  for(const zone of course.zones){
    if(!zone.points||zone.points.length<3) continue;
    const surf=SURFACE_TYPES.find(s=>s.id===zone.surface);
    if(!surf||!surf.color) continue;

    // Compute centroid and bounding radius for this zone
    const cx2=zone.points.reduce((s,p)=>s+p.x,0)/zone.points.length;
    const cy2=zone.points.reduce((s,p)=>s+p.y,0)/zone.points.length;
    const maxR=zone.points.reduce((m,p)=>Math.max(m,d2(p.x,p.y,cx2,cy2)),0);
    const cp=w2c(cx2,cy2,cam);
    const maxRpx=maxR*cam.scale;

    // Clip all drawing to the zone polygon (rounded or sharp)
    ctx.save();
    ctx.beginPath();
    const screenPts = zone.points.map(pt=>w2c(pt.x,pt.y,cam));
    if(zone.rounded && screenPts.length>=3){
      // Splined path — quadratic bezier through midpoints, vertices as control points
      const mid=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];
      const n=screenPts.length;
      const p=(i)=>[screenPts[((i%n)+n)%n].cx, screenPts[((i%n)+n)%n].cy];
      const m0=mid(p(n-1),p(0));
      ctx.moveTo(m0[0],m0[1]);
      for(let i=0;i<n;i++){
        const cp=p(i), mn=mid(p(i),p(i+1));
        ctx.quadraticCurveTo(cp[0],cp[1],mn[0],mn[1]);
      }
    } else {
      const fp2=screenPts[0];
      ctx.moveTo(fp2.cx,fp2.cy);
      screenPts.slice(1).forEach(pt=>ctx.lineTo(pt.cx,pt.cy));
    }
    ctx.closePath();
    ctx.clip();

    if(zone.surface==="water"){
      // Re-draw path for fill (clip already set)
      ctx.beginPath();
      ctx.moveTo(screenPts[0].cx,screenPts[0].cy);
      screenPts.slice(1).forEach(pt=>ctx.lineTo(pt.cx,pt.cy));
      ctx.closePath();
      const wg=ctx.createRadialGradient(cp.cx-maxRpx*.2,cp.cy-maxRpx*.15,maxRpx*.05,cp.cx,cp.cy,maxRpx*1.1);
      wg.addColorStop(0,"#72c8e8");wg.addColorStop(0.4,"#2f80b8");wg.addColorStop(1,"#0f3060");
      ctx.fillStyle=wg; ctx.fill();
      // Shimmer
      ctx.strokeStyle="rgba(200,240,255,0.3)"; ctx.lineWidth=Math.max(0.8,cam.scale);
      for(let i=0;i<3;i++){
        const sx=cp.cx-maxRpx*.3+maxRpx*.3*i, sy=cp.cy-maxRpx*.1+maxRpx*.1*i, sw=maxRpx*.4;
        ctx.beginPath();ctx.moveTo(sx,sy);
        ctx.bezierCurveTo(sx+sw*.3,sy-2*cam.scale,sx+sw*.7,sy+2*cam.scale,sx+sw,sy);ctx.stroke();
      }

    } else if(zone.surface==="mound"){
      // ── Multi-layer radial hill ───────────────────────────────────────────
      // Base grass colour — slightly yellower/browner than flat lawn
      ctx.fillStyle="rgba(80,130,45,0.9)";
      ctx.fillRect(cp.cx-maxRpx*1.5,cp.cy-maxRpx*1.5,maxRpx*3,maxRpx*3);

      // Main hill gradient — bright sunlit peak, dark shadowed base
      // Light source from upper-left
      const lightX=cp.cx-maxRpx*.18, lightY=cp.cy-maxRpx*.22;
      const mg=ctx.createRadialGradient(lightX,lightY,maxRpx*.03,cp.cx,cp.cy,maxRpx*1.08);
      mg.addColorStop(0.0,"rgba(240,255,180,0.92)"); // bright sunlit peak
      mg.addColorStop(0.12,"rgba(210,240,140,0.85)");
      mg.addColorStop(0.3, "rgba(165,215,90,0.8)");
      mg.addColorStop(0.55,"rgba(100,160,50,0.75)");
      mg.addColorStop(0.78,"rgba(55,110,25,0.7)");
      mg.addColorStop(1.0, "rgba(20,60,10,0.65)"); // dark shadowed base
      ctx.fillStyle=mg;
      ctx.fillRect(cp.cx-maxRpx*1.5,cp.cy-maxRpx*1.5,maxRpx*3,maxRpx*3);

      // Shadow wedge on the opposite side from light — gives 3D depth
      const shadowAngle=Math.PI*.25; // SE shadow (light from NW)
      const sg=ctx.createRadialGradient(
        cp.cx+Math.cos(shadowAngle)*maxRpx*.3, cp.cy+Math.sin(shadowAngle)*maxRpx*.3, maxRpx*.2,
        cp.cx+Math.cos(shadowAngle)*maxRpx*.6, cp.cy+Math.sin(shadowAngle)*maxRpx*.6, maxRpx
      );
      sg.addColorStop(0,"rgba(0,0,0,0)");
      sg.addColorStop(1,"rgba(0,20,0,0.38)");
      ctx.fillStyle=sg;
      ctx.fillRect(cp.cx-maxRpx*1.5,cp.cy-maxRpx*1.5,maxRpx*3,maxRpx*3);

      // Topo contour rings — concentric, elliptical to follow hill shape
      ctx.lineWidth=Math.max(0.5,0.8*cam.scale);
      const rings=6;
      for(let r=1;r<rings;r++){
        const frac=r/rings;
        // Rings shift slightly toward shadow side for realistic hill silhouette
        const offX=cp.cx+Math.cos(shadowAngle)*maxRpx*frac*.08;
        const offY=cp.cy+Math.sin(shadowAngle)*maxRpx*frac*.08;
        const alpha=0.12+frac*.1;
        ctx.strokeStyle=`rgba(40,80,15,${alpha})`;
        ctx.globalAlpha=1;
        ctx.beginPath();
        ctx.ellipse(offX,offY,maxRpx*frac,maxRpx*frac*.78,shadowAngle*.15,0,Math.PI*2);
        ctx.stroke();
      }

      // Grass texture streaks on the slope — follow the fall direction
      const randM=seededRng(zone.points[0].x*31+zone.points[0].y*17);
      ctx.lineWidth=Math.max(0.4,0.55*cam.scale);
      for(let i=0;i<60;i++){
        const a=randM()*Math.PI*2;
        const dist=randM()*maxRpx*.85;
        const sx=cp.cx+Math.cos(a)*dist, sy=cp.cy+Math.sin(a)*dist;
        // Blades lean away from center (downhill)
        const bladeAngle=a+(randM()-.5)*0.6;
        const blen=(1.5+randM()*3)*cam.scale;
        const alpha=0.15+randM()*.2;
        ctx.strokeStyle=`rgba(${randM()>.5?55:30},${randM()>.5?100:70},${20},${alpha})`;
        ctx.beginPath();
        ctx.moveTo(sx,sy);
        ctx.quadraticCurveTo(
          sx+Math.cos(bladeAngle)*blen*.5, sy+Math.sin(bladeAngle)*blen*.5,
          sx+Math.cos(bladeAngle)*blen, sy+Math.sin(bladeAngle)*blen
        );
        ctx.stroke();
      }

      // Sunlit highlight at peak — small soft glow
      const hg=ctx.createRadialGradient(lightX,lightY,0,lightX,lightY,maxRpx*.35);
      hg.addColorStop(0,"rgba(255,255,200,0.5)");
      hg.addColorStop(0.5,"rgba(255,255,200,0.12)");
      hg.addColorStop(1,"rgba(255,255,200,0)");
      ctx.fillStyle=hg;
      ctx.fillRect(cp.cx-maxRpx*1.5,cp.cy-maxRpx*1.5,maxRpx*3,maxRpx*3);
      ctx.globalAlpha=1;

    } else if(zone.surface==="gravel"){
      ctx.fillStyle="rgba(155,135,105,0.75)";
      ctx.fillRect(cp.cx-maxRpx*1.2,cp.cy-maxRpx*1.2,maxRpx*2.4,maxRpx*2.4);
      const rng=seededRng(zone.points[0].x*13+zone.points[0].y*7);
      ctx.fillStyle="rgba(80,65,45,0.35)";
      // Draw dots across the bounding box — clipping handles the shape
      const bb=zone.points.reduce((a,p)=>({minX:Math.min(a.minX,p.x),maxX:Math.max(a.maxX,p.x),minY:Math.min(a.minY,p.y),maxY:Math.max(a.maxY,p.y)}),{minX:Infinity,maxX:-Infinity,minY:Infinity,maxY:-Infinity});
      for(let i=0;i<60;i++){
        const gx=bb.minX+rng()*(bb.maxX-bb.minX), gy=bb.minY+rng()*(bb.maxY-bb.minY);
        const gp=w2c(gx,gy,cam);
        ctx.beginPath();ctx.arc(gp.cx,gp.cy,Math.max(0.8,1.3*cam.scale),0,Math.PI*2);ctx.fill();
      }

    } else if(zone.surface==="concrete"){
      ctx.fillStyle="rgba(168,168,158,0.8)";
      ctx.fillRect(cp.cx-maxRpx*1.2,cp.cy-maxRpx*1.2,maxRpx*2.4,maxRpx*2.4);
      ctx.strokeStyle="rgba(90,90,85,0.22)"; ctx.lineWidth=Math.max(0.5,0.7*cam.scale);
      const rng=seededRng(zone.points[0].x*7+zone.points[0].y*11);
      for(let i=0;i<4;i++){
        const ax=cp.cx+(rng()-.5)*maxRpx*1.6, ay=cp.cy+(rng()-.5)*maxRpx*1.6;
        const bx=ax+(rng()-.5)*maxRpx*.8, by=ay+(rng()-.5)*maxRpx*.8;
        ctx.beginPath();ctx.moveTo(ax,ay);ctx.lineTo(bx,by);ctx.stroke();
      }
    }

    ctx.restore(); // remove clip

    // Zone outline (drawn outside clip)
    ctx.save();
    ctx.beginPath();
    if(zone.rounded && screenPts.length>=3){
      const mid=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];
      const n=screenPts.length;
      const p2=(i)=>[screenPts[((i%n)+n)%n].cx, screenPts[((i%n)+n)%n].cy];
      const m0=mid(p2(n-1),p2(0));
      ctx.moveTo(m0[0],m0[1]);
      for(let i=0;i<n;i++){const cp=p2(i),mn=mid(p2(i),p2(i+1));ctx.quadraticCurveTo(cp[0],cp[1],mn[0],mn[1]);}
    } else {
      ctx.moveTo(screenPts[0].cx,screenPts[0].cy);
      screenPts.slice(1).forEach(pt=>ctx.lineTo(pt.cx,pt.cy));
    }
    ctx.closePath();
    ctx.strokeStyle = zone.surface==="water" ? "rgba(100,180,240,0.65)"
                    : zone.surface==="mound"  ? "rgba(120,170,60,0.55)"
                    : zone.surface==="gravel" ? "rgba(100,80,50,0.5)"
                    : "rgba(120,120,110,0.5)";
    ctx.lineWidth=Math.max(1,1.5*cam.scale);
    ctx.stroke();
    ctx.restore();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GAME
// ═══════════════════════════════════════════════════════════════════════════════
function GameView({course, onComplete}){
  const canvasRef=useRef(null),stateRef=useRef(null),animRef=useRef(null);
  const aimRef=useRef(null),phaseRef=useRef("aiming"),nextWRef=useRef(0);
  const camRef=useRef(null),trailRef=useRef([]);
  const drawRef=useRef(null),tickRef=useRef(null),aimTickRef=useRef(null);
  const ballColorRef=useRef("#e8e0c8");
  const[strokes,setStrokes]=useState(0);
  const[phase,setPhase]=useState("aiming");
  const[nextWicket,setNextWicket]=useState(0);
  const[message,setMessage]=useState(null);
  const[powerPct,setPowerPct]=useState(0);
  const[ballColor,setBallColor]=useState("#e8e0c8");

  useEffect(()=>{
    drawRef.current=(t=Date.now())=>{
      const canvas=canvasRef.current;if(!canvas)return;
      const ctx=canvas.getContext("2d"),s=stateRef.current,cam=camRef.current;
      if(!s||!cam)return;
      ctx.fillStyle="#2a5225";ctx.fillRect(0,0,CW,CH);
      drawCourt(ctx,course,cam);drawObstacles(ctx,course,cam);
      drawZones(ctx,course,cam);
      const cleared=course.wickets.slice(0,nextWRef.current);
      const nodes=[course.startPeg,...cleared];
      if(nodes.length>1){
        ctx.setLineDash([7,5]);ctx.strokeStyle="rgba(255,255,255,0.18)";ctx.lineWidth=1.2;
        for(let i=1;i<nodes.length;i++){
          const a=w2c(nodes[i-1].x,nodes[i-1].y,cam),b=w2c(nodes[i].x,nodes[i].y,cam);
          ctx.beginPath();ctx.moveTo(a.cx,a.cy);ctx.lineTo(b.cx,b.cy);ctx.stroke();
        }
        ctx.setLineDash([]);
      }
      drawTrail(ctx,trailRef.current,cam);
      const allDone=nextWRef.current>=course.wickets.length;
      drawPeg(ctx,course.startPeg,"START",cam,false,t);
      drawPeg(ctx,course.finishPeg,"FINISH",cam,allDone,t);
      [...course.wickets].sort((a,b)=>b.y-a.y).forEach(w=>{
        const i=course.wickets.indexOf(w);
        drawWicket(ctx,w,i<nextWRef.current,i===nextWRef.current,cam);
      });
      if(phaseRef.current==="aiming")setPowerPct(drawAim(ctx,s,cam)||0);
      else if(phaseRef.current!=="done")setPowerPct(0);
      drawBall(ctx,s.ball,cam,ballColorRef.current);
      drawMinimap(ctx,course,s.ball,nextWRef.current,cam,trailRef.current);
      if(allDone&&phaseRef.current!=="done"){
        const fp=w2c(course.finishPeg.x,course.finishPeg.y,cam);
        ctx.fillStyle=`rgba(255,230,50,${.65+Math.sin(t/220)*.3})`;
        ctx.font="bold 13px Georgia";ctx.textAlign="center";
        ctx.fillText("⬆  Hit the finish peg!",fp.cx,fp.cy-40*cam.scale);
      }
    };
  });

  const updateCam=useCallback(()=>{
    const s=stateRef.current;if(!s||!camRef.current)return;
    const tgt=camTarget(s.ball,nextWRef.current,course),cam=camRef.current;
    cam.x+=(tgt.x-cam.x)*CAM_SMOOTH;cam.y+=(tgt.y-cam.y)*CAM_SMOOTH;
    cam.scale+=(tgt.scale-cam.scale)*CAM_SMOOTH;
  },[course]);

  useEffect(()=>{
    aimTickRef.current=()=>{updateCam();drawRef.current?.(Date.now());aimRef.current=requestAnimationFrame(aimTickRef.current);};
  });
  useEffect(()=>{
    tickRef.current=()=>{
      const s=stateRef.current;if(!s||phaseRef.current!=="rolling")return;
      const ball=s.ball,dt=1/SUBSTEPS;
      for(let step=0;step<SUBSTEPS;step++){
        ball.x+=ball.vx*dt;ball.y+=ball.vy*dt;
        const{w,h}=course.bounds;
        for(const[x1,y1,x2,y2]of[[0,0,w,0],[w,0,w,h],[w,h,0,h],[0,h,0,0]]){
          const c=segClosest(ball.x,ball.y,x1,y1,x2,y2),dist=d2(ball.x,ball.y,c.x,c.y),minD=BALL_R+WALL_T/2;
          if(dist<minD&&dist>.001){
            const nx=(ball.x-c.x)/dist,ny=(ball.y-c.y)/dist,r=reflect(ball.vx,ball.vy,nx,ny);
            ball.vx=r.vx;ball.vy=r.vy;ball.x=c.x+nx*(minD+.5);ball.y=c.y+ny*(minD+.5);
          }
        }
        for(const obs of course.obstacles){
          if(obs.type==="tree"){
            const dist=d2(ball.x,ball.y,obs.x,obs.y),minD=BALL_R+obs.r;
            if(dist<minD&&dist>.001){
              const nx=(ball.x-obs.x)/dist,ny=(ball.y-obs.y)/dist,r=reflect(ball.vx,ball.vy,nx,ny,.5);
              ball.vx=r.vx;ball.vy=r.vy;ball.x=obs.x+nx*(minD+.5);ball.y=obs.y+ny*(minD+.5);
            }
          } else if(obs.type==="water"){
            const rx=obs.rx||obs.w/2||40, ry=obs.ry||obs.h/2||28, ang=obs.angle||0;
            if(inEllipse(ball.x,ball.y,obs.x,obs.y,rx+BALL_R,ry+BALL_R,ang)){
              ball.x=s.lastDryPos.x;ball.y=s.lastDryPos.y;ball.vx=0;ball.vy=0;
              setMessage("Water! +1 💦");setTimeout(()=>setMessage(null),1400);s._strokes++;setStrokes(s._strokes);
            }
          } else if(obs.type==="slope"){
            const rx=obs.rx||obs.w/2||50, ry=obs.ry||obs.h/2||30, ang=obs.angle!==undefined?obs.angle:Math.atan2(obs.dy||0,obs.dx||0);
            if(inEllipse(ball.x,ball.y,obs.x,obs.y,rx,ry,ang)){
              // Push ball downhill (in direction of ang)
              const force=0.06;
              ball.vx+=Math.cos(ang)*force*dt;ball.vy+=Math.sin(ang)*force*dt;
            }
          }
        }
        // Zone-based surface effects
        if(course.zones){
          for(const zone of course.zones){
            if(!zone.points||zone.points.length<3) continue;
            // Point-in-polygon test (ray casting)
            let inside=false;
            const pts=zone.points;
            for(let i=0,j=pts.length-1;i<pts.length;j=i++){
              const xi=pts[i].x,yi=pts[i].y,xj=pts[j].x,yj=pts[j].y;
              if(((yi>ball.y)!==(yj>ball.y))&&(ball.x<(xj-xi)*(ball.y-yi)/(yj-yi)+xi)) inside=!inside;
            }
            if(inside){
              if(zone.surface==="water"){
                ball.x=s.lastDryPos.x;ball.y=s.lastDryPos.y;ball.vx=0;ball.vy=0;
                setMessage("Water! +1 💦");setTimeout(()=>setMessage(null),1400);s._strokes++;setStrokes(s._strokes);
                break;
              } else if(zone.surface==="mound"){
                // Push ball outward from the centroid (rolling off a hill)
                const zcx=zone.points.reduce((s,p)=>s+p.x,0)/zone.points.length;
                const zcy=zone.points.reduce((s,p)=>s+p.y,0)/zone.points.length;
                const dx=ball.x-zcx, dy=ball.y-zcy;
                const distFromCenter=Math.sqrt(dx*dx+dy*dy)||1;
                // Force scales with how close to edge (stronger near edge)
                const maxR=zone.points.reduce((m,p)=>Math.max(m,d2(p.x,p.y,zcx,zcy)),0)||1;
                const frac=Math.min(distFromCenter/maxR,1);
                const force=0.04+frac*0.06; // gentle at peak, stronger at edges
                ball.vx+=(dx/distFromCenter)*force*dt;
                ball.vy+=(dy/distFromCenter)*force*dt;
              } else if(zone.surface==="gravel"){
                ball.vx*=Math.pow(0.96,dt);ball.vy*=Math.pow(0.96,dt);
              } else if(zone.surface==="concrete"){
                ball.vx*=Math.pow(1.008,dt);ball.vy*=Math.pow(1.008,dt);
              }
            }
          }
        }
        // Track last dry position — combine obstacle water + zone water
        let inZoneWater=false;
        if(course.zones){for(const zone of course.zones){if(zone.surface!=="water"||!zone.points||zone.points.length<3)continue;let ins=false;const pts=zone.points;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const xi=pts[i].x,yi=pts[i].y,xj=pts[j].x,yj=pts[j].y;if(((yi>ball.y)!==(yj>ball.y))&&(ball.x<(xj-xi)*(ball.y-yi)/(yj-yi)+xi))ins=!ins;}if(ins){inZoneWater=true;break;}}}
        const inObsWater=course.obstacles.some(o=>{
          if(o.type!=="water")return false;
          const rx=o.rx||o.w/2||40,ry=o.ry||o.h/2||28,ang=o.angle||0;
          return inEllipse(ball.x,ball.y,o.x,o.y,rx+BALL_R,ry+BALL_R,ang);
        });
        if(!inZoneWater&&!inObsWater) s.lastDryPos={x:ball.x,y:ball.y};
        course.wickets.forEach((w,i)=>{
          wicketPosts(w).forEach(p=>{
            const dist=d2(ball.x,ball.y,p.x,p.y),minD=BALL_R+WICKET_POST*.5;
            if(dist<minD&&dist>.001){
              const nx=(ball.x-p.x)/dist,ny=(ball.y-p.y)/dist,r=reflect(ball.vx,ball.vy,nx,ny,.5);
              ball.vx=r.vx;ball.vy=r.vy;ball.x=p.x+nx*(minD+.5);ball.y=p.y+ny*(minD+.5);
            }
          });
          if(i===nextWRef.current){
            const side=wicketSide(ball.x,ball.y,w),prev=s.wicketSides[i];
            if(prev===null){s.wicketSides[i]=side;}
            else if(Math.sign(side)!==Math.sign(prev)&&inGateLane(ball.x,ball.y,w)){
              nextWRef.current++;s.wicketSides[i]=side;setNextWicket(nextWRef.current);
              setMessage(`Wicket ${w.id} ✓`);setTimeout(()=>setMessage(null),1100);
            }else{s.wicketSides[i]=side;}
          }
        });
        if(nextWRef.current>=course.wickets.length&&d2(ball.x,ball.y,course.finishPeg.x,course.finishPeg.y)<14+BALL_R){
          phaseRef.current="done";setPhase("done");drawRef.current?.(Date.now());return;
        }
        const spd=d2(ball.x,ball.y,course.startPeg.x,course.startPeg.y);
        if(spd<10+BALL_R&&spd>.001){
          const nx=(ball.x-course.startPeg.x)/spd,ny=(ball.y-course.startPeg.y)/spd,r=reflect(ball.vx,ball.vy,nx,ny,.5);
          ball.vx=r.vx;ball.vy=r.vy;ball.x=course.startPeg.x+nx*(10+BALL_R+.5);ball.y=course.startPeg.y+ny*(10+BALL_R+.5);
        }
      }
      trailRef.current.push({x:ball.x,y:ball.y});
      if(trailRef.current.length>TRAIL_MAX)trailRef.current.shift();
      ball.vx*=FRICTION;ball.vy*=FRICTION;
      if(Math.sqrt(ball.vx**2+ball.vy**2)<MIN_SPEED){
        ball.vx=0;ball.vy=0;phaseRef.current="aiming";setPhase("aiming");
        cancelAnimationFrame(aimRef.current);aimRef.current=requestAnimationFrame(aimTickRef.current);
      }
      updateCam();drawRef.current?.(Date.now());animRef.current=requestAnimationFrame(tickRef.current);
    };
  });

  // Events — read all state from refs, registered once
  useEffect(()=>{
    const canvas=canvasRef.current;if(!canvas)return;

    // Get canvas-space coords from any event (clamped to canvas size)
    const getCP=(e)=>{
      const rect=canvas.getBoundingClientRect(),src=e.touches?e.touches[0]:e;
      // Allow drag OUTSIDE canvas — no clamping
      return{
        cx:(src.clientX-rect.left)*(CW/rect.width),
        cy:(src.clientY-rect.top)*(CH/rect.height)
      };
    };

    // ── Aiming ──────────────────────────────────────────────────────────────
    let isAiming=false;

    const onDown=(e)=>{
      if(phaseRef.current!=="aiming")return;
      const{cx,cy}=getCP(e),cam=camRef.current,ball=stateRef.current?.ball;
      if(!cam||!ball)return;
      const bp=w2c(ball.x,ball.y,cam);
      if(d2(cx,cy,bp.cx,bp.cy)>Math.max(28,HIT_RADIUS*cam.scale))return;
      e.preventDefault();
      isAiming=true;
      stateRef.current.dragStart={x:ball.x,y:ball.y};
      stateRef.current.dragCurrent=c2w(cx,cy,cam);
    };

    // Listen on window so drag works outside the canvas
    const onMoveWindow=(e)=>{
      if(!isAiming||phaseRef.current!=="aiming"||!stateRef.current?.dragStart)return;
      e.preventDefault();
      const{cx,cy}=getCP(e);
      stateRef.current.dragCurrent=c2w(cx,cy,camRef.current);
    };

    const onUpWindow=(e)=>{
      if(!isAiming)return;
      isAiming=false;
      const s=stateRef.current;
      if(phaseRef.current!=="aiming"||!s?.dragStart)return;
      const ddx=s.dragStart.x-s.dragCurrent.x,ddy=s.dragStart.y-s.dragCurrent.y;
      const pct=Math.min(Math.sqrt(ddx*ddx+ddy*ddy)/MAX_DRAG_W,1);
      s.dragStart=null;s.dragCurrent=null;
      if(pct<0.03){drawRef.current?.(Date.now());return;}
      s.ball.vx=Math.cos(Math.atan2(ddy,ddx))*pct*MAX_POWER;
      s.ball.vy=Math.sin(Math.atan2(ddy,ddx))*pct*MAX_POWER;
      s._strokes++;setStrokes(s._strokes);trailRef.current=[];
      phaseRef.current="rolling";setPhase("rolling");setPowerPct(0);
      cancelAnimationFrame(aimRef.current);cancelAnimationFrame(animRef.current);
      animRef.current=requestAnimationFrame(tickRef.current);
    };

    // ── Scroll to zoom ───────────────────────────────────────────────────────
    const onWheel=(e)=>{
      e.preventDefault();
      const cam=camRef.current; if(!cam)return;
      const rect=canvas.getBoundingClientRect();
      const mx=(e.clientX-rect.left)*(CW/rect.width);
      const my=(e.clientY-rect.top)*(CH/rect.height);
      const factor=e.deltaY<0?1.12:0.89;
      const newScale=Math.max(0.4,Math.min(3,cam.scale*factor));
      // Zoom toward mouse position
      cam.x=mx-(mx-cam.x*cam.scale)*newScale/cam.scale/newScale;
      cam.y=my-(my-cam.y*cam.scale)*newScale/cam.scale/newScale;
      cam.scale=newScale;
    };

    // ── Right-click / middle-click drag to pan ───────────────────────────────
    let panStart=null;
    const onMouseDown=(e)=>{
      if(e.button===1||e.button===2){
        e.preventDefault();
        const rect=canvas.getBoundingClientRect();
        panStart={
          mx:e.clientX,my:e.clientY,
          cx:camRef.current.x,cy:camRef.current.y
        };
      } else {
        onDown(e);
      }
    };
    const onMouseMove=(e)=>{
      if(panStart){
        const cam=camRef.current;
        const dx=(e.clientX-panStart.mx)*(CW/canvas.getBoundingClientRect().width);
        const dy=(e.clientY-panStart.my)*(CH/canvas.getBoundingClientRect().height);
        cam.x=panStart.cx+dx/cam.scale;
        cam.y=panStart.cy+dy/cam.scale;
        return;
      }
      onMoveWindow(e);
    };
    const onMouseUp=(e)=>{
      if(panStart){panStart=null;return;}
      onUpWindow(e);
    };

    // ── Pinch to zoom + two-finger pan ───────────────────────────────────────
    let lastPinchDist=null, lastPinchMid=null;
    const onTouchStart=(e)=>{
      if(e.touches.length===2){
        e.preventDefault();
        const t1=e.touches[0],t2=e.touches[1];
        lastPinchDist=Math.hypot(t2.clientX-t1.clientX,t2.clientY-t1.clientY);
        lastPinchMid=[(t1.clientX+t2.clientX)/2,(t1.clientY+t2.clientY)/2];
      } else {
        onDown(e);
      }
    };
    const onTouchMove=(e)=>{
      if(e.touches.length===2){
        e.preventDefault();
        const cam=camRef.current; if(!cam)return;
        const t1=e.touches[0],t2=e.touches[1];
        const dist=Math.hypot(t2.clientX-t1.clientX,t2.clientY-t1.clientY);
        const mid=[(t1.clientX+t2.clientX)/2,(t1.clientY+t2.clientY)/2];
        const rect=canvas.getBoundingClientRect();
        if(lastPinchDist&&dist>0){
          const factor=dist/lastPinchDist;
          const newScale=Math.max(0.4,Math.min(3,cam.scale*factor));
          const mx=(mid[0]-rect.left)*(CW/rect.width);
          const my=(mid[1]-rect.top)*(CH/rect.height);
          cam.x=mx-(mx-cam.x*cam.scale)*newScale/cam.scale/newScale;
          cam.y=my-(my-cam.y*cam.scale)*newScale/cam.scale/newScale;
          cam.scale=newScale;
        }
        lastPinchDist=dist; lastPinchMid=mid;
      } else {
        onMoveWindow(e);
      }
    };
    const onTouchEnd=(e)=>{
      lastPinchDist=null; lastPinchMid=null;
      onUpWindow(e);
    };

    canvas.addEventListener("mousedown",onMouseDown);
    canvas.addEventListener("wheel",onWheel,{passive:false});
    canvas.addEventListener("contextmenu",e=>e.preventDefault());
    canvas.addEventListener("touchstart",onTouchStart,{passive:false});
    canvas.addEventListener("touchmove",onTouchMove,{passive:false});
    canvas.addEventListener("touchend",onTouchEnd,{passive:false});
    window.addEventListener("mousemove",onMouseMove);
    window.addEventListener("mouseup",onMouseUp);

    return()=>{
      canvas.removeEventListener("mousedown",onMouseDown);
      canvas.removeEventListener("wheel",onWheel);
      canvas.removeEventListener("contextmenu",e=>e.preventDefault());
      canvas.removeEventListener("touchstart",onTouchStart);
      canvas.removeEventListener("touchmove",onTouchMove);
      canvas.removeEventListener("touchend",onTouchEnd);
      window.removeEventListener("mousemove",onMouseMove);
      window.removeEventListener("mouseup",onMouseUp);
    };
  },[]);

  const reset=useCallback(()=>{
    cancelAnimationFrame(animRef.current);cancelAnimationFrame(aimRef.current);
    stateRef.current={ball:{x:course.startPeg.x,y:course.startPeg.y-25,vx:0,vy:0},
      dragStart:null,dragCurrent:null,_strokes:0,
      wicketSides:course.wickets.map(()=>null),lastDryPos:{x:course.startPeg.x,y:course.startPeg.y-25}};
    camRef.current={x:course.startPeg.x,y:course.startPeg.y-80,scale:1.5};
    phaseRef.current="aiming";nextWRef.current=0;trailRef.current=[];
    setStrokes(0);setPhase("aiming");setNextWicket(0);setMessage(null);setPowerPct(0);
    aimRef.current=requestAnimationFrame(aimTickRef.current);
  },[course]);
  useEffect(()=>{reset();},[reset]);

  const totalWickets=course.wickets.length;
  return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6,padding:"8px 8px 4px",width:"100%",boxSizing:"border-box"}}>
      <div style={{position:"relative",borderRadius:6,overflow:"hidden",boxShadow:"0 8px 40px rgba(0,0,0,0.85),0 0 0 2px #2a5030",maxWidth:"100%"}}>
        <canvas ref={canvasRef} width={CW} height={CH} style={{display:"block",maxWidth:"100%",cursor:phase==="aiming"?"crosshair":"default"}}/>
        {powerPct>0&&<div style={{position:"absolute",bottom:8,left:"50%",transform:"translateX(-50%)",background:"rgba(0,0,0,0.8)",borderRadius:20,padding:"4px 14px",display:"flex",alignItems:"center",gap:8}}>
          <span style={{color:"#80b080",fontSize:10,letterSpacing:2}}>POWER</span>
          <div style={{width:100,height:5,background:"#0c200e",borderRadius:3,overflow:"hidden"}}>
            <div style={{width:`${powerPct}%`,height:"100%",borderRadius:3,background:powerPct>75?"#d03030":powerPct>45?"#c89020":"#30b850"}}/>
          </div>
          <span style={{color:"#e8d080",fontSize:11,minWidth:28}}>{powerPct}%</span>
        </div>}
        {message&&<div style={{position:"absolute",top:10,left:"50%",transform:"translateX(-50%)",background:"rgba(10,40,10,0.95)",border:"1px solid #50a050",borderRadius:6,padding:"5px 16px",color:"#80ff80",fontSize:12,fontWeight:"bold",whiteSpace:"nowrap",pointerEvents:"none"}}>{message}</div>}
        {phase==="done"&&<div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.82)",display:"flex",alignItems:"center",justifyContent:"center"}}>
          <div style={{background:"#0c1e10",border:"2px solid #50a050",borderRadius:14,padding:"24px 40px",textAlign:"center"}}>
            <div style={{fontSize:36,marginBottom:4}}>🏆</div>
            <h2 style={{color:"#e8d080",margin:"0 0 6px",fontSize:20,letterSpacing:2}}>Pegged Out!</h2>
            <p style={{color:"#80d060",margin:"0 0 18px",fontSize:28,fontWeight:"bold"}}>{strokes} strokes</p>
            <div style={{display:"flex",gap:8,justifyContent:"center"}}>
              <button onClick={reset} style={{background:"#172512",color:"#608060",border:"1px solid #2a4020",borderRadius:6,padding:"8px 18px",fontSize:12,cursor:"pointer",fontFamily:"Georgia,serif"}}>Play Again</button>
              {onComplete&&<button onClick={()=>onComplete(strokes)} style={{background:"#1e4a1e",color:"#e8d080",border:"1px solid #50a050",borderRadius:6,padding:"8px 18px",fontSize:13,cursor:"pointer",fontFamily:"Georgia,serif"}}>Submit Score 🏆</button>}
            </div>
          </div>
        </div>}
      </div>
      <div style={{display:"flex",gap:16,alignItems:"center",flexWrap:"wrap",justifyContent:"center"}}>
        <div style={{display:"flex",gap:20,color:"#608060",fontSize:12,letterSpacing:1}}>
          <span>Strokes <strong style={{color:"#e8d080"}}>{strokes}</strong></span>
          <span>Wickets <strong style={{color:"#e8d080"}}>{nextWicket}/{totalWickets}</strong></span>
        </div>
        {/* Zoom controls */}
        <div style={{display:"flex",gap:3,alignItems:"center"}}>
          <button onClick={()=>{const c=camRef.current;if(c)c.scale=Math.min(3,c.scale*1.2);}}
            style={{background:"#172512",color:"#80d080",border:"1px solid #2a4020",borderRadius:5,
              padding:"3px 9px",cursor:"pointer",fontFamily:"Georgia,serif",fontSize:14,lineHeight:1}}>+</button>
          <button onClick={()=>{const c=camRef.current;if(c)c.scale=Math.max(0.4,c.scale*0.83);}}
            style={{background:"#172512",color:"#80d080",border:"1px solid #2a4020",borderRadius:5,
              padding:"3px 9px",cursor:"pointer",fontFamily:"Georgia,serif",fontSize:14,lineHeight:1}}>−</button>
          <button onClick={()=>{
            if(!camRef.current||!course)return;
            const s=Math.min(CW/course.bounds.w,CH/course.bounds.h)*0.85;
            camRef.current.scale=s;
            camRef.current.x=course.bounds.w/2;
            camRef.current.y=course.bounds.h/2;
          }} style={{background:"#172512",color:"#608060",border:"1px solid #2a4020",borderRadius:5,
            padding:"3px 8px",cursor:"pointer",fontFamily:"Georgia,serif",fontSize:9,letterSpacing:1}}>
            FIT
          </button>
        </div>
        {/* Ball colour picker */}
        <div style={{display:"flex",alignItems:"center",gap:5}}>
          <span style={{color:"#3a6030",fontSize:10}}>BALL</span>
          {["#e8e0c8","#e8c84a","#e83030","#2050c8","#111111","#e04090","#30a030"].map(c=>(
            <button key={c} onClick={()=>{setBallColor(c);ballColorRef.current=c;}} style={{
              width:18,height:18,borderRadius:"50%",background:c,cursor:"pointer",
              border:`2px solid ${ballColor===c?"#fff":"rgba(255,255,255,0.2)"}`,
              boxShadow:ballColor===c?"0 0 0 2px #60a060":"none",
              padding:0,flexShrink:0,
            }}/>
          ))}
        </div>
      </div>
      <p style={{color:"#3a5c3a",fontSize:10,margin:0}}>Click &amp; drag the ball · Distance = power · Release to shoot</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// EDITOR CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════
const ED_CAM = {x:380,y:480,scale:0.36};

// Obstacle presets — trees only (water = zone fill, mound = zone fill)
const OBSTACLE_PRESETS = [
  {id:"tree-sm", icon:"🌲", label:"Tree S", obs:{type:"tree", r:18}},
  {id:"tree-md", icon:"🌳", label:"Tree M", obs:{type:"tree", r:30}},
  {id:"tree-lg", icon:"🌳", label:"Tree L", obs:{type:"tree", r:45}},
];

const TOOLS = [
  {id:"select", icon:"↖", label:"Select"},
  {id:"perim",  icon:"⬡", label:"Zone"},
  {id:"wicket", icon:"⌒", label:"Wicket"},
  {id:"start",  icon:"🏁", label:"Start"},
  {id:"finish", icon:"🏆", label:"Finish"},
  {id:"delete", icon:"✕", label:"Delete"},
];

// ═══════════════════════════════════════════════════════════════════════════════
// EDITOR COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
function EditorView({course, setCourse}){
  const canvasRef    = useRef(null);
  const rafRef       = useRef(null);

  // ── Refs (hot state — never stale in canvas events) ───────────────────────
  const toolRef         = useRef("select");
  const selectedRef     = useRef(null);
  const courseRef       = useRef(course);
  const setCourseRef    = useRef(setCourse);
  const angleRef        = useRef(0);
  const activePresetRef = useRef(null);   // currently selected OBSTACLE_PRESET id
  const rotatingRef     = useRef(false);
  const perimRef        = useRef([]);     // in-progress zone points
  const mouseRef        = useRef(null);
  const dragItemRef     = useRef(null);
  const pendingImgRef   = useRef(null);   // base64 src waiting to be placed
  const fileInputRef    = useRef(null);   // hidden file input for image upload
  const dragOffRef      = useRef(null);

  useEffect(()=>{courseRef.current=course;},[course]);
  useEffect(()=>{setCourseRef.current=setCourse;},[setCourse]);

  // ── React state (toolbar re-renders only) ─────────────────────────────────
  const [tool,         setToolState]  = useState("select");
  const [selected,     setSelState]   = useState(null);
  const [angle,        setAngleState] = useState(0);
  const [activePreset, setPresetState]= useState(null);
  const [zoneSurface,   setZoneSurface]  = useState("water");
  const [gridSnap,      setGridSnapState]= useState(0);
  const [zoneRounded,   setZoneRounded]  = useState(false);
  const [showJSON,     setShowJSON]   = useState(false);
  const [courseName,   setCourseName] = useState(course.name);

  const setTool   = t => { toolRef.current=t; setToolState(t); selectedRef.current=null; setSelState(null); perimRef.current=[]; };
  const setPreset = p => { activePresetRef.current=p; setPresetState(p); };
  const setAngle  = a => { angleRef.current=a; setAngleState(a); };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const getWP = e => {
    const canvas=canvasRef.current; if(!canvas) return null;
    const rect=canvas.getBoundingClientRect(), src=e.touches?e.touches[0]:e;
    return c2w((src.clientX-rect.left)*(CW/rect.width),(src.clientY-rect.top)*(CH/rect.height),ED_CAM);
  };

  const hitTest = (wx,wy,c) => {
    for(let i=c.wickets.length-1;i>=0;i--)
      if(d2(wx,wy,c.wickets[i].x,c.wickets[i].y)<32) return{type:"wicket",index:i};
    if(d2(wx,wy,c.startPeg.x,c.startPeg.y)<24) return{type:"startPeg"};
    if(d2(wx,wy,c.finishPeg.x,c.finishPeg.y)<24) return{type:"finishPeg"};
    for(let i=c.obstacles.length-1;i>=0;i--){
      const o=c.obstacles[i];
      let hit=false;
      if(o.type==="tree") hit=d2(wx,wy,o.x,o.y)<(o.r||30)+10;
      else if(o.type==="water") hit=inEllipse(wx,wy,o.x,o.y,(o.rx||40)+10,(o.ry||28)+10,o.angle||0);
      else if(o.type==="slope") hit=inEllipse(wx,wy,o.x,o.y,(o.rx||50)+10,(o.ry||30)+10,o.angle||0);
      else if(o.type==="image") hit=d2(wx,wy,o.x,o.y)<Math.max(o.w||80,o.h||80)/2+10;
      if(hit) return{type:"obstacle",index:i};
    }
    return null;
  };

  // ── RAF draw loop ─────────────────────────────────────────────────────────
  useEffect(()=>{
    const loop=()=>{
      const canvas=canvasRef.current; if(!canvas){rafRef.current=requestAnimationFrame(loop);return;}
      const ctx=canvas.getContext("2d"), c=courseRef.current, cam=ED_CAM, sel=selectedRef.current;

      ctx.fillStyle="#2a5225"; ctx.fillRect(0,0,CW,CH);
      drawCourt(ctx,c,cam);
      drawZones(ctx,c,cam);
      drawObstacles(ctx,c,cam);

      // Play-order guide lines
      const nodes=[c.startPeg,...c.wickets,c.finishPeg];
      ctx.setLineDash([5,5]); ctx.strokeStyle="rgba(255,255,255,0.12)"; ctx.lineWidth=1;
      for(let i=1;i<nodes.length;i++){
        const a=w2c(nodes[i-1].x,nodes[i-1].y,cam),b=w2c(nodes[i].x,nodes[i].y,cam);
        ctx.beginPath();ctx.moveTo(a.cx,a.cy);ctx.lineTo(b.cx,b.cy);ctx.stroke();
      }
      ctx.setLineDash([]);

      drawPeg(ctx,c.startPeg,"START",cam,false,Date.now());
      drawPeg(ctx,c.finishPeg,"FINISH",cam,false,Date.now());
      [...c.wickets].sort((a,b)=>b.y-a.y).forEach(w=>{
        const i=c.wickets.indexOf(w);
        drawWicket(ctx,w,false,sel?.type==="wicket"&&sel.index===i,cam);
      });

      // Selection ring + rotation handle
      if(sel){
        let sx,sy;
        if(sel.type==="wicket"){const w=c.wickets[sel.index];sx=w?.x;sy=w?.y;}
        else if(sel.type==="startPeg"){sx=c.startPeg.x;sy=c.startPeg.y;}
        else if(sel.type==="finishPeg"){sx=c.finishPeg.x;sy=c.finishPeg.y;}
        else if(sel.type==="obstacle"){sx=c.obstacles[sel.index]?.x;sy=c.obstacles[sel.index]?.y;}
        if(sx!=null){
          const sp=w2c(sx,sy,cam);
          ctx.beginPath();ctx.arc(sp.cx,sp.cy,22,0,Math.PI*2);
          ctx.strokeStyle="rgba(255,220,50,0.75)";ctx.lineWidth=2;ctx.setLineDash([4,3]);ctx.stroke();ctx.setLineDash([]);
          // Rotation handle for non-tree, non-image obstacles and images
          if(sel.type==="obstacle"){
            const o=c.obstacles[sel.index];
            if(o&&(o.type==="water"||o.type==="slope")){
              const handleR=Math.max((o.rx||40),(o.ry||28))*cam.scale+16;
              const hx=sp.cx+Math.cos(o.angle||0)*handleR;
              const hy=sp.cy+Math.sin(o.angle||0)*handleR;
              ctx.beginPath();ctx.arc(sp.cx,sp.cy,handleR,0,Math.PI*2);
              ctx.strokeStyle="rgba(255,220,50,0.18)";ctx.lineWidth=1;ctx.setLineDash([3,4]);ctx.stroke();ctx.setLineDash([]);
              ctx.beginPath();ctx.arc(hx,hy,7,0,Math.PI*2);
              ctx.fillStyle="rgba(255,220,50,0.9)";ctx.fill();
              ctx.strokeStyle="rgba(0,0,0,0.5)";ctx.lineWidth=1.5;ctx.stroke();
              ctx.fillStyle="#000";ctx.font="8px Georgia";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText("↻",hx,hy);
            } else if(o&&o.type==="image"){
              // Draw dashed bounding box around image
              const hw=(o.w||80)*cam.scale/2, hh=(o.h||80)*cam.scale/2;
              ctx.save();ctx.translate(sp.cx,sp.cy);ctx.rotate(o.angle||0);
              ctx.strokeStyle="rgba(255,220,50,0.7)";ctx.lineWidth=1.5;ctx.setLineDash([4,3]);
              ctx.strokeRect(-hw,-hh,hw*2,hh*2);ctx.setLineDash([]);
              // Rotation handle at top-right
              ctx.beginPath();ctx.arc(hw,-(hh),7,0,Math.PI*2);
              ctx.fillStyle="rgba(255,220,50,0.9)";ctx.fill();
              ctx.strokeStyle="rgba(0,0,0,0.5)";ctx.lineWidth=1.5;ctx.stroke();
              ctx.fillStyle="#000";ctx.font="8px Georgia";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText("↻",hw,-hh);
              ctx.restore();
            }
          }
        }
      }

      // In-progress zone polygon
      const pp=perimRef.current, mouse=mouseRef.current;
      if(pp.length>0){
        ctx.strokeStyle="rgba(255,255,120,0.85)";ctx.lineWidth=2;ctx.setLineDash([5,4]);
        ctx.beginPath();
        const fp=w2c(pp[0].x,pp[0].y,cam);ctx.moveTo(fp.cx,fp.cy);
        pp.slice(1).forEach(pt=>{const p=w2c(pt.x,pt.y,cam);ctx.lineTo(p.cx,p.cy);});
        if(mouse){const mp=w2c(mouse.x,mouse.y,cam);ctx.lineTo(mp.cx,mp.cy);}
        ctx.stroke();ctx.setLineDash([]);
        pp.forEach((pt,i)=>{
          const p=w2c(pt.x,pt.y,cam);
          ctx.beginPath();ctx.arc(p.cx,p.cy,i===0?7:4,0,Math.PI*2);
          ctx.fillStyle=i===0?"rgba(255,255,80,0.95)":"rgba(255,255,120,0.7)";ctx.fill();
          if(i===0&&pp.length>2){
            ctx.fillStyle="#000";ctx.font="bold 9px Georgia";ctx.textAlign="center";ctx.textBaseline="middle";
            ctx.fillText("✕",p.cx,p.cy);
          }
        });
      }

      // Hint bar
      const t=toolRef.current, preset=activePresetRef.current;
      const hint = preset ? `${OBSTACLE_PRESETS.find(p=>p.id===preset)?.icon} Click lawn to place · then Select to move/rotate`
        : t==="select" ? "Click to select · Drag to move · Drag ↻ to rotate"
        : t==="perim"  ? "Click to place zone points · click first ✕ dot to close"
        : t==="wicket" ? "Click to place wicket"
        : t==="start"  ? "Click to move start peg"
        : t==="finish" ? "Click to move finish peg"
        : t==="delete" ? "Click any item to delete"
        : "";
      ctx.fillStyle="rgba(0,0,0,0.5)";ctx.fillRect(0,CH-24,CW,24);
      ctx.fillStyle="rgba(200,220,200,0.65)";ctx.font="10px Georgia";
      ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(hint,CW/2,CH-12);

      rafRef.current=requestAnimationFrame(loop);
    };
    rafRef.current=requestAnimationFrame(loop);
    return()=>cancelAnimationFrame(rafRef.current);
  },[]);

  // zoneSurfaceRef must live before the canvas events closure that captures it
  const zoneSurfaceRef  = useRef("water");
  const gridSnapRef     = useRef(0);   // 0=off, 10, 20, 40
  const zoneRoundedRef  = useRef(false);

  // ── Canvas events (registered once, read from refs) ───────────────────────
  useEffect(()=>{
    const canvas=canvasRef.current; if(!canvas) return;

    const snap=(v)=>{ const g=gridSnapRef.current; return g>0?Math.round(v/g)*g:Math.round(v); };

    const onDown=e=>{
      e.preventDefault();
      const wp=getWP(e); if(!wp) return;
      const{x:wx0,y:wy0}=wp;
      const wx=snap(wx0), wy=snap(wy0);
      const c=courseRef.current, t=toolRef.current;

      // ── IMAGE PLACEMENT — place pending uploaded image ─────────────────────
      const pendingImg = pendingImgRef.current;
      if(pendingImg){
        const newObs = {type:"image", src:pendingImg, x:Math.round(wx), y:Math.round(wy), w:80, h:80, angle:0};
        setCourseRef.current(prev=>{
          const obstacles=[...prev.obstacles, newObs];
          const idx=obstacles.length-1;
          setTimeout(()=>{ selectedRef.current={type:"obstacle",index:idx}; setSelState({type:"obstacle",index:idx}); },0);
          return{...prev, obstacles};
        });
        pendingImgRef.current=null; // clear after placing
        return;
      }
      const preset=activePresetRef.current;
      if(preset){
        const def=OBSTACLE_PRESETS.find(p=>p.id===preset);
        if(def){
          const newObs={...def.obs,x:Math.round(wx),y:Math.round(wy)};
          setCourseRef.current(prev=>{
            const obstacles=[...prev.obstacles,newObs];
            const idx=obstacles.length-1;
            // Auto-select the new item
            setTimeout(()=>{ selectedRef.current={type:"obstacle",index:idx}; setSelState({type:"obstacle",index:idx}); },0);
            return{...prev,obstacles};
          });
          setPreset(null); // deactivate preset after placing
        }
        return;
      }

      // ── ZONE / PERIMETER ───────────────────────────────────────────────────
      if(t==="perim"){
        const pp=perimRef.current;
        if(pp.length>2&&d2(wx,wy,pp[0].x,pp[0].y)<(28/ED_CAM.scale)){
          // Close zone → commit
          const surface=zoneSurfaceRef.current||"water";
          const newZone={points:[...pp],surface,rounded:zoneRoundedRef.current};
          setCourseRef.current(prev=>({...prev,zones:[...(prev.zones||[]),newZone]}));
          perimRef.current=[];
        } else {
          perimRef.current=[...pp,{x:Math.round(wx),y:Math.round(wy)}];
        }
        return;
      }

      // ── SELECT ─────────────────────────────────────────────────────────────
      if(t==="select"){
        // Check rotation handle first
        const sel=selectedRef.current;
        if(sel?.type==="obstacle"){
          const o=c.obstacles[sel.index];
          if(o&&(o.type==="water"||o.type==="slope")){
            const sp=w2c(o.x,o.y,ED_CAM);
            const handleR=Math.max((o.rx||40),(o.ry||28))*ED_CAM.scale+16;
            const hx=sp.cx+Math.cos(o.angle||0)*handleR;
            const hy=sp.cy+Math.sin(o.angle||0)*handleR;
            const rect=canvas.getBoundingClientRect();
            const src2=e.touches?e.touches[0]:e;
            const ccx=(src2.clientX-rect.left)*(CW/rect.width);
            const ccy=(src2.clientY-rect.top)*(CH/rect.height);
            if(d2(ccx,ccy,hx,hy)<14){ rotatingRef.current=true; return; }
          } else if(o&&o.type==="image"){
            // Rotation handle is at top-right corner of bounding box
            const sp=w2c(o.x,o.y,ED_CAM);
            const hw=(o.w||80)*ED_CAM.scale/2, hh=(o.h||80)*ED_CAM.scale/2;
            const ang=o.angle||0;
            const hx=sp.cx+Math.cos(ang)*hw+Math.cos(ang-Math.PI/2)*hh;
            const hy=sp.cy+Math.sin(ang)*hw+Math.sin(ang-Math.PI/2)*hh;
            const rect=canvas.getBoundingClientRect();
            const src2=e.touches?e.touches[0]:e;
            const ccx=(src2.clientX-rect.left)*(CW/rect.width);
            const ccy=(src2.clientY-rect.top)*(CH/rect.height);
            if(d2(ccx,ccy,hx,hy)<14){ rotatingRef.current=true; return; }
          }
        }
        const hit=hitTest(wx,wy,c);
        selectedRef.current=hit; setSelState(hit);
        rotatingRef.current=false;
        if(hit){
          dragItemRef.current=hit;
          let hx2=0,hy2=0;
          if(hit.type==="wicket"){hx2=c.wickets[hit.index].x;hy2=c.wickets[hit.index].y;}
          else if(hit.type==="startPeg"){hx2=c.startPeg.x;hy2=c.startPeg.y;}
          else if(hit.type==="finishPeg"){hx2=c.finishPeg.x;hy2=c.finishPeg.y;}
          else{hx2=c.obstacles[hit.index]?.x||0;hy2=c.obstacles[hit.index]?.y||0;}
          dragOffRef.current={dx:wx-hx2,dy:wy-hy2};
        }
        return;
      }

      // ── DELETE ─────────────────────────────────────────────────────────────
      if(t==="delete"){
        const hit=hitTest(wx,wy,c); if(!hit) return;
        setCourseRef.current(prev=>{
          if(hit.type==="wicket") return{...prev,wickets:prev.wickets.filter((_,i)=>i!==hit.index).map((w,i)=>({...w,id:i+1}))};
          if(hit.type==="obstacle") return{...prev,obstacles:prev.obstacles.filter((_,i)=>i!==hit.index)};
          return prev;
        });
        selectedRef.current=null; setSelState(null);
        return;
      }

      // ── CLICK-TO-PLACE ─────────────────────────────────────────────────────
      const rx=Math.round(wx),ry=Math.round(wy);
      if(t==="wicket") setCourseRef.current(prev=>({...prev,wickets:[...prev.wickets,{id:prev.wickets.length+1,x:rx,y:ry,angle:angleRef.current}]}));
      else if(t==="start")  setCourseRef.current(prev=>({...prev,startPeg:{x:rx,y:ry}}));
      else if(t==="finish") setCourseRef.current(prev=>({...prev,finishPeg:{x:rx,y:ry}}));
    };

    const onMove=e=>{
      const wp=getWP(e); if(!wp) return;
      mouseRef.current=wp;
      const t=toolRef.current;
      if(t==="select"&&rotatingRef.current){
        e.preventDefault();
        const sel=selectedRef.current;
        if(sel?.type==="obstacle"){
          const o=courseRef.current.obstacles[sel.index];
          if(o){ const na=Math.atan2(wp.y-o.y,wp.x-o.x);
            setCourseRef.current(prev=>({...prev,obstacles:prev.obstacles.map((ob,i)=>i===sel.index?{...ob,angle:na}:ob)}));
          }
        }
        return;
      }
      if(t==="select"&&dragItemRef.current){
        e.preventDefault();
        const{x:wx,y:wy}=wp,off=dragOffRef.current;
        const rx=Math.round(wx-(off?.dx||0)),ry=Math.round(wy-(off?.dy||0));
        const{type,index}=dragItemRef.current;
        setCourseRef.current(prev=>{
          if(type==="wicket")   return{...prev,wickets:prev.wickets.map((w,i)=>i===index?{...w,x:rx,y:ry}:w)};
          if(type==="startPeg") return{...prev,startPeg:{x:rx,y:ry}};
          if(type==="finishPeg")return{...prev,finishPeg:{x:rx,y:ry}};
          if(type==="obstacle") return{...prev,obstacles:prev.obstacles.map((o,i)=>i===index?{...o,x:rx,y:ry}:o)};
          return prev;
        });
      }
    };

    const onUp=()=>{ dragItemRef.current=null; dragOffRef.current=null; rotatingRef.current=false; };
    const onKey=e=>{ if(e.key==="Escape"){ perimRef.current=[]; activePresetRef.current=null; setPresetState(null); } };

    canvas.addEventListener("mousedown",  onDown);
    canvas.addEventListener("mousemove",  onMove);
    canvas.addEventListener("mouseup",    onUp);
    canvas.addEventListener("touchstart", onDown, {passive:false});
    canvas.addEventListener("touchmove",  onMove, {passive:false});
    canvas.addEventListener("touchend",   onUp,   {passive:false});
    window.addEventListener("keydown",    onKey);
    return()=>{
      canvas.removeEventListener("mousedown",  onDown);
      canvas.removeEventListener("mousemove",  onMove);
      canvas.removeEventListener("mouseup",    onUp);
      canvas.removeEventListener("touchstart", onDown);
      canvas.removeEventListener("touchmove",  onMove);
      canvas.removeEventListener("touchend",   onUp);
      window.removeEventListener("keydown",    onKey);
    };
  },[]);

  // zoneSurface needs a ref too so the canvas event closure can read it
  const handleZoneSurface = v => { zoneSurfaceRef.current=v; setZoneSurface(v); };
  const handleGridSnap    = v => { gridSnapRef.current=v;    setGridSnapState(v); };
  const handleZoneRounded = v => { zoneRoundedRef.current=v; setZoneRounded(v); };

  const selWicket = selected?.type==="wicket" ? course.wickets[selected.index] : null;
  const selObs    = selected?.type==="obstacle" ? course.obstacles[selected.index] : null;

  const TB = (active,onClick,children,title) => (
    <button onClick={onClick} title={title} style={{display:"flex",alignItems:"center",gap:3,padding:"3px 7px",borderRadius:4,cursor:"pointer",
      background:active?"#2a5a2a":"#172512",color:active?"#e8d080":"#608060",
      border:`1.5px solid ${active?"#60a060":"#243820"}`,fontSize:11,fontFamily:"Georgia,serif",whiteSpace:"nowrap"}}>
      {children}
    </button>
  );
  const PRESET_BTN = (active,onClick,children,title) => (
    <button onClick={onClick} title={title} style={{display:"flex",alignItems:"center",gap:3,padding:"3px 6px",borderRadius:4,cursor:"pointer",
      background:active?"#1a3a5a":"#172512",color:active?"#80d8f0":"#608060",
      border:`1.5px solid ${active?"#3a8aaa":"#243820"}`,fontSize:10,fontFamily:"Georgia,serif",whiteSpace:"nowrap"}}>
      {children}
    </button>
  );

  return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center",width:"100%"}}>

      {/* Canvas */}
      <div style={{borderRadius:"6px 6px 0 0",overflow:"hidden",boxShadow:"0 8px 40px rgba(0,0,0,0.8),0 0 0 2px #2a5030",marginTop:4}}>
        <canvas ref={canvasRef} width={CW} height={CH}
          style={{display:"block",cursor:activePreset?"crosshair":tool==="select"?"default":tool==="delete"?"not-allowed":"crosshair"}}/>
      </div>

      {/* Toolbar row 1 — edit tools */}
      <div style={{display:"flex",gap:3,padding:"4px 8px",background:"#0e1a0f",width:"100%",boxSizing:"border-box",borderBottom:"1px solid #172512",flexWrap:"wrap",justifyContent:"center",alignItems:"center"}}>
        {TOOLS.map(({id,icon,label})=>TB(tool===id&&!activePreset,()=>{setTool(id);setPreset(null);},<><span style={{fontSize:12}}>{icon}</span>{label}</>,label))}
        <div style={{width:1,height:20,background:"#2a4a2a",margin:"0 2px"}}/>
        {TB(false,()=>setCourse({...DEFAULT_COURSE}),"↺ Reset","Reset to default")}
        {TB(showJSON,()=>setShowJSON(v=>!v),"{} JSON","Export JSON")}
      </div>

      {/* Toolbar row 2 — obstacle presets + image upload */}
      <div style={{display:"flex",gap:3,padding:"3px 8px",background:"#0b1509",width:"100%",boxSizing:"border-box",borderBottom:"1px solid #172512",flexWrap:"wrap",justifyContent:"center",alignItems:"center"}}>
        <span style={{color:"#3a6030",fontSize:9,letterSpacing:1}}>PLACE:</span>
        {OBSTACLE_PRESETS.map(({id,icon,label})=>PRESET_BTN(activePreset===id,()=>setPreset(activePreset===id?null:id),<><span style={{fontSize:11}}>{icon}</span>{label}</>,`Place ${label}`))}
        <div style={{width:1,height:20,background:"#2a4a2a",margin:"0 2px"}}/>
        {/* Image upload */}
        <button
          onClick={()=>fileInputRef.current?.click()}
          style={{display:"flex",alignItems:"center",gap:3,padding:"3px 7px",borderRadius:4,cursor:"pointer",
            background:pendingImgRef.current?"#1a3a5a":"#172512",
            color:pendingImgRef.current?"#80d8f0":"#608060",
            border:`1.5px solid ${pendingImgRef.current?"#3a8aaa":"#243820"}`,fontSize:10,fontFamily:"Georgia,serif"}}>
          <span style={{fontSize:12}}>🖼</span>Upload Image
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" style={{display:"none"}}
          onChange={e=>{
            const file=e.target.files?.[0]; if(!file) return;
            const reader=new FileReader();
            reader.onload=ev=>{
              pendingImgRef.current=ev.target.result;
              // Force re-render to update button highlight
              setPreset(null);
            };
            reader.readAsDataURL(file);
            e.target.value=""; // reset so same file can be re-uploaded
          }}/>
      </div>

      {/* Context row */}
      <div style={{display:"flex",gap:10,padding:"4px 10px",background:"#090e09",width:"100%",boxSizing:"border-box",alignItems:"center",flexWrap:"wrap",justifyContent:"center",minHeight:30,borderBottom:"1px solid #172512"}}>

        {/* Course name */}
        <div style={{display:"flex",alignItems:"center",gap:5}}>
          <span style={{color:"#3a6030",fontSize:10}}>NAME</span>
          <input style={{background:"#0d1a0e",border:"1px solid #2a4a2a",borderRadius:3,padding:"2px 6px",color:"#e8d080",fontSize:11,fontFamily:"Georgia,serif",width:110}}
            value={courseName} onChange={e=>setCourseName(e.target.value)} onBlur={()=>setCourse(c=>({...c,name:courseName}))}/>
        </div>

        {/* Grid snap — always visible */}
        <div style={{display:"flex",alignItems:"center",gap:4}}>
          <span style={{color:"#3a6030",fontSize:10}}>SNAP:</span>
          {[["Off",0],["10",10],["20",20],["40",40]].map(([l,v])=>(
            <button key={l} onClick={()=>{setGridSnapState(v);gridSnapRef.current=v;}} style={{
              padding:"2px 6px",borderRadius:3,cursor:"pointer",fontSize:10,fontFamily:"Georgia,serif",
              background:gridSnap===v?"#1e3a1e":"#172512",
              color:gridSnap===v?"#e8d080":"#608060",
              border:`1.5px solid ${gridSnap===v?"#50a050":"#243820"}`,
            }}>{l}</button>
          ))}
        </div>

        {/* Wicket angle when placing */}
        {tool==="wicket"&&<div style={{display:"flex",alignItems:"center",gap:5}}>
          <span style={{color:"#3a6030",fontSize:10}}>ANGLE</span>
          <input type="range" min={0} max={170} value={angle} onChange={e=>setAngle(+e.target.value)} style={{width:80,accentColor:"#50a050"}}/>
          <span style={{color:"#80a080",fontSize:11}}>{angle}°</span>
        </div>}

        {/* Zone tool — surface picker + options */}
        {tool==="perim"&&<div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
          <span style={{color:"#3a6030",fontSize:10}}>FILL:</span>
          {SURFACE_TYPES.map(s=>(
            <button key={s.id} onClick={()=>handleZoneSurface(s.id)} style={{
              padding:"2px 7px",borderRadius:3,cursor:"pointer",fontSize:10,fontFamily:"Georgia,serif",
              background:zoneSurface===s.id?(s.color||"#2a5a2a"):"#172512",
              color:zoneSurface===s.id?"#fff":"#608060",
              border:`1.5px solid ${zoneSurface===s.id?"rgba(255,255,255,0.3)":"#243820"}`,
            }}>{s.label}</button>
          ))}
          <div style={{width:1,height:16,background:"#2a4a2a"}}/>
          {/* Rounded corners toggle */}
          <button onClick={()=>{const v=!zoneRounded;setZoneRounded(v);zoneRoundedRef.current=v;}} style={{
            padding:"2px 8px",borderRadius:3,cursor:"pointer",fontSize:10,fontFamily:"Georgia,serif",
            background:zoneRounded?"#1e4a3a":"#172512",
            color:zoneRounded?"#60e0b0":"#608060",
            border:`1.5px solid ${zoneRounded?"#40a080":"#243820"}`,
          }}>⌒ {zoneRounded?"Rounded":"Sharp"}</button>
          {/* Grid snap */}
          <span style={{color:"#3a6030",fontSize:10}}>SNAP:</span>
          {[["Off",0],["10",10],["20",20],["40",40]].map(([l,v])=>(
            <button key={l} onClick={()=>{setGridSnapState(v);gridSnapRef.current=v;}} style={{
              padding:"2px 6px",borderRadius:3,cursor:"pointer",fontSize:10,fontFamily:"Georgia,serif",
              background:gridSnap===v?"#1e3a1e":"#172512",
              color:gridSnap===v?"#e8d080":"#608060",
              border:`1.5px solid ${gridSnap===v?"#50a050":"#243820"}`,
            }}>{l}</button>
          ))}
          <span style={{color:"#60a060",fontSize:10}}>{perimRef.current.length>0?`${perimRef.current.length} pts — click ✕ to close`:"Click to add points"}</span>
          {course.zones?.length>0&&<button onClick={()=>setCourse(c=>({...c,zones:[]}))} style={{background:"#3a1010",color:"#ff8080",border:"1px solid #6a2020",borderRadius:3,padding:"1px 6px",cursor:"pointer",fontSize:10,fontFamily:"Georgia,serif"}}>Clear zones</button>}
        </div>}

        {/* Pending image hint */}
        {pendingImgRef.current&&<div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{color:"#80d8f0",fontSize:11}}>🖼 Click lawn to place image</span>
          <button onClick={()=>{pendingImgRef.current=null;setPreset(null);}}
            style={{background:"#1a2a3a",color:"#60a8c8",border:"1px solid #2a5a7a",borderRadius:3,padding:"1px 6px",cursor:"pointer",fontSize:10,fontFamily:"Georgia,serif"}}>Cancel</button>
        </div>}

        {/* Selected image controls */}
        {selObs?.type==="image"&&<>
          <div style={{display:"flex",alignItems:"center",gap:5}}>
            <span style={{color:"#3a6030",fontSize:10}}>SIZE</span>
            <input type="range" min={20} max={300} value={selObs.w||80}
              onChange={e=>{const v=+e.target.value;setCourse(c=>({...c,obstacles:c.obstacles.map((o,i)=>i===selected.index?{...o,w:v,h:v}:o)}));}}
              style={{width:80,accentColor:"#50a050"}}/>
            <span style={{color:"#80a080",fontSize:11}}>{selObs.w||80}px</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:5}}>
            <span style={{color:"#3a6030",fontSize:10}}>ROTATE</span>
            <input type="range" min={0} max={360} value={Math.round(((selObs.angle||0)*180/Math.PI+360)%360)}
              onChange={e=>{const rad=(+e.target.value)*Math.PI/180;setCourse(c=>({...c,obstacles:c.obstacles.map((o,i)=>i===selected.index?{...o,angle:rad}:o)}));}}
              style={{width:80,accentColor:"#50a050"}}/>
            <span style={{color:"#80a080",fontSize:11}}>{Math.round(((selObs.angle||0)*180/Math.PI+360)%360)}°</span>
          </div>
        </>}

        {/* Active preset hint */}
        {activePreset&&<div style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{color:"#80d8f0",fontSize:11}}>{OBSTACLE_PRESETS.find(p=>p.id===activePreset)?.icon} Click lawn to place</span>
          <button onClick={()=>setPreset(null)} style={{background:"#1a2a3a",color:"#60a8c8",border:"1px solid #2a5a7a",borderRadius:3,padding:"1px 6px",cursor:"pointer",fontSize:10,fontFamily:"Georgia,serif"}}>Cancel (Esc)</button>
        </div>}

        {/* Selected wicket */}
        {selWicket&&<div style={{display:"flex",alignItems:"center",gap:5}}>
          <span style={{color:"#3a6030",fontSize:10}}>W{selWicket.id}</span>
          <input type="range" min={0} max={170} value={selWicket.angle}
            onChange={e=>setCourse(c=>({...c,wickets:c.wickets.map((w,i)=>i===selected.index?{...w,angle:+e.target.value}:w)}))}
            style={{width:80,accentColor:"#50a050"}}/>
          <span style={{color:"#80a080",fontSize:11}}>{selWicket.angle}°</span>
          <button onClick={()=>{setCourse(c=>({...c,wickets:c.wickets.filter((_,i)=>i!==selected.index).map((w,i)=>({...w,id:i+1}))}));selectedRef.current=null;setSelState(null);}}
            style={{background:"#3a1010",color:"#ff8080",border:"1px solid #6a2020",borderRadius:3,padding:"1px 6px",cursor:"pointer",fontSize:10,fontFamily:"Georgia,serif"}}>Del</button>
        </div>}

        {/* Selected obstacle */}
        {selObs&&<button onClick={()=>{setCourse(c=>({...c,obstacles:c.obstacles.filter((_,i)=>i!==selected.index)}));selectedRef.current=null;setSelState(null);}}
          style={{background:"#3a1010",color:"#ff8080",border:"1px solid #6a2020",borderRadius:3,padding:"2px 8px",cursor:"pointer",fontSize:10,fontFamily:"Georgia,serif"}}>
          Delete {selObs.type}
        </button>}
      </div>

      {/* JSON */}
      {showJSON&&<div style={{width:"100%",maxWidth:CW,boxSizing:"border-box",background:"#0d1a0e",border:"1px solid #2a4a2a",padding:8}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
          <span style={{color:"#50804a",fontSize:10,letterSpacing:1}}>COURSE JSON</span>
          <button onClick={()=>navigator.clipboard?.writeText(JSON.stringify(course,null,2))} style={{background:"#1a3a1a",color:"#80d080",border:"1px solid #2a5a2a",borderRadius:3,padding:"2px 8px",cursor:"pointer",fontSize:10,fontFamily:"Georgia,serif"}}>Copy</button>
        </div>
        <pre style={{color:"#80c080",fontSize:9,margin:0,maxHeight:100,overflow:"auto",whiteSpace:"pre-wrap"}}>{JSON.stringify(course,null,2)}</pre>
      </div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATA HELPERS — local state stubs (Firebase wired in on Netlify via window._croquetDB)
// ═══════════════════════════════════════════════════════════════════════════════

const getWeekId = () => {
  const d=new Date();
  const thu=new Date(d); thu.setDate(d.getDate()-(d.getDay()+6)%7+3);
  const y=thu.getFullYear();
  const jan4=new Date(y,0,4);
  const week=1+Math.round(((thu-jan4)/86400000-(3-((jan4.getDay()+6)%7)))/7);
  return `${y}-W${String(week).padStart(2,"0")}`;
};

const getNextMonday630 = () => {
  const d=new Date(), day=d.getDay();
  const daysAhead=day===1?7:(8-day)%7||7;
  const next=new Date(d); next.setDate(d.getDate()+daysAhead); next.setHours(18,30,0,0);
  return next;
};

const isWeeklyActive = (info) => {
  if(!info?.course) return false;
  if(!info.expiresAt) return true;
  const exp=info.expiresAt?.toDate?.() || new Date(info.expiresAt);
  return new Date() < exp;
};

const fmtExpiry = (info) => {
  if(!info?.expiresAt) return "";
  const exp=info.expiresAt?.toDate?.() || new Date(info.expiresAt);
  return exp.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});
};

// Local in-memory store — replaced by Firestore on Netlify
const getDB = () => window._croquetDB || null;
const _localStore = { weeklyCourse:null, scores:[], pastCourses:[], submitted:new Set(), savedCourses:[] };

async function loadWeeklyCourse() {
  const db=getDB();
  if(db){
    try{
      const snap=await getDoc(doc(db,"weeklyGame","current"));
      if(snap.exists()){const d=snap.data();_localStore.weeklyCourse=d;return d;}
    }catch(e){console.warn("Firestore loadWeeklyCourse:",e);}
  }
  return _localStore.weeklyCourse;
}

async function publishWeeklyCourse(course) {
  const data={course,weekId:getWeekId(),expiresAt:getNextMonday630()};
  const db=getDB();
  if(db){
    try{
      await setDoc(doc(db,"weeklyGame","current"),data);
      await setDoc(doc(collection(db,"weeklyGame","history","weeks"),getWeekId()),data);
    }catch(e){console.warn("Firestore publishWeeklyCourse:",e);}
  }
  _localStore.weeklyCourse=data;
  _localStore.pastCourses=[data,..._localStore.pastCourses];
  return true;
}

async function loadPastCourses() {
  const db=getDB();
  if(db){
    try{
      const wid=getWeekId();
      const q=query(collection(db,"weeklyGame","history","weeks"),orderBy("publishedAt","desc"));
      const snap=await getDocs(q);
      const courses=snap.docs.map(d=>d.data()).filter(d=>d.weekId!==wid);
      _localStore.pastCourses=courses;
      return courses;
    }catch(e){console.warn("Firestore loadPastCourses:",e);}
  }
  return _localStore.pastCourses;
}

async function hasPlayerSubmitted(playerId) {
  const wid=getWeekId();
  const db=getDB();
  if(db){
    try{
      const snap=await getDoc(doc(db,"miniGameScores",`${wid}_${playerId}`));
      return snap.exists();
    }catch(e){console.warn("Firestore hasPlayerSubmitted:",e);}
  }
  return _localStore.submitted.has(playerId);
}

async function loadScores(wid) {
  const db=getDB();
  if(db){
    try{
      const q=query(collection(db,"miniGameScores"),orderBy("strokes"));
      const snap=await getDocs(q);
      const all=snap.docs.map(d=>d.data());
      return wid ? all.filter(s=>s.weekId===wid) : all;
    }catch(e){console.warn("Firestore loadScores:",e);}
  }
  return [..._localStore.scores].sort((a,b)=>a.strokes-b.strokes);
}

async function submitScore(playerId, playerName, strokes, courseName) {
  const wid=getWeekId();
  const docId=`${wid}_${playerId}`;
  const db=getDB();
  if(db){
    try{
      const ref=doc(db,"miniGameScores",docId);
      const existing=await getDoc(ref);
      if(existing.exists()) return "already_submitted";
      await setDoc(ref,{playerId,player:playerName,strokes,course:courseName,weekId:wid,submittedAt:new Date().toISOString()});
    }catch(e){console.warn("Firestore submitScore:",e);return "error";}
  }
  if(_localStore.submitted.has(playerId)) return "already_submitted";
  _localStore.submitted.add(playerId);
  _localStore.scores.push({playerId,player:playerName,strokes,course:courseName,weekId:wid});
  return "ok";
}

async function saveCourse(course) {
  const entry={...course, id:course.id||`course-${Date.now()}`, savedAt:new Date().toISOString()};
  const db=getDB();
  if(db){
    try{
      await setDoc(doc(db,"savedCourses",entry.id),entry);
    }catch(e){console.warn("Firestore saveCourse:",e);}
  }
  const existing=_localStore.savedCourses.findIndex(c=>c.id===entry.id);
  if(existing>=0) _localStore.savedCourses[existing]=entry;
  else _localStore.savedCourses=[entry,..._localStore.savedCourses];
  return entry.id;
}

async function loadSavedCourses() {
  const db=getDB();
  if(db){
    try{
      const q=query(collection(db,"savedCourses"),orderBy("savedAt","desc"));
      const snap=await getDocs(q);
      const courses=snap.docs.map(d=>d.data());
      _localStore.savedCourses=courses;
      return courses;
    }catch(e){console.warn("Firestore loadSavedCourses:",e);}
  }
  return _localStore.savedCourses;
}

async function deleteSavedCourse(courseId) {
  const db=getDB();
  if(db){
    try{
      await deleteDoc(doc(db,"savedCourses",courseId));
    }catch(e){console.warn("Firestore deleteSavedCourse:",e);}
  }
  _localStore.savedCourses=_localStore.savedCourses.filter(c=>c.id!==courseId);
  return true;
}

// ── Course Library (commissioner picks + publishes) ───────────────────────────
function CourseLibraryView({onPublish, publishMsg}) {
  const [courses, setCourses] = useState(null);
  const [loading, setLoading] = useState(true);
  const [previewing, setPreviewing] = useState(null); // course being previewed
  const ED_CAM = {x:380,y:480,scale:0.36};

  useEffect(()=>{
    loadSavedCourses().then(c=>{ setCourses(c); setLoading(false); });
  },[]);

  const handleDelete = async (id) => {
    await deleteSavedCourse(id);
    setCourses(prev=>prev.filter(c=>c.id!==id));
  };

  const btn=(active=false,danger=false)=>({
    background:danger?"#3a1010":active?"#1e4a1e":"#172512",
    color:danger?"#ff8080":active?"#e8d080":"#c0d0b0",
    border:`1.5px solid ${danger?"#6a2020":active?"#50a050":"#2a4020"}`,
    borderRadius:5,padding:"5px 12px",cursor:"pointer",
    fontSize:11,fontFamily:"Georgia,serif",whiteSpace:"nowrap",
  });

  if(loading) return <div style={{color:"#3a6030",textAlign:"center",padding:60,fontFamily:"Georgia,serif"}}>Loading courses…</div>;

  if(previewing) return(
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      <div style={{background:"#080e08",borderBottom:"1px solid #1e3a1e",
        padding:"6px 14px",display:"flex",alignItems:"center",gap:10,flexShrink:0,flexWrap:"wrap"}}>
        <button style={btn()} onClick={()=>setPreviewing(null)}>← Back to Library</button>
        <span style={{color:"#e8d080",fontSize:13,fontWeight:"bold"}}>{previewing.name}</span>
        <span style={{color:"#3a6030",fontSize:11}}>Par {previewing.wickets?.length||0}</span>
        <button style={btn(true)} onClick={()=>{ onPublish(previewing); setPreviewing(null); }}>
          📅 Publish as This Week's Course
        </button>
        {publishMsg&&<span style={{color:publishMsg.startsWith("✓")?"#60d060":"#e0a030",fontSize:12}}>{publishMsg}</span>}
      </div>
      <div style={{flex:1,overflow:"hidden"}}>
        <GameView course={previewing} key={"preview-"+previewing.id}/>
      </div>
    </div>
  );

  return(
    <div style={{padding:"20px 16px",maxWidth:560,margin:"0 auto",fontFamily:"Georgia,serif",
      width:"100%",boxSizing:"border-box",overflowY:"auto",height:"100%"}}>
      <div style={{textAlign:"center",marginBottom:20}}>
        <div style={{color:"#e8d080",fontSize:18,fontWeight:"bold",letterSpacing:2}}>
          Course Library
        </div>
        <div style={{color:"#3a6030",fontSize:11,marginTop:4}}>
          Courses saved by admins · preview and publish as this week's course
        </div>
      </div>

      {!courses?.length&&(
        <div style={{color:"#3a6030",textAlign:"center",padding:40,fontSize:13}}>
          No saved courses yet — go to ✏️ Editor, build one, and hit Save to Library.
        </div>
      )}

      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {courses?.map((c,i)=>(
          <div key={c.id||i} style={{background:"#0c1a0e",border:"1px solid #1a3a1a",
            borderRadius:10,padding:"12px 16px",display:"flex",
            alignItems:"center",gap:12}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{color:"#e8d080",fontSize:14,fontWeight:"bold",marginBottom:3}}>
                {c.name||"Untitled Course"}
              </div>
              <div style={{color:"#3a6030",fontSize:11}}>
                Par {c.wickets?.length||0} · {c.zones?.length||0} zones · {c.obstacles?.length||0} obstacles
              </div>
              {c.savedAt&&<div style={{color:"#2a4a2a",fontSize:10,marginTop:2}}>
                Saved {new Date(c.savedAt).toLocaleDateString("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})}
              </div>}
            </div>
            <div style={{display:"flex",gap:6,flexShrink:0}}>
              <button style={btn()} onClick={()=>setPreviewing(c)}>👁 Preview</button>
              <button style={btn(true)} onClick={()=>{ onPublish(c); }}>📅 Publish</button>
              <button style={btn(false,true)} onClick={()=>handleDelete(c.id||i)}>✕</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Mini-Game Leaderboard ─────────────────────────────────────────────────────
function LeaderboardView({weeklyInfo, wid}) {
  const [scores,  setScores]  = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState("all"); // "all" | current weekId
  const currentWid = getWeekId();
  const medals = ["🥇","🥈","🥉"];

  useEffect(()=>{
    setLoading(true);
    loadScores().then(s=>{ setScores(s); setLoading(false); });
  },[]);

  const displayScores = scores
    ? (filter==="all" ? scores : scores.filter(s=>s.weekId===filter))
        .sort((a,b)=>a.strokes-b.strokes)
    : [];

  // Get unique weeks for filter buttons
  const weeks = scores
    ? [...new Set(scores.map(s=>s.weekId))].sort().reverse()
    : [];

  return(
    <div style={{padding:"20px 16px",maxWidth:520,margin:"0 auto",fontFamily:"Georgia,serif",
      width:"100%",boxSizing:"border-box"}}>
      <div style={{textAlign:"center",marginBottom:16}}>
        <div style={{color:"#e8d080",fontSize:18,fontWeight:"bold",letterSpacing:2}}>
          Mini-Game Leaderboard
        </div>
        <div style={{color:"#3a6030",fontSize:11,marginTop:4}}>Season scores</div>
      </div>

      {/* Week filter */}
      {weeks.length>1&&(
        <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap",justifyContent:"center"}}>
          <button onClick={()=>setFilter("all")} style={{
            padding:"3px 10px",borderRadius:4,cursor:"pointer",fontSize:11,
            fontFamily:"Georgia,serif",
            background:filter==="all"?"#1e4a1e":"#172512",
            color:filter==="all"?"#e8d080":"#608060",
            border:`1px solid ${filter==="all"?"#50a050":"#243820"}`,
          }}>All</button>
          {weeks.map(w=>(
            <button key={w} onClick={()=>setFilter(w)} style={{
              padding:"3px 10px",borderRadius:4,cursor:"pointer",fontSize:11,
              fontFamily:"Georgia,serif",
              background:filter===w?"#1e4a1e":"#172512",
              color:filter===w?"#e8d080":"#608060",
              border:`1px solid ${filter===w?"#50a050":"#243820"}`,
            }}>{w}</button>
          ))}
        </div>
      )}

      {loading&&<div style={{color:"#3a6030",textAlign:"center",padding:40}}>Loading…</div>}

      {!loading&&!displayScores.length&&(
        <div style={{color:"#3a6030",textAlign:"center",padding:40,fontSize:13}}>
          No scores yet — go play! ⛳
        </div>
      )}

      {!loading&&displayScores.length>0&&(
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {displayScores.map((s,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:12,
              background:i===0?"#0c2a10":"#0c1a0e",
              border:`1px solid ${i===0?"#50a050":"#1a3a1a"}`,
              borderRadius:10,padding:"12px 16px"}}>
              <span style={{fontSize:20,width:28,textAlign:"center"}}>
                {medals[i]||<span style={{color:"#3a6030",fontSize:13}}>#{i+1}</span>}
              </span>
              <div style={{flex:1}}>
                <div style={{color:"#e8d080",fontSize:14,fontWeight:"bold"}}>{s.player}</div>
                <div style={{color:"#3a6030",fontSize:11,marginTop:2}}>{s.course} · {s.weekId}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{color:"#80d060",fontSize:18,fontWeight:"bold"}}>{s.strokes}</div>
                <div style={{color:"#2a5020",fontSize:10}}>strokes</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Past Courses ──────────────────────────────────────────────────────────────
function PastCoursesView({onPlay, isMember=false}) {
  const [courses, setCourses] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    loadPastCourses().then(c=>{setCourses(c);setLoading(false);});
  },[]);

  if(loading) return(
    <div style={{color:"#3a6030",textAlign:"center",padding:60,fontFamily:"Georgia,serif"}}>
      Loading past courses…
    </div>
  );

  if(!courses?.length) return(
    <div style={{color:"#3a6030",textAlign:"center",padding:60,fontFamily:"Georgia,serif",fontSize:13}}>
      No past courses yet — check back after the first weekly course!
    </div>
  );

  return(
    <div style={{padding:"20px 16px",maxWidth:520,margin:"0 auto",
      fontFamily:"Georgia,serif",width:"100%",boxSizing:"border-box"}}>
      <div style={{color:"#e8d080",fontSize:16,fontWeight:"bold",letterSpacing:2,
        textAlign:"center",marginBottom:16}}>Past Courses</div>
      <div style={{color:"#3a6030",fontSize:11,textAlign:"center",marginBottom:20}}>
        Play any previous course for fun — scores don't count
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {courses.map((c,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:12,
            background:"#0c1a0e",border:"1px solid #1a3a1a",borderRadius:10,
            padding:"12px 16px"}}>
            <div style={{flex:1}}>
              <div style={{color:"#e8d080",fontSize:14,fontWeight:"bold"}}>
                {c.course?.name||"Course"}
              </div>
              <div style={{color:"#3a6030",fontSize:11,marginTop:2}}>
                {c.weekId} · Par {c.course?.wickets?.length??0}
              </div>
            </div>
            {isMember
              ? <button onClick={()=>onPlay(c.course)} style={{
                  background:"#1e4a1e",color:"#e8d080",border:"1px solid #50a050",
                  borderRadius:6,padding:"6px 14px",fontSize:12,cursor:"pointer",
                  fontFamily:"Georgia,serif"}}>Play ⛳</button>
              : <span style={{color:"#2a4a2a",fontSize:11,fontStyle:"italic"}}>members only</span>
            }
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Score submission modal ────────────────────────────────────────────────────
// Uses player profile — no manual name entry needed
function SubmitScoreModal({strokes, courseName, player, onSubmit, onSkip}) {
  const [state, setState] = useState("idle");

  useEffect(()=>{
    if(player?.id){
      hasPlayerSubmitted(player.id).then(has=>{ if(has) setState("already"); });
    }
  },[player]);

  const handleSubmit=async()=>{
    setState("submitting");
    const result=await submitScore(
      player?.id||"anon",
      player?.name||player?.id||"Player",
      strokes, courseName
    );
    if(result==="ok") setState("done");
    else if(result==="already_submitted") setState("already");
    else setState("offline");
  };

  return(
    <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.88)",
      display:"flex",alignItems:"center",justifyContent:"center",zIndex:50,
      fontFamily:"Georgia,serif"}}>
      <div style={{background:"#0c1e10",border:"2px solid #50a050",borderRadius:14,
        padding:"28px 36px",textAlign:"center",maxWidth:320,width:"90%"}}>

        <div style={{fontSize:36,marginBottom:8}}>
          {state==="done"?"✅":state==="already"?"🔒":"🏆"}
        </div>

        {state==="done"&&(
          <>
            <div style={{color:"#80d060",fontSize:16,fontWeight:"bold",marginBottom:6}}>
              Score submitted!
            </div>
            <div style={{color:"#3a6030",fontSize:12}}>Check the leaderboard 👀</div>
          </>
        )}

        {state==="already"&&(
          <>
            <div style={{color:"#e8d080",fontSize:16,fontWeight:"bold",marginBottom:6}}>
              Already submitted!
            </div>
            <div style={{color:"#608060",fontSize:12,lineHeight:1.6}}>
              Your first score for this week is already saved.<br/>
              Keep playing for fun!
            </div>
            <button onClick={onSkip} style={{marginTop:14,background:"#1e4a1e",color:"#e8d080",
              border:"1px solid #50a050",borderRadius:6,padding:"8px 20px",
              fontSize:13,cursor:"pointer",fontFamily:"Georgia,serif"}}>
              Play Again
            </button>
          </>
        )}

        {state==="offline"&&(
          <>
            <div style={{color:"#e06060",fontSize:14,fontWeight:"bold",marginBottom:6}}>
              Couldn't save score
            </div>
            <div style={{color:"#608060",fontSize:12}}>Check your connection and try again.</div>
            <div style={{display:"flex",gap:8,marginTop:14}}>
              <button onClick={onSkip} style={{flex:1,background:"#172512",color:"#608060",
                border:"1px solid #2a4020",borderRadius:6,padding:"8px",
                fontSize:12,cursor:"pointer",fontFamily:"Georgia,serif"}}>Close</button>
              <button onClick={handleSubmit} style={{flex:2,background:"#1e4a1e",color:"#e8d080",
                border:"1px solid #50a050",borderRadius:6,padding:"8px",
                fontSize:13,cursor:"pointer",fontFamily:"Georgia,serif"}}>Retry</button>
            </div>
          </>
        )}

        {(state==="idle"||state==="submitting")&&(
          <>
            <div style={{color:"#e8d080",fontSize:18,fontWeight:"bold",marginBottom:4}}>
              Pegged Out!
            </div>
            <div style={{color:"#80d060",fontSize:28,fontWeight:"bold",marginBottom:16}}>
              {strokes} strokes
            </div>
            <div style={{color:"#608060",fontSize:12,marginBottom:16}}>
              Submitting as <strong style={{color:"#e8d080"}}>
                {player?.name||player?.id||"Player"}
              </strong>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button onClick={onSkip} style={{flex:1,background:"#172512",color:"#608060",
                border:"1px solid #2a4020",borderRadius:6,padding:"8px",
                fontSize:12,cursor:"pointer",fontFamily:"Georgia,serif"}}>
                Skip
              </button>
              <button onClick={handleSubmit} disabled={state==="submitting"} style={{flex:2,
                background:"#1e4a1e",color:"#e8d080",border:"1px solid #50a050",
                borderRadius:6,padding:"8px",fontSize:13,cursor:"pointer",
                fontFamily:"Georgia,serif",opacity:state==="submitting"?0.6:1}}>
                {state==="submitting"?"Submitting…":"Submit to Leaderboard"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ROOT APP
// Props from parent App.js:
//   currentPlayer: { id, name, ... } — the logged-in player object, or null
//   isCommissioner: boolean — whether this player is the commissioner
// ═══════════════════════════════════════════════════════════════════════════════
export default function CroquetGame({ currentPlayer:playerProp=null, isCommissioner:commProp=false }) {
  // ── All hooks must be declared before any conditional return ──────────────
  const [localPlayer,      setLocalPlayer]      = useState(playerProp);
  const [localComm,        setLocalComm]        = useState(commProp);
  const [loginMode,        setLoginMode]        = useState("choose"); // choose | commissioner | player
  const [loginPass,        setLoginPass]        = useState("");
  const [loginName,        setLoginName]        = useState("");
  const [loginJoinCode,    setLoginJoinCode]    = useState("");
  const [loginErr,         setLoginErr]         = useState("");
  const [tab,              setTab]              = useState("weekly");
  const [editorCourse,     setEditorCourse]     = useState(DEFAULT_COURSE);
  const [parkId,           setParkId]           = useState("custom");
  const [weeklyInfo,       setWeeklyInfo]       = useState(null);
  const [weeklyCourse,     setWeeklyCourse]     = useState(null);
  const [weeklyActive,     setWeeklyActive]     = useState(false);
  const [publishing,       setPublishing]       = useState(false);
  const [publishMsg,       setPublishMsg]       = useState(null);
  const [savingCourse,     setSavingCourse]     = useState(false);
  const [saveMsg,          setSaveMsg]          = useState(null);
  const [showSubmit,       setShowSubmit]       = useState(false);
  const [lastStrokes,      setLastStrokes]      = useState(0);
  const [replayCourse,     setReplayCourse]     = useState(null);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);

  const currentPlayer  = playerProp || localPlayer;
  const isCommissioner = commProp   || localComm;

  // Load weekly course on mount
  useEffect(()=>{
    loadWeeklyCourse().then(info=>{
      setWeeklyInfo(info);
      const active=isWeeklyActive(info);
      setWeeklyActive(active);
      if(active) setWeeklyCourse(info.course);
    });
    if(currentPlayer?.id){
      hasPlayerSubmitted(currentPlayer.id).then(setAlreadySubmitted);
    }
  },[currentPlayer?.id]);

  const tryCommissioner = () => {
    if(loginPass === "croquet2026") {
      setLocalPlayer({id:"commissioner", name:"Commissioner", isMember:true, isAdmin:true});
      setLocalComm(true); setLoginErr("");
    } else { setLoginErr("Incorrect password"); setLoginPass(""); }
  };

  const tryAdmin = () => {
    const admins = [
      {username:"commissioner", password:"croquet2026", role:"superadmin"},
      {username:"admin2",       password:"detwah2026",  role:"admin"},
    ];
    const match = admins.find(a=>a.username===loginName.trim()&&a.password===loginPass);
    if(match) {
      const isComm = match.role==="superadmin";
      setLocalPlayer({id:match.username, name:match.username, isMember:true, isAdmin:true});
      if(isComm) setLocalComm(true);
      setLoginErr("");
    } else { setLoginErr("Invalid username or password"); setLoginPass(""); }
  };

  const tryPlayer = () => {
    if(!loginName.trim()) { setLoginErr("Please enter your name"); return; }
    if(loginJoinCode.trim() !== "croquet2026") { setLoginErr("Invalid join code"); return; }
    setLocalPlayer({
      id:`player-${loginName.trim().toLowerCase().replace(/\s+/g,"-")}`,
      name:loginName.trim(), isMember:true, isAdmin:false,
    });
    setLoginErr("");
  };

  const enterAsGuest = () => {
    setLocalPlayer({id:"guest", name:"Guest", isMember:false, isAdmin:false});
  };

  const iStyle = {
    background:"#0d1a0e", border:"1px solid #2a4a2a", borderRadius:8,
    padding:"9px 14px", color:"#e8d080", fontSize:13, fontFamily:"Georgia,serif",
    width:"100%", boxSizing:"border-box", textAlign:"center", outline:"none",
    marginBottom:10, letterSpacing:1,
  };

  // ── Login screen ───────────────────────────────────────────────────────────
  if(!currentPlayer) return(
    <div style={{height:"100vh",background:"#0a120a",display:"flex",alignItems:"center",
      justifyContent:"center",fontFamily:"Georgia,serif"}}>
      <div style={{background:"#0c1e10",border:"2px solid #2a5a2a",borderRadius:16,
        padding:"32px 40px",textAlign:"center",maxWidth:360,width:"90%"}}>
        <div style={{fontSize:38,marginBottom:8}}>🏡</div>
        <h1 style={{color:"#e8d080",fontSize:18,fontWeight:"bold",letterSpacing:3,margin:"0 0 4px"}}>
          Croquet De-Twah
        </h1>
        <p style={{color:"#3a6030",fontSize:11,letterSpacing:2,margin:"0 0 22px"}}>MINI-GAME</p>

        {loginErr&&<p style={{color:"#e06060",fontSize:12,margin:"0 0 10px"}}>{loginErr}</p>}

        {/* Choose mode */}
        {loginMode==="choose"&&(
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <button onClick={()=>{setLoginMode("player");setLoginErr("");setLoginName("");setLoginJoinCode("");}}
              style={{background:"#1e4a1e",color:"#e8d080",border:"1.5px solid #50a050",
                borderRadius:8,padding:"11px",fontSize:13,cursor:"pointer",fontFamily:"Georgia,serif"}}>
              🏑 Player Login
            </button>
            <button onClick={()=>{setLoginMode("admin");setLoginErr("");setLoginName("");setLoginPass("");}}
              style={{background:"#172512",color:"#90b890",border:"1px solid #2a4a2a",
                borderRadius:8,padding:"10px",fontSize:12,cursor:"pointer",fontFamily:"Georgia,serif"}}>
              🔐 Admin / Commissioner
            </button>
            <button onClick={enterAsGuest}
              style={{background:"none",border:"1px solid #1a3a1a",color:"#3a6030",
                borderRadius:8,padding:"9px",fontSize:12,cursor:"pointer",fontFamily:"Georgia,serif"}}>
              👁 View as Guest
            </button>
          </div>
        )}

        {/* Player login */}
        {loginMode==="player"&&(
          <div>
            <input value={loginName} onChange={e=>{setLoginName(e.target.value);setLoginErr("");}}
              placeholder="Your name" autoFocus style={iStyle}/>
            <input type="password" value={loginJoinCode}
              onChange={e=>{setLoginJoinCode(e.target.value);setLoginErr("");}}
              onKeyDown={e=>e.key==="Enter"&&tryPlayer()}
              placeholder="Join code" style={iStyle}/>
            <button onClick={tryPlayer}
              style={{width:"100%",background:"#1e4a1e",color:"#e8d080",
                border:"1.5px solid #50a050",borderRadius:8,padding:"10px",
                fontSize:13,cursor:"pointer",fontFamily:"Georgia,serif",marginBottom:8}}>
              Enter →
            </button>
            <button onClick={()=>{setLoginMode("choose");setLoginErr("");}}
              style={{background:"none",border:"none",color:"#3a6030",cursor:"pointer",
                fontSize:12,fontFamily:"Georgia,serif"}}>← Back</button>
          </div>
        )}

        {/* Admin / Commissioner login */}
        {loginMode==="admin"&&(
          <div>
            <input value={loginName} onChange={e=>{setLoginName(e.target.value);setLoginErr("");}}
              placeholder="Username" autoFocus style={iStyle}/>
            <input type="password" value={loginPass}
              onChange={e=>{setLoginPass(e.target.value);setLoginErr("");}}
              onKeyDown={e=>e.key==="Enter"&&tryAdmin()}
              placeholder="Password" style={iStyle}/>
            <button onClick={tryAdmin}
              style={{width:"100%",background:"#1e4a1e",color:"#e8d080",
                border:"1.5px solid #50a050",borderRadius:8,padding:"10px",
                fontSize:13,cursor:"pointer",fontFamily:"Georgia,serif",marginBottom:8}}>
              Enter →
            </button>
            <button onClick={()=>{setLoginMode("choose");setLoginErr("");}}
              style={{background:"none",border:"none",color:"#3a6030",cursor:"pointer",
                fontSize:12,fontFamily:"Georgia,serif"}}>← Back</button>
          </div>
        )}
      </div>
    </div>
  );

  const selectPark=(id)=>{
    const park=DETROIT_PARKS.find(p=>p.id===id); if(!park)return;
    setParkId(id);
    setEditorCourse(prev=>({...prev,
      name:park.id==="custom"?prev.name:park.name,
      bounds:park.bounds, startPeg:park.startPeg,
      finishPeg:park.finishPeg, perimeter:park.perimeter,
    }));
  };

  const saveCourseFn=async()=>{
    setSavingCourse(true); setSaveMsg(null);
    const courseToSave={...editorCourse, id: editorCourse.id||`course-${Date.now()}`};
    setEditorCourse(courseToSave);
    const ok=await saveCourse(courseToSave);
    setSavingCourse(false);
    if(ok){ setSaveMsg("✓ Saved to library!"); setTimeout(()=>setSaveMsg(null),3000); }
    else    setSaveMsg("⚠ Save failed");
  };

  const publishCourse=async(courseToPublish)=>{
    const c = courseToPublish || editorCourse;
    setPublishing(true); setPublishMsg(null);
    const ok=await publishWeeklyCourse(c);
    setPublishing(false);
    if(ok){
      const info={course:c,weekId:getWeekId(),expiresAt:getNextMonday630()};
      setWeeklyInfo(info); setWeeklyCourse(c); setWeeklyActive(true);
      setPublishMsg("✓ Published! Active until "+fmtExpiry(info));
      setTimeout(()=>setPublishMsg(null),5000);
    } else {
      setPublishMsg("⚠ Firestore unavailable");
    }
  };

  const handleGameComplete=(strokes)=>{
    setLastStrokes(strokes);
    // Only show submit modal for the weekly course, not replays
    if(!replayCourse) setShowSubmit(true);
  };

  const handleScoreSubmitted=()=>{
    setShowSubmit(false);
    setAlreadySubmitted(true);
    setTab("leaderboard");
  };

  // Which course is currently being played
  const playingCourse = replayCourse || weeklyCourse;

  // Tabs — commissioner gets Editor tab too
  const isAdmin = isCommissioner || currentPlayer?.isAdmin || currentPlayer?.role === "admin";

  const TABS=[
    ["weekly",      "⛳ Weekly"],
    ["leaderboard", "🏆 Mini-Game Leaderboard"],
    ["past",        "📚 Past Courses"],
    ...(isAdmin       ?[["editor","✏️ Editor"]]:[]),
    ...(isCommissioner?[["library","📋 Course Library"]]:[]),
  ];

  const tabBtn=(id,label)=>(
    <button key={id} onClick={()=>{setTab(id);setReplayCourse(null);}} style={{
      background:tab===id?"#1e4a1e":"transparent",
      color:tab===id?"#e8d080":"#608060",
      border:"none",borderBottom:`2px solid ${tab===id?"#60a060":"transparent"}`,
      padding:"4px 12px",cursor:"pointer",fontSize:12,
      fontFamily:"Georgia,serif",borderRadius:"3px 3px 0 0",whiteSpace:"nowrap",
    }}>{label}</button>
  );

  return(
    <div style={{display:"flex",flexDirection:"column",width:"100%",height:"100vh",
      background:"#0d1a0e",overflow:"hidden",fontFamily:"Georgia,'Times New Roman',serif",
      userSelect:"none",position:"relative"}}>

      {/* Score submission modal */}
      {showSubmit&&(
        <SubmitScoreModal
          strokes={lastStrokes}
          courseName={weeklyCourse?.name??"Weekly Course"}
          player={currentPlayer}
          onSubmit={handleScoreSubmitted}
          onSkip={()=>setShowSubmit(false)}/>
      )}

      {/* ── Top bar ── */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",
        padding:"5px 12px",borderBottom:"1px solid #1e3a1e",background:"#080e08",
        flexShrink:0,gap:8,flexWrap:"wrap"}}>

        <div style={{display:"flex",alignItems:"baseline",gap:10}}>
          <span style={{color:"#e8d080",fontSize:15,fontWeight:"bold",letterSpacing:2}}>
            Croquet De-Twah
          </span>
          <span style={{color:"#3a6030",fontSize:10,letterSpacing:1}}>
            {currentPlayer.name||currentPlayer.id}
            {isCommissioner?" · Commissioner":""}
          </span>
        </div>

        {/* Park selector — editor only */}
        {tab==="editor"&&(
          <div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap"}}>
            <span style={{color:"#3a6030",fontSize:10,letterSpacing:1}}>COURSE:</span>
            {DETROIT_PARKS.map(park=>(
              <button key={park.id} onClick={()=>selectPark(park.id)} style={{
                display:"flex",alignItems:"center",gap:3,padding:"3px 8px",
                borderRadius:4,cursor:"pointer",fontSize:11,fontFamily:"Georgia,serif",
                background:parkId===park.id?"#1e4a1e":"transparent",
                color:parkId===park.id?"#e8d080":"#506050",
                border:`1px solid ${parkId===park.id?"#50a050":"#1e3a1e"}`,
              }}><span>{park.icon}</span>{park.name}</button>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div style={{display:"flex",gap:1,overflowX:"auto"}}>
          {TABS.map(([id,label])=>tabBtn(id,label))}
        </div>
      </div>

      {/* ── Content ── */}
      <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column",alignItems:"center"}}>

        {/* ── WEEKLY PLAY ── */}
        {tab==="weekly"&&(()=>{
          // Members only gate
          const isMember = currentPlayer?.isMember || isCommissioner;
          if(!isMember) return(
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",
              justifyContent:"center",height:"100%",gap:14,fontFamily:"Georgia,serif"}}>
              <div style={{fontSize:44}}>🔒</div>
              <div style={{color:"#e8d080",fontSize:16,fontWeight:"bold"}}>Members Only</div>
              <div style={{color:"#3a6030",fontSize:13,textAlign:"center",maxWidth:280,lineHeight:1.7}}>
                The mini-game is available to registered league members.<br/>
                Log in with your name and join code to play.
              </div>
            </div>
          );
          // Replay mode banner
          if(replayCourse) return(
            <div style={{display:"flex",flexDirection:"column",flex:1,width:"100%",overflow:"hidden"}}>
              <div style={{background:"#1a3010",borderBottom:"1px solid #2a5020",
                padding:"5px 14px",display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
                <span style={{color:"#80c060",fontSize:11}}>
                  🔁 Replay: {replayCourse.name} — scores not tracked
                </span>
                <button onClick={()=>setReplayCourse(null)} style={{
                  background:"#172512",color:"#608060",border:"1px solid #2a4020",
                  borderRadius:4,padding:"3px 8px",fontSize:11,cursor:"pointer",
                  fontFamily:"Georgia,serif"}}>← Back to Weekly</button>
              </div>
              <GameView course={replayCourse} key={"replay-"+replayCourse.name}/>
            </div>
          );

          // No active course
          if(!weeklyActive||!weeklyCourse) return(
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",
              justifyContent:"center",height:"100%",gap:12,color:"#3a6030",fontSize:13}}>
              <div style={{fontSize:44}}>⛳</div>
              <div style={{color:"#e8d080",fontSize:16}}>No active course this week</div>
              <div style={{fontSize:12,color:"#3a5020"}}>
                {weeklyInfo&&!weeklyActive
                  ? "This week's course has expired — check back Monday!"
                  : isCommissioner
                    ? "Go to ✏️ Editor, build a course, then Publish"
                    : "The Commissioner hasn't posted this week's course yet"}
              </div>
            </div>
          );

          return(
            <div style={{display:"flex",flexDirection:"column",flex:1,width:"100%",overflow:"hidden"}}>
              {/* Weekly info banner */}
              <div style={{background:"#080e08",borderBottom:"1px solid #1e3a1e",
                padding:"4px 14px",display:"flex",alignItems:"center",gap:12,
                flexShrink:0,flexWrap:"wrap"}}>
                <span style={{color:"#50a050",fontSize:11}}>
                  📅 {weeklyCourse.name} · Par {weeklyCourse.wickets.length}
                </span>
                <span style={{color:"#2a5020",fontSize:10}}>
                  Expires {fmtExpiry(weeklyInfo)}
                </span>
                {alreadySubmitted&&(
                  <span style={{color:"#60d060",fontSize:11}}>
                    ✓ Score submitted — playing for fun
                  </span>
                )}
              </div>
              <GameView
                course={weeklyCourse}
                key={weeklyInfo?.weekId}
                onComplete={alreadySubmitted?null:handleGameComplete}/>
            </div>
          );
        })()}

        {/* ── LEADERBOARD ── */}
        {tab==="leaderboard"&&(
          <div style={{flex:1,overflowY:"auto",width:"100%"}}>
            <LeaderboardView weeklyInfo={weeklyInfo}/>
          </div>
        )}

        {/* ── PAST COURSES ── */}
        {tab==="past"&&(
          <div style={{flex:1,overflowY:"auto",width:"100%"}}>
            <PastCoursesView
              isMember={currentPlayer?.isMember||isCommissioner}
              onPlay={(course)=>{ setReplayCourse(course); setTab("weekly"); }}/>
          </div>
        )}

        {/* ── EDITOR (all admins) ── */}
        {tab==="editor"&&isAdmin&&(
          <div style={{flex:1,overflow:"hidden",display:"flex",
            flexDirection:"column",width:"100%"}}>
            <div style={{background:"#080e08",borderBottom:"1px solid #1e3a1e",
              padding:"6px 14px",display:"flex",alignItems:"center",
              gap:10,flexShrink:0,flexWrap:"wrap"}}>
              <span style={{color:"#3a6030",fontSize:11}}>
                {editorCourse.wickets.length} wickets · {editorCourse.name}
              </span>
              {/* Save to library — any admin */}
              <button onClick={saveCourseFn}
                disabled={savingCourse||editorCourse.wickets.length===0}
                style={{background:"#172a1e",color:"#80d0a0",border:"1px solid #2a6040",
                  borderRadius:6,padding:"5px 14px",fontSize:12,cursor:"pointer",
                  fontFamily:"Georgia,serif",
                  opacity:editorCourse.wickets.length===0?0.5:1}}>
                {savingCourse?"Saving…":"💾 Save to Library"}
              </button>
              {saveMsg&&<span style={{
                color:saveMsg.startsWith("✓")?"#60d060":"#e0a030",fontSize:12
              }}>{saveMsg}</span>}
              {/* Publish direct — commissioner only */}
              {isCommissioner&&<>
                <button onClick={()=>publishCourse(editorCourse)}
                  disabled={publishing||editorCourse.wickets.length===0}
                  style={{background:"#1e4a1e",color:"#e8d080",border:"1px solid #50a050",
                    borderRadius:6,padding:"5px 14px",fontSize:12,cursor:"pointer",
                    fontFamily:"Georgia,serif",
                    opacity:editorCourse.wickets.length===0?0.5:1}}>
                  {publishing?"Publishing…":"📅 Publish as This Week's Course"}
                </button>
                {publishMsg&&<span style={{
                  color:publishMsg.startsWith("✓")?"#60d060":"#e0a030",fontSize:12
                }}>{publishMsg}</span>}
              </>}
            </div>
            <EditorView course={editorCourse} setCourse={setEditorCourse}/>
          </div>
        )}

        {/* ── COURSE LIBRARY (commissioner only) ── */}
        {tab==="library"&&isCommissioner&&(
          <div style={{flex:1,overflow:"hidden",display:"flex",
            flexDirection:"column",width:"100%"}}>
            <CourseLibraryView
              onPublish={(c)=>publishCourse(c)}
              publishMsg={publishMsg}/>
          </div>
        )}
      </div>
    </div>
  );
}

