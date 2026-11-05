import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ROOMS,roomURL } from './rooms.js';

// Every scene is rebuilt from geometry only: no textures, GLB assets, server or API.
// A room has its own bookmarkable ?room= URL; changing rooms reloads only local JS.
const $=id=>document.getElementById(id);
const CELL=1.55, HALF_X=11, HALF_Z=9, FLOOR=.21, STEP_LIMIT=6;
const HEROES=[
 {id:'lethia',name:'Lethia',job:'WIZARD',color:0x9d91ec,symbol:'✦',style:'wizard'},
 {id:'elsa',name:'Elsa',job:'ICE SORCERESS',color:0x9ee8f6,symbol:'❄',style:'ice'},
 {id:'gilchris',name:'Gilchris',job:'WARLOCK',color:0xb594d7,symbol:'☾',style:'warlock'},
 {id:'leda',name:'Leda',job:'HALFLING ROGUE',color:0x9bc6a0,symbol:'⚔',style:'rogue'}
];
const CREATURES=[
 {id:'chicken',name:'Chicken',symbol:'🐔',color:0xf1e0b1,detail:'A busy temple hen'},
 {id:'duck',name:'Duck',symbol:'🦆',color:0xe6d18d,detail:'A waddling visitor'},
 {id:'pig',name:'Pig',symbol:'🐖',color:0xe3a8ac,detail:'A small pink pig'},
 {id:'cow',name:'Cow',symbol:'🐄',color:0xeae4d8,detail:'A dairy cow'}
];
const MONKS=[
 {id:'temple-monk',name:'Temple Monk',symbol:'☯',color:0xd9ad72,detail:'A disciplined temple practitioner'},
 {id:'monk-instructor',name:'Monk Instructor',symbol:'⚔',color:0xb5d5b3,detail:'An experienced martial arts teacher'}
];
const v=n=>n*CELL, tileKey=(x,z)=>`${x},${z}`,hex=n=>'#'+n.toString(16).padStart(6,'0');
const rand=(a,b)=>a+Math.random()*(b-a);
const scene=new THREE.Scene();
let matCache=new Map();
function mat(color,metalness=.06,opacity=1){const k=`${color}:${metalness}:${opacity}`;if(!matCache.has(k))matCache.set(k,new THREE.MeshStandardMaterial({color,roughness:.73,metalness,flatShading:true,transparent:opacity<1,opacity,side:THREE.DoubleSide}));return matCache.get(k);}
function glow(color,intensity=.8){return new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:intensity,roughness:.36});}
function mesh(geo,m,parent=scene){const o=new THREE.Mesh(geo,m);parent.add(o);return o;}
function box(w,h,d,m,x,y,z,parent=scene){const o=mesh(new THREE.BoxGeometry(w,h,d),m,parent);o.position.set(x,y,z);return o;}
function cyl(rt,rb,h,m,x,y,z,parent=scene,n=12){const o=mesh(new THREE.CylinderGeometry(rt,rb,h,n),m,parent);o.position.set(x,y,z);return o;}
function ball(r,m,x,y,z,parent=scene,detail=1){const o=mesh(new THREE.IcosahedronGeometry(r,detail),m,parent);o.position.set(x,y,z);return o;}
function cone(r,h,m,x,y,z,parent=scene,n=7){const o=mesh(new THREE.ConeGeometry(r,h,n),m,parent);o.position.set(x,y,z);return o;}
function rod(a,b,r,m,parent=scene,r2=r){const p=new THREE.Vector3(...a),q=new THREE.Vector3(...b),d=q.clone().sub(p);const o=mesh(new THREE.CylinderGeometry(r2,r,d.length(),7),m,parent);o.position.copy(p).add(q).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return o;}
function ring(r,t,m,x,y,z,parent=scene){const o=mesh(new THREE.TorusGeometry(r,t,7,44),m,parent);o.position.set(x,y,z);return o;}
const STONE=mat(0x737d85),DARK=mat(0x343f4d),GOLD=mat(0xbba26c,.55),WOOD=mat(0x75543b),LWOOD=mat(0xb58b5c),WHITE=mat(0xebe5d6),LEAF=mat(0x58745b),SKIN=mat(0xd8b59c);
const blocked=new Set(),npcTiles=new Set(),labels=[],animated=[],staticTargets=[],pieces=[],particleGroups=[];
let room,renderer,camera,controls,clock,overlay,raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
let selected=null,pendingHero=null,pendingCreature=null,reachable=new Map(),creatureCounter=0,cameraTween=null,toastTimer;
const allSpawned=()=>pieces.filter(p=>p.spawned);
const within=(x,z)=>Number.isInteger(x)&&Number.isInteger(z)&&Math.abs(x)<=HALF_X&&Math.abs(z)<=HALF_Z;
const walkable=(x,z)=>within(x,z)&&!blocked.has(tileKey(x,z));
const occupied=(x,z,id)=>allSpawned().some(p=>p.id!==id&&p.x===x&&p.z===z);
const free=(x,z,id)=>walkable(x,z)&&!occupied(x,z,id);
function blockTile(x,z){if(within(x,z))blocked.add(tileKey(x,z));}
function blockRect(x,z,rx=0,rz=0){for(let i=Math.ceil(x-rx);i<=Math.floor(x+rx);i++)for(let j=Math.ceil(z-rz);j<=Math.floor(z+rz);j++)blockTile(i,j);}
// The NPC planner uses the same impassable tiles as the party. Standers never
// spawn inside props or immediately on top of another standing NPC.
function placeStandingNPC(wantedX,wantedZ,opts={},minSpacing=1){
 const candidates=[];
 for(let x=-HALF_X;x<=HALF_X;x++)for(let z=-HALF_Z;z<=HALF_Z;z++){
   if(!walkable(x,z))continue;
   if([...npcTiles].some(k=>{const [nx,nz]=k.split(',').map(Number);return Math.abs(nx-x)+Math.abs(nz-z)<minSpacing+1;}))continue;
   candidates.push({x,z,d:(x-wantedX)**2+(z-wantedZ)**2});
 }
 candidates.sort((a,b)=>a.d-b.d||a.x-b.x||a.z-b.z);
 const at=candidates[0];if(!at)return null;
 npcTiles.add(tileKey(at.x,at.z));blockTile(at.x,at.z);
 return person(at.x,at.z,opts);
}
// Four-neighbour route planning for decorative patrols; blocked furniture is
// never crossed, even during animation between adjacent waypoints.
function sceneryRoute(start,end){
 const queue=[{...start,path:[start]}],seen=new Set([tileKey(start.x,start.z)]);
 for(let i=0;i<queue.length;i++){
   const {x,z,path}=queue[i];if(x===end.x&&z===end.z)return path;
   for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
     const nx=x+dx,nz=z+dz,k=tileKey(nx,nz);
     if(!walkable(nx,nz)||seen.has(k))continue;
     seen.add(k);queue.push({x:nx,z:nz,path:[...path,{x:nx,z:nz}]});
   }
 }
 return [start];
}
function tileRoutePosition(path,progress){
 const max=path.length-1;if(max<=0)return new THREE.Vector3(v(path[0].x),0,v(path[0].z));
 const p=THREE.MathUtils.clamp(progress,0,1)*max,i=Math.min(max-1,Math.floor(p)),a=path[i],b=path[i+1],f=p-i;
 return new THREE.Vector3(v(THREE.MathUtils.lerp(a.x,b.x,f)),0,v(THREE.MathUtils.lerp(a.z,b.z,f)));
}
function label(text,position,type='scenery',hidden=false){const el=document.createElement('div');el.className=`room-label ${type}`;el.textContent=text;document.body.appendChild(el);const target={el,position,hidden};labels.push(target);return target;}
function announce(text){$('scene-status').textContent=text.toUpperCase();}
function toast(text){const t=$('toast');t.textContent=text;t.classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove('visible'),3200);}
function light(color,intensity,x,y,z,distance=25){const l=new THREE.PointLight(color,intensity,distance,2);l.position.set(x,y,z);scene.add(l);return l;}
function person(x,z,{robe=0x856d5c,trim=0xd8bd8a,skin=0xc99b7f,hair=0x5b4839,height=1.8,pose='stand',staff=false}={}){
  const g=new THREE.Group();g.position.set(v(x),0,v(z));scene.add(g);
  const s=height/1.8,cl=mat(robe),tr=mat(trim),sk=mat(skin),hr=mat(hair);
  if(pose==='lie'){
    g.rotation.y=Math.PI/2;
    const torso=box(.71,.31,1.04,cl,0,.91,.10,g);
    ball(.25,sk,0,.91,.80,g);box(.46,.18,.27,hr,0,.98,.89,g);
    for(let side of [-1,1]){box(.21,.26,.74,cl,side*.22,.65,-.61,g);box(.17,.17,.38,sk,side*.55,.75,.05,g);}
  }else {
    cyl(.29*s,.42*s,.95*s,cl,0,.78*s+.1,0,g);
    ball(.24*s,sk,0,1.42*s+.13,.04,g);
    ball(.24*s,hr,0,1.56*s+.06,-.04,g);
    for(let side of [-1,1]){
      rod([side*.3*s,1.08*s,.03],[side*.43*s,.58*s,.15],.105*s,cl,g);
      if(pose!=='sit')box(.17*s,.38*s,.18*s,tr,side*.17*s,.29*s,0,g);
    }
    box(.56*s,.08*s,.43*s,tr,0,.88*s,.04,g);
    if(pose==='sit')g.position.y=-.25;
    if(staff){rod([-.50,.26,.16],[-.5,2.25,.16],.058,WOOD,g);ball(.15,glow(0xefd591),-.5,2.3,.16,g);}
  }
  return g;
}
function buildHero(data){
  const g=new THREE.Group();g.userData={type:'piece',id:data.id};g.visible=false;scene.add(g);
  cyl(.43,.46,.17,DARK,0,.25,0,g);
  let c=mat(data.color),cape=mat(data.style==='ice'?0xc9edff:0x3a3354);
  const h=data.style==='rogue'?1.35:1.9;
  cyl(.25,.4,h*.45,c,0,.67,0,g);
  cone(data.style==='ice'?.65:.47,h*.66,c,0,.55,0,g).rotation.z=Math.PI;
  ball(.23,SKIN,0,h*.76,.03,g);
  for(const s of [-1,1])rod([s*.27,1.03,.01],[s*.43,.57,.16],.10,c,g);
  if(data.style==='wizard'){
    cyl(.47,.47,.07,c,0,1.72,0,g);cone(.38,.86,c,.03,2.11,0,g);
    rod([.52,.31,.15],[.58,2.36,.15],.058,GOLD,g);ball(.20,glow(0xb7a2ff),.58,2.42,.15,g);
  }else if(data.style==='ice'){
    const hair=mat(0xe8d49c);ball(.24,hair,0,1.57,-.08,g);for(let i=0;i<6;i++)ball(.09,hair,.27,1.5-i*.15,.18,g);
    const crystal=mesh(new THREE.OctahedronGeometry(.26),glow(0xa5efff),g);crystal.position.set(.46,1.38,.34);
  }else if(data.style==='warlock'){
    cone(.40,.47,cape,0,1.88,0,g);rod([-.52,.35,.14],[-.56,2.31,.14],.075,DARK,g);
    ball(.21,glow(0xab6ae3,1.5),-.56,2.39,.14,g);
  }else if(data.style==='rogue'){
    cone(.34,.4,cape,0,1.27,0,g);
    for(const s of [-1,1]){rod([s*.39,.53,.15],[s*.56,1.04,.36],.042,STONE,g);cone(.11,.34,WHITE,s*.56,1.16,.36,g);}
  }
  return g;
}
function animal(kind){const g=new THREE.Group();g.userData={type:'piece'};
  const hoof=mat(0x5d4c45),beak=mat(0xe3a349),fur=mat(kind==='pig'?0xe5aab0:kind==='cow'?0xe4e0d9:kind==='duck'?0xc5d1a7:0xece0ba);
  if(kind==='chicken'||kind==='duck'){
    const body=ball(.39,fur,0,.62,0,g);body.scale.set(.85,.95,1.3);
    const wing=ball(.22,mat(0xb5aa87),-.23,.67,-.08,g);wing.scale.set(.7,.6,1.0);
    rod([0,.62,.20],[0,1.00,.39],.12,fur,g);ball(.24,fur,0,1.06,.43,g);
    cone(.15,.28,beak,0,1.01,.78,g).rotation.x=Math.PI/2;
    for(const s of [-1,1])rod([s*.17,.40,-.05],[s*.19,.22,.04],.05,beak,g);
    if(kind==='chicken'){for(let i=-1;i<=1;i++)ball(.075,mat(0xcf4e3b),i*.11,1.30,.39,g);}
  }else{
    const body=ball(kind==='cow'?.75:.60,fur,0,1.05,0,g);body.scale.set(.9,.77,1.35);
    for(const s of [-1,1])for(const front of [-1,1])rod([s*.39,.75,front*.46],[s*.42,.29,front*.48],.14,fur,g,.12);
    const head=ball(kind==='cow'?.46:.40,fur,0,1.15,.90,g);head.scale.set(1,.8,.9);
    ball(.28,mat(kind==='cow'?0xe7b8bd:0xf1b6ba),0,1.03,1.18,g);
    for(const s of [-1,1]){ball(.13,fur,s*.42,1.40,.88,g);ball(.055,hoof,s*.15,1.26,1.29,g);}
    if(kind==='cow'){for(const x of [-.34,.29])ball(.24,mat(0x56575d),x,1.52,.12,g);}
    rod([0,1.18,-.75],[0,1.53,-1.13],.08,fur,g,.05);
  }
  cyl(.49,.52,.13,DARK,0,.20,0,g);return g;
}
// Floors have a visible battle grid; the nearly transparent hit plane accepts clicks.
function makeFloor(color=0x717e89){
  scene.background=new THREE.Color(0x111a27);scene.fog=new THREE.FogExp2(0x111926,.014);
  box((HALF_X*2+1)*CELL+1,.37,(HALF_Z*2+1)*CELL+1,DARK,0,-.03,0);
  box((HALF_X*2+1)*CELL,.065,(HALF_Z*2+1)*CELL,mat(color),0,.185,0);
  const lines=[];const w=(HALF_X*2+1)*CELL,d=(HALF_Z*2+1)*CELL;
  for(let i=0;i<=HALF_X*2+1;i++){const x=-w/2+i*CELL;lines.push(x,FLOOR+.018,-d/2,x,FLOOR+.018,d/2);}
  for(let i=0;i<=HALF_Z*2+1;i++){const z=-d/2+i*CELL;lines.push(-w/2,FLOOR+.018,z,w/2,FLOOR+.018,z);}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(lines,3));
  scene.add(new THREE.LineSegments(geo,new THREE.LineBasicMaterial({color:0xecd9b1,opacity:.35,transparent:true,depthWrite:false})));
  const plane=mesh(new THREE.PlaneGeometry(w,d),new THREE.MeshBasicMaterial({opacity:0,transparent:true,depthWrite:false,side:THREE.DoubleSide}));
  plane.rotation.x=-Math.PI/2;plane.position.y=FLOOR+.046;plane.userData.type='floor';staticTargets.push(plane);
  overlay=new THREE.InstancedMesh(new THREE.PlaneGeometry(CELL*.92,CELL*.92),new THREE.MeshBasicMaterial({color:0x85e6d8,opacity:.35,transparent:true,depthWrite:false,side:THREE.DoubleSide}),(HALF_X*2+1)*(HALF_Z*2+1));
  overlay.count=0;overlay.frustumCulled=false;scene.add(overlay);
}
function walls(color=0x515b68, height=4){
  const m=mat(color),w=(HALF_X*2+1)*CELL,d=(HALF_Z*2+1)*CELL;
  // Behind and sides: open at the front so the isometric camera sees the miniature board.
  box(w+.8,height,.48,m,0,height/2,-d/2-.35);
  for(const side of [-1,1]){box(.48,height,d+.9,m,side*(w/2+.30),height/2,0);
    for(let z=-8;z<=8;z+=4){cyl(.32,.42,height+.4,STONE,side*(w/2-.2),(height+.4)/2,v(z));cyl(.48,.48,.20,GOLD,side*(w/2-.2),height+.25,v(z));}
  }
  for(let x=-10;x<=10;x+=4){cyl(.28,.35,height+.6,STONE,v(x),(height+.6)/2,-d/2+.15);ball(.25,glow(0xeaca8e),v(x),height+.96,-d/2+.15);}
}
function carpet(x,z,w,d,color=0x893a49){box(w,.045,d,mat(color),x,FLOOR+.045,z);box(.05,.06,d,GOLD,x-w/2+.12,FLOOR+.08,z);box(.05,.06,d,GOLD,x+w/2-.12,FLOOR+.08,z);}
function table(x,z,w=3.7,d=1.5){box(w,.19,d,LWOOD,v(x),1.17,v(z));for(const sx of [-1,1])for(const sz of [-1,1])box(.23,.94,.23,WOOD,v(x)+sx*(w/2-.30),.65,v(z)+sz*(d/2-.27));blockRect(x,z,Math.floor(w/(2*CELL)),0);}
function food(x,y,z){cyl(.37,.37,.04,WHITE,x,y,z,scene,16);ball(.20,mat(0xd4a35f),x-.06,y+.10,z);ball(.10,mat(0x6e9160),x+.17,y+.09,z+.08);}
function bench(x,z,w=2.6){box(w,.18,.65,WOOD,v(x),.63,v(z));for(const xOff of [-w/2+.3,w/2-.3])box(.17,.48,.52,DARK,v(x)+xOff,.35,v(z));blockRect(x,z,Math.floor(w/(2*CELL)),0);}
function shelf(x,z,w=3.2,h=3.5){box(w,h,.64,WOOD,v(x),h/2,v(z));for(let k=0;k<3;k++){box(w+.2,.14,.98,LWOOD,v(x),.7+k*1.12,v(z));for(let j=-2;j<=2;j++){const c=mat([0x7d785a,0xc5a76a,0xa96342,0x7d8a6c][(k+j+8)%4]);box(.28,.52,.42,c,v(x)+j*.52,1.0+k*1.12,v(z));}}blockRect(x,z,1,0);}
function lantern(x,z,color=0xffd996){cyl(.28,.28,.11,GOLD,v(x),3.0,v(z));ball(.28,glow(color,1.1),v(x),2.86,v(z));light(color,6,v(x),2.8,v(z),12);}
function createPortal(x,z,id,title,scale=1){const g=new THREE.Group();g.position.set(v(x),0,v(z));scene.add(g);g.userData={type:'portal',room:id};
  for(const s of [-1,1])box(.38,2.7*scale,.44,STONE,s*1.05,1.4*scale,0,g);
  box(2.55,.35,.53,GOLD,0,2.83*scale,0,g);
  const door=box(1.86,2.35*scale,.16,mat(0x2c3754,.05,.75),0,1.3*scale,0,g);
  const circle=ring(.79,.08,glow(0xc1b3ff),0,1.45*scale,.13,g);circle.rotation.x=0;
  ball(.28,glow(0xd8c9a2),0,1.43*scale,.2,g);
  label(`↗ ${title}`,g.position.clone().add(new THREE.Vector3(0,3.9*scale,0)),'portal');
  // All descendants inherit the parent portal id when raycast.
  staticTargets.push(g);blockTile(x,z);return g;
}
function tomb(x,z,name){const g=new THREE.Group();g.position.set(v(x),0,v(z));scene.add(g);
  box(2.4,.65,3.6,DARK,0,.55,0,g);box(2.16,.23,3.35,STONE,0,.98,0,g);
  box(1.3,.12,1.4,GOLD,0,1.11,-.5,g);rod([-.38,1.18,-.5],[.38,1.18,-.5],.08,GOLD,g);rod([0,1.14,-.98],[0,1.14,-.04],.09,GOLD,g);
  blockRect(x,z,1,1);return g;
}

function dragonStatue(x,z){
 const g=new THREE.Group();g.position.set(v(x),0,v(z));scene.add(g);
 const silver=mat(0xc6ccd1,.44),wing=mat(0x9aa9b6,.3),crest=glow(0xbce9ff,.8);
 cyl(3.0,3.5,.75,STONE,0,.60,0,g,10);cyl(2.65,2.86,.4,GOLD,0,1.10,0,g,10);
 ball(1.25,silver,0,3.12,0,g).scale.set(1.15,1.45,.85);
 ball(.94,silver,0,4.80,.2,g).scale.set(1,.96,.85);
 rod([0,4.95,.1],[0,7.25,.75],.48,silver,g,.32);
 ball(.56,silver,0,7.35,.88,g);ball(.39,silver,0,7.06,1.65,g).scale.set(.7,.56,1.4);
 for(const s of [-1,1]){
   rod([s*.8,4.7,.3],[s*1.25,3.85,1.2],.30,silver,g,.20);
   rod([s*.92,2.8,.2],[s*1.10,1.63,1.15],.42,silver,g,.33);
   ball(.32,silver,s*1.1,1.65,1.43,g);
   const points=[[s*1.0,5.45,-.4],[s*3.3,8.2,-1.35],[s*6.0,9.20,-1.75],[s*7.30,6.7,-1.8],[s*6.25,4.3,-1.55],[s*3.1,4.3,-.85]];
   const verts=[];for(let i=1;i<points.length-1;i++)verts.push(...points[0],...points[i],...points[i+1]);
   const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));geo.computeVertexNormals();mesh(geo,wing,g);
   for(let i=1;i<points.length;i++)rod(points[0],points[i],.10,silver,g,.04);
   rod([s*.38,7.55,.63],[s*.9,8.6,-.15],.14,silver,g,.03);
   ball(.11,crest,s*.40,7.45,1.35,g);
 }
 for(let k=0;k<8;k++)cone(.24,.48,silver,0,5.8-k*.4,-1.1-k*.12,g);
 const halo=ring(3.0,.075,crest,0,7.0,-2.0,g);animated.push(t=>{halo.rotation.y=Math.sin(t*.13)*.15;});
 for(let i=0;i<3;i++){const c=ring(3.2+i*.28,.05,GOLD,0,1.45+i*.13,0,g);c.rotation.x=-Math.PI/2;}
 blockRect(x,z,2,2);
}
function stainedWindow(x,z,color){const g=new THREE.Group();g.position.set(v(x),0,v(z));scene.add(g);
 box(1.5,3.5,.14,DARK,0,3.6,0,g);
 box(1.24,2.96,.16,glow(color,.5),0,3.6,.1,g);
 for(let i=0;i<4;i++)box(1.40,.08,.20,GOLD,0,2.65+i*.64,.2,g);
 box(.09,3.25,.2,GOLD,0,3.6,.2,g);
}
function buildMass(){
 makeFloor(0x77838d);walls(0x596573,5.6);scene.background=new THREE.Color(0x111727);
 const span=(HALF_X*2+1)*CELL;
 for(let x=-9;x<=9;x+=3){cyl(.65,.72,5.5,STONE,v(x),2.8,-v(8.0));cyl(.85,.90,.3,GOLD,v(x),5.65,-v(8));}
 stainedWindow(-7,-8,0x789dd0);stainedWindow(7,-8,0xda97a8);
 carpet(0,1.0,5.2,20,0x8a3d55);
 dragonStatue(0,-6);
 const altar=box(4.2,1.0,1.5,WHITE,0,.80,-v(3.0));box(4.4,.14,1.7,GOLD,0,1.40,-v(3));blockRect(0,-3,1,0);
 person(0,-2,{robe:0xf0e6d0,trim:0xcbb46e,hair:0xe3dbb7,height:2.05,staff:true});label('Lady Runara',new THREE.Vector3(0,3.0,v(-2)),'character');blockTile(0,-2);
 for(const side of [-1,1]){
   for(let z=-1;z<=6;z+=2){
     bench(side*5,z,4.6);
     person(side*4,z,{robe:0xd1c4ab,trim:0xb8a56b,pose:'sit'});
     person(side*6,z,{robe:0x73828b,trim:0xe1cfac,pose:'sit'});
   }
   for(let i=0;i<4;i++){const x=side*(3+i*1.55);placeStandingNPC(x,8,{robe:i%2?0x70657e:0xa29580,pose:'stand'},1);}
   for(let z=-6;z<=5;z+=4)lantern(side*10,z);
 }
 for(let i=-2;i<=2;i++){const p=placeStandingNPC(i*1.55,-1,{robe:0xe4d6bb,staff:i===0},1);if(p&&i===0)p.rotation.y=.22;}
 // The library gateway stands on the statue's plinth.
 createPortal(0,-4,'library','Hidden Library',.82);
 // The sanctuary is the connected hub; click a portal or use the dropdown above.
 const doors=[[-10,0,'dining-hall','Dining'],[-10,5,'kitchen','Kitchen'],[-7,8,'healing-ward','Healing'],[-3,8,'reliquary','Reliquary'],[3,8,'crypts','Crypts'],[7,8,'hotspring','Hot Spring'],[10,0,'toilets','Toilets'],[-10,-7,'training-field','Training'],[10,-7,'loom-room','Loom Room'],[-10,8,'apple-garden','Apple Garden'],[10,8,'store-room','Store Room']];
 for(const [x,z,id,name] of doors)createPortal(x,z,id,name,.66);
 announce('The Great Mass — Lady Runara greets the faithful');
}
function buildDining(){
 makeFloor(0x846d58);walls(0x665f5d,4.8);carpet(0,0,4.8,19,0x635247);
 for(let x of [-7,-2,3,8])for(let z of [-5,-1,3,7]){
   table(x,z,3.6,1.4);
   for(let k=0;k<3;k++)food(v(x)+(.4-k*.45),1.33,v(z)+.05);
   for(let side of [-1,1]){
     bench(x,z+side*.85,2.6);
     for(let dx of [-.55,.50])person(x+dx,z+side*.75,{robe:(x+z)%2?0x8f7661:0xbdab89,trim:0xcab37b,pose:'sit'});
   }
 }
 for(const s of [-1,1]){shelf(s*10,-5,2.8,3.3);lantern(s*10,6);}
 for(let z=-4;z<=4;z+=4){cyl(.50,.52,3.9,STONE,0,2.14,v(z));cyl(.72,.75,.2,GOLD,0,4.12,v(z));}
 for(let k=0;k<5;k++)ball(.16,mat(0xd6b177),v(-9)+k*.4,2.8,v(3));
 createPortal(0,-9,'mass-chamber','Mass Chamber',.78);
 announce('The dining hall is alive with conversation');
}
function stove(x,z){const g=new THREE.Group();g.position.set(v(x),0,v(z));scene.add(g);
 box(2.4,1.15,1.65,DARK,0,.75,0,g);box(2.5,.12,1.75,STONE,0,1.35,0,g);
 for(let side of [-1,1])for(let dz of [-1,1]){const y=ball(.16,glow(0xe69c39,1.1),side*.7,1.49,dz*.45,g);animated.push(t=>{y.scale.y=.8+.3*Math.sin(t*4+side+dz)});}
 cyl(.45,.42,.34,mat(0x4b555f,.65),0,1.67,0,g);
 const cover=cyl(.53,.55,.11,STONE,0,1.86,0,g);blockRect(x,z,1,0);
}
function choppingStation(x,z){table(x,z,2.3,1.5);const p=box(.93,.07,.76,mat(0xcda870),v(x),1.32,v(z));
 for(let i=0;i<5;i++){ball(.11,mat(i%2?0xc25d3f:0x7ba357),v(x)+rand(-.35,.35),1.45,v(z)+rand(-.2,.2));}
 rod([v(x)-.22,1.44,v(z)+.20],[v(x)+.34,1.44,v(z)+.2],.028,STONE);
}
function barrel(x,z){cyl(.58,.55,1.15,WOOD,v(x),.78,v(z));for(let y of [.36,.84,1.29])cyl(.60,.60,.12,GOLD,v(x),y,v(z));blockTile(x,z);}
function hangingPan(x,z){cyl(.40,.40,.13,mat(0x545e65,.7),v(x),2.45,v(z));rod([v(x),2.55,v(z)],[v(x),4.1,v(z)],.027,GOLD);}
function buildKitchen(){
 makeFloor(0x77786c);walls(0x625e54,4.4);
 for(let x of [-8,-4,3,8])stove(x,-6);
 for(let x of [-8,-3,3,8])choppingStation(x,-2);
 for(let x of [-7,-2,3,8]){
   const g=new THREE.Group();g.position.set(v(x),0,v(2));scene.add(g);
   box(2.7,.85,1.3,mat(0x70818a),0,.83,0,g);box(2.8,.10,1.45,WHITE,0,1.30,0,g);
   cyl(.55,.52,.34,STONE,0,1.39,0,g);cyl(.40,.40,.10,mat(0x51637a,.55),0,1.56,0,g);blockRect(x,2,1,0);
 }
 for(let x of [-9,-5,5,9])for(let z of [5,7])barrel(x,z);
 for(let x of [-8,-4,2,7])hangingPan(x,-4);
 shelf(-10,-3,3.5,3.5);shelf(10,-3,3.2,3.7);
 for(let x of [-2,0,2])for(let z of [6,8]){const veg=ball(.25,mat((x+z)%3?0xb99c50:0xa96843),v(x),.52,v(z));blockTile(x,z);}
 placeStandingNPC(-9,0,{robe:0xf0e4d1,trim:0x6b6559});placeStandingNPC(10,1,{robe:0xd7cab1,trim:0x756758});
 createPortal(0,-9,'mass-chamber','Mass Chamber',.76);
 announce('The temple kitchen — choose an animal to summon');
}
function bed(x,z){
 const g=new THREE.Group();g.position.set(v(x),0,v(z));scene.add(g);
 // Pillow is at POSITIVE Z. Patients lie lengthways, facing upwards, head on pillow.
 box(1.74,.27,3.35,WOOD,0,.50,0,g);
 box(1.52,.24,3.02,WHITE,0,.75,0,g);
 box(1.50,.12,1.46,mat(0x9bb6bd),0,.84,-.70,g);
 box(1.26,.22,.64,mat(0xf1e9dd),0,.92,1.17,g);
 box(1.81,.76,.13,LWOOD,0,.72,-1.70,g);
 box(1.81,.55,.13,LWOOD,0,.77,1.70,g);
 // Occupancy extends to the foot and head of each cot.
 blockRect(x,z,0,1);
}
function sailorPatient(x,z,index){
 const g=new THREE.Group();g.position.set(v(x),0,v(z));scene.add(g);
 const jackets=[0x364e62,0x804c48,0x556977,0x8c785f],shirts=[0xebe3cb,0xc4d2cf,0xe6d9bd];
 const jacket=mat(jackets[index%jackets.length]),shirt=mat(shirts[index%shirts.length]);
 const trouser=mat(index%2?0x53473d:0x313f4a),leather=mat(0x694733),bandage=mat(0xeee5d6);
 // Horizontal along Z with head at +1.15. No 90-degree rotation (former bug).
 box(.70,.28,.96,shirt,0,1.02,.19,g); // sailor shirt, shoulders near the pillow
 box(.73,.15,.28,jacket,0,1.15,-.20,g); // vest / leather corset
 for(let k=0;k<3;k++)box(.71,.018,.065,mat(index%2?0x456579:0x3c5e7b),0,1.173,.05+k*.19,g);
 box(.71,.11,.14,leather,0,1.10,-.31,g); // belt
 cyl(.09,.09,.035,GOLD,0,1.18,-.30,g);
 const head=ball(.27,mat(index%3===0?0xb77e61:index%3===1?0xd7aa85:0xe2be9f),0,1.15,1.01,g);
 // Nose and dark eyes identify the direction the sailor faces.
 ball(.075,SKIN,0,1.18,1.26,g);
 for(const side of [-1,1])ball(.033,DARK,side*.12,1.36,1.12,g);
 if(index%3===0){ // headscarf / bandana
   ball(.276,mat(0x9f4d42),0,1.30,1.00,g).scale.set(1.03,.42,1.0);
   box(.14,.10,.38,mat(0x9f4d42),.24,1.17,.96,g);
 }else if(index%3===1){ // sailor's cap with brim
   cyl(.27,.26,.15,WHITE,0,1.43,1.02,g,12);box(.54,.065,.18,mat(0x324a60),0,1.42,1.24,g);
 }else{ // wrapped head injury
   ball(.28,mat(0x6b4e39),0,1.31,1.01,g).scale.y=.4;
   box(.47,.07,.37,bandage,0,1.36,1.04,g);
 }
 for(const side of [-1,1]){
   // Arms and legs lie horizontally, rather than protruding through the mattress.
   rod([side*.47,1.02,.51],[side*.51,1.01,-.30],.12,shirt,g);
   ball(.13,SKIN,side*.51,1.03,-.33,g);
   rod([side*.18,1.00,-.34],[side*.18,.97,-1.16],.165,trouser,g);
   box(.32,.23,.42,leather,side*.18,.99,-1.35,g);
 }
 // Bandages make some patients visibly wounded; blankets cover their legs only.
 if(index%2===0)box(.21,.12,.20,bandage,-.52,1.04,.10,g);
 if(index%3===2)box(.75,.07,.68,mat(0x9eb2b6),0,1.23,-.81,g);
 return g;
}
function makeMedicalScreen(x,z){
 // Folded side screen rather than a full-height translucent wall obscuring beds.
 const frame=mat(0x798b86),cloth=mat(0xd9e8d9,.02,.36),px=v(x),pz=v(z);
 for(const sx of [-1,1])rod([px+sx*.72,.20,pz],[px+sx*.72,2.20,pz],.035,frame);
 box(1.44,.93,.06,cloth,px,1.67,pz);
 box(1.50,.07,.11,frame,px,2.14,pz);
}
function buildHealing(){
 makeFloor(0xa6b5ad);walls(0x879c9a,4.6);
 const beds=[[-8,-4],[-3,-4],[3,-4],[8,-4],[-8,2],[-3,2],[3,2],[8,2]];
 beds.forEach(([x,z],i)=>{
   bed(x,z);sailorPatient(x,z,i);
   // Open foot-of-bed layout. Screens are behind the headboards to preserve sightlines.
   if(i===0||i===3||i===4||i===7)makeMedicalScreen(x+.9,z+2.1);
   // A small wooden bedside stand, separated from the patient mattress.
   const bx=v(x)+(x<0?-1.40:1.40),bz=v(z)+.22;
   box(.51,.68,.60,LWOOD,bx,.57,bz);cyl(.15,.17,.29,mat(0xa2c9c4),bx,.99,bz);
 });
 // Staff stand in clear aisles and their tiles are reserved for token movement.
 const staff=[[-10,7,0xf1dfc7],[-1,7,0xeee2d0],[10,7,0xd7e4d7]];
 staff.forEach(([x,z,robe],i)=>{
   const healer=placeStandingNPC(x,z,{robe,trim:0xc6aa78,staff:i===1},2);
   if(healer)label(i===1?'Temple Healer':'Ward Attendant',healer.position.clone().add(new THREE.Vector3(0,2.8,0)),'character');
 });
 for(const x of [-6,6]){
   box(1.5,1.12,.75,LWOOD,v(x),.72,v(7));blockTile(x,7);
   for(let i=0;i<3;i++)cyl(.11,.15,.4,mat(i===1?0x64a4aa:0xc7a4a4),v(x)+(i-1)*.35,1.46,v(7));
 }
 shelf(-10,-8,3.2,3.5);shelf(10,-8,3.2,3.5);
 for(let k=-3;k<=3;k++)ball(.17,glow(0xa4ffd8,.4),v(k),3.7,-v(7.5));
 createPortal(0,-9,'mass-chamber','Mass Chamber',.75);
 announce('Wounded sailors and pirates rest beneath Bahamut’s protection');
}

function exhibit(x,z,type){const g=new THREE.Group();g.position.set(v(x),0,v(z));scene.add(g);
 cyl(.94,1.08,.72,DARK,0,.56,0,g);cyl(.88,.95,.12,GOLD,0,.96,0,g);
 if(type==='boots')for(const s of [-1,1]){box(.34,.65,.43,mat(0x68816e),s*.28,1.44,-.08,g);box(.41,.22,.69,mat(0x497164),s*.28,1.15,.23,g);box(.34,.08,.50,GOLD,s*.28,1.51,.14,g);}
 if(type==='manta'){
   const points=[-1.1,1.5,0,0,2.25,-.2,1.1,1.5,0,0,2.25,-.2,0,1.27,.7,-1.1,1.5,0];
   const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(points,3));geo.computeVertexNormals();mesh(geo,mat(0x163d58,.3,.93),g);
   ball(.2,glow(0x78b9d3),0,1.79,.1,g);
 }
 if(type==='slipper'){
   box(.49,.14,.85,mat(0x8be6f7,.22,.58),0,1.23,0,g);
   const heel=box(.23,.34,.25,mat(0xa4edff,.3,.62),0,1.20,-.23,g);
 }
 if(type==='rose'){
   rod([0,1.13,0],[0,2.05,0],.058,LEAF,g);
   for(let i=0;i<6;i++){const a=i*Math.PI/3;ball(.25,mat(0xc64d62),Math.cos(a)*.19,2.16,Math.sin(a)*.19,g);}
   ball(.15,glow(0xffc1d6,1.25),0,2.26,0,g);
   ball(.25,LEAF,-.2,1.62,0,g).scale.set(1.2,.25,.5);
 }
 const glass=mesh(new THREE.CylinderGeometry(.82,.84,2.32,10,1,true),mat(0xb8d7ed,.02,.14),g);glass.position.y=2.05;
 const top=cyl(.91,.91,.12,GOLD,0,3.23,0,g);
 label(({boots:'Boots of Elvenkind',manta:'Cloak of the Manta Ray',slipper:'Glass Slipper',rose:'Magical Rose'})[type],g.position.clone().add(new THREE.Vector3(0,3.75,0)),'artifact');
 blockRect(x,z,0,0);
}
function cloakRack(x,z){const g=new THREE.Group();g.position.set(v(x),0,v(z));scene.add(g);
 rod([0,.3,0],[0,3.0,0],.08,WOOD,g);for(const s of [-1,1])rod([0,2.78,0],[s*.72,2.78,0],.075,WOOD,g);
 cyl(.63,.80,.15,WOOD,0,.37,0,g);
 const cape=cone(.78,1.9,mat(0x74508c),0,1.75,.15,g);cape.rotation.z=Math.PI;
 for(let i=0;i<4;i++)ball(.11,GOLD,Math.sin(i*1.6)*.66,1.34,Math.cos(i*1.6)*.24,g);
 label('Cloak of Bellowing',g.position.clone().add(new THREE.Vector3(0,3.4,0)),'artifact');blockTile(x,z);
}
function buildReliquary(){
 makeFloor(0x586177);walls(0x434a5b,5.5);carpet(0,0,5.5,23,0x643b68);
 for(const [x,z,type] of [[-7,-4,'boots'],[0,-4,'manta'],[7,-4,'slipper'],[0,3,'rose']])exhibit(x,z,type);
 cloakRack(8,4);
 for(let x of [-10,10])for(let z of [-6,0,6])lantern(x,z,0xc8b9ff);
 for(let x of [-4,4])for(let z of [-7,7]){cyl(.48,.59,3.6,DARK,v(x),2.0,v(z));cyl(.65,.65,.2,GOLD,v(x),3.88,v(z));blockTile(x,z);}
 createPortal(0,-9,'mass-chamber','Mass Chamber',.75);
 // Standwatch guards are placed apart from display cases and from each other.
 placeStandingNPC(-9,5,{robe:0xa78c60,trim:0xe2d09c,staff:true,height:2.0},2);
 placeStandingNPC(9,7,{robe:0xa78c60,trim:0xe2d09c,staff:true,height:2.0},2);
 // Moving patrols follow four-neighbour routes computed from blocked furniture.
 // Their entrance and active cycles are staggered to avoid clumping together.
 const plans=[
   [{x:-2,z:-8},{x:-6,z:1}],
   [{x:2,z:-8},{x:6,z:1}],
   [{x:1,z:-8},{x:3,z:6}]
 ];
 const guards=plans.map(([start,destination],i)=>{
   const path=sceneryRoute(start,destination);
   const npc=person(start.x,start.z,{robe:i===1?0x9aafad:0xbba05b,trim:0xe5d7a5,staff:true,height:2.0});
   return {npc,path,last:tileRoutePosition(path,0)};
 });
 animated.push(t=>{
   for(let i=0;i<guards.length;i++){
     const guard=guards[i],phase=(t+i*19)%81;
     // 0-15 enter, 15-36 watch, 36-51 exit, 51-81 off duty.
     const active=phase<51;
     guard.npc.visible=active;if(!active)continue;
     let fraction=phase<15?phase/15:phase<36?1:1-(phase-36)/15;
     const next=tileRoutePosition(guard.path,fraction);
     // Decorative NPCs pause rather than walking through a player's miniature.
     const nearPlayer=allSpawned().some(p=>p.root.position.distanceTo(next)<CELL*.72);
     if(!nearPlayer)guard.last.copy(next);
     guard.npc.position.copy(guard.last);
     guard.npc.rotation.y=phase<36?0:Math.PI;
   }
 });
 announce('The treasures of Bahamut are guarded by the faithful');
}
function guardian(x,z){
 const g=new THREE.Group();g.position.set(v(x),0,v(z));scene.add(g);
 const armor=glow(0xffe6a2,2.7),bright=glow(0xfff5c9,3.4),wing=glow(0xd1f2ff,1.9);
 const steel=mat(0xb8ccdc,.68),shadow=mat(0xc1aa72,.52);
 // Larger armored celestial with brilliant helmet, sword, and holy shield.
 cyl(.42,.60,1.25,armor,0,1.22,0,g);
 ball(.32,bright,0,2.10,.07,g);
 cone(.32,.67,bright,0,2.54,-.03,g);
 box(.65,.23,.30,GOLD,0,1.78,.28,g);
 for(const side of [-1,1]){
   rod([side*.34,1.70,0],[side*.62,.92,.20],.17,armor,g);
   rod([side*.25,.75,-.03],[side*.28,.24,.02],.18,armor,g);
   const tri=[side*.27,1.73,-.17, side*1.08,3.36,-.37, side*1.68,2.88,-.34,
              side*.27,1.73,-.17,side*1.68,2.88,-.34,side*1.25,1.55,-.43];
   const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(tri,3));geo.computeVertexNormals();
   mesh(geo,mat(0xd9ecf5,.08,.75),g);
   rod([side*.30,1.69,-.14],[side*1.08,3.36,-.40],.09,wing,g,.03);
   rod([side*.30,1.69,-.14],[side*1.69,2.88,-.37],.07,wing,g,.03);
 }
 // Sword: blade, crossguard and luminous gem.
 rod([.70,.65,.42],[.70,3.20,.42],.087,steel,g,.018);
 box(.59,.10,.15,GOLD,.70,1.02,.42,g);
 ball(.12,bright,.70,1.07,.55,g);
 // Broad shield, embossed with a platinum sun.
 const shield=ball(.67,shadow,-.80,1.26,.63,g);shield.scale.set(.76,1.21,.22);
 const rim=ring(.52,.06,bright,-.80,1.27,.79,g);rim.scale.y=1.35;
 rod([-.80,.94,.82],[-.80,1.59,.82],.055,bright,g);
 rod([-1.04,1.31,.83],[-.56,1.31,.83],.055,bright,g);
 // Persistent radiant runic circles lying ON the floor, not vertical rings.
 const auras=[];
 const floorDisc=mesh(new THREE.CircleGeometry(1.55,48),mat(0xffe6a3,.02,.21),g);
 floorDisc.rotation.x=-Math.PI/2;floorDisc.position.y=FLOOR+.06;
 for(const [radius,tube,shade,y] of [[1.47,.09,0xffeec3,FLOOR+.11],[1.92,.055,0xf0c976,FLOOR+.13],[2.25,.045,0xffffff,FLOOR+.14]]){
   const circle=ring(radius,tube,glow(shade,3.4),0,y,0,g);
   circle.rotation.x=-Math.PI/2;auras.push(circle);
 }
 const verticalHalo=ring(1.23,.065,bright,0,1.84,-.23,g);
 const crown=ring(.55,.07,bright,0,2.99,.0,g);crown.rotation.x=-Math.PI/2;
 const auraLight=new THREE.PointLight(0xffe4a7,17,11,1.3);auraLight.position.set(0,2.1,.15);g.add(auraLight);
 animated.push(t=>{
   // Only the figure hovers. Its circles remain level near the floor.
   const bob=.12*Math.sin(t*1.2+x);g.position.y=bob;
   g.rotation.y=Math.sin(t*.23+z)*.08;
   floorDisc.material.opacity=.16+.07*Math.sin(t*1.7+x)**2;
   auras.forEach((a,i)=>a.rotation.z=t*(i%2?-.11:.12));
   verticalHalo.rotation.y=t*.36;verticalHalo.rotation.z=Math.sin(t*.5)*.12;
   auraLight.intensity=15+4*Math.sin(t*2+x);
 });
 label('Guardian of Faith',g.position.clone().add(new THREE.Vector3(0,4.05,0)),'character');
 blockRect(x,z,1,1); // Radiant circle and guardian are an obstacle to movement.
}

function buildCrypts(){
 makeFloor(0x505c69);walls(0x343f4d,5.4);scene.fog=new THREE.FogExp2(0x111926,.027);
 carpet(0,0,3.2,24,0x403f58);
 for(let x of [-9,-5,5,9])for(let z of [-5,0,5])tomb(x,z);
 for(let x of [-3,3])for(let z of [-7,7]){
   cyl(.78,.85,3.65,STONE,v(x),2.05,v(z));cyl(1,1,.22,GOLD,v(x),4,v(z));
   ball(.28,glow(0xdcbf88,.75),v(x),4.55,v(z));blockTile(x,z);
 }
 guardian(-3,-3);guardian(3,-3);guardian(-3,4);guardian(3,4);
 // Altar and memorial in the north: stone steps and a prominent inscription dais.
 box(7,.58,3.6,DARK,0,.60,-v(7));box(6.2,.22,2.9,GOLD,0,1.04,-v(7));
 box(3.0,1.4,1.10,STONE,0,1.72,-v(7));blockRect(0,-7,2,1);
 for(let i=0;i<8;i++){const x=rand(-14,14),z=rand(-10,10),p=ball(.045,glow(0xbcb3e5,.6),x,rand(1.5,5),z);animated.push(t=>{p.position.y+=.003*Math.sin(t*1.0+x);});}
 createPortal(0,-9,'mass-chamber','Mass Chamber',.73);
 announce('Guardians of Faith protect the honored dead');
}
function tree(x,z){const g=new THREE.Group();g.position.set(v(x),0,v(z));scene.add(g);
 cyl(.35,.51,3.0,WOOD,0,1.62,0,g);
 for(const p of [[-1.0,3.3,.3],[.7,3.7,-.3],[.2,4.1,.7],[-.8,4.5,-.2]]){
   const flower=ball(1.08,mat(0xd7a5bd),...p,g,1);flower.scale.y=.72;
 }
 for(let i=0;i<8;i++)ball(.10,mat(0xf2bfd1),rand(-1.8,1.8),rand(2.3,5),rand(-1.8,1.8),g);
 blockTile(x,z);
}
function waterBath(x,z,w,d){const g=new THREE.Group();g.position.set(v(x),0,v(z));scene.add(g);
 box(w+.90,.85,d+.90,STONE,0,.55,0,g);
 box(w+.35,.14,d+.35,mat(0x607a83),0,1.01,0,g);
 const surface=box(w,.08,d,mat(0x7dbfc4,.2,.75),0,1.11,0,g);
 for(let s of [-1,1])box(w+.85,.20,.42,STONE,0,1.2,s*(d/2+.2),g);
 for(let s of [-1,1])box(.42,.20,d+.55,STONE,s*(w/2+.2),1.2,0,g);
 for(let i=0;i<7;i++){
   const cloud=ball(rand(.25,.48),mat(0xd8e8e6,0,.3),rand(-w*.35,w*.35),rand(1.5,2.2),rand(-d*.37,d*.37),g);
   animated.push(t=>{cloud.position.y=1.9+((t*.12+i*.21)%1)*1.25;cloud.material.opacity=.12+.18*Math.sin(t*.7+i)**2;});
 }
 for(let ix=-w/(2*CELL);ix<=w/(2*CELL);ix++)for(let iz=-d/(2*CELL);iz<=d/(2*CELL);iz++)blockTile(x+Math.round(ix),z+Math.round(iz));
 animated.push(t=>{surface.position.y=1.11+.03*Math.sin(t*.7+x);});
}
function buildHotSpring(){
 makeFloor(0x6f8270);walls(0x394e45,2.6);scene.background=new THREE.Color(0x202d30);scene.fog=new THREE.FogExp2(0x273537,.02);
 waterBath(-5,-2,10.5,10.0);waterBath(6,2,7,7);
 for(let x of [-10,-8,9,11])for(let z of [-8,8])tree(x,z);
 // Traditional timber walkway, changing area, paper lanterns and a bamboo screen.
 for(let x of [-5,-3,-1,1,3,5])box(1.35,.09,4.2,WOOD,v(x),FLOOR+.1,v(7));
 for(let x of [-2,5])for(let z of [-7,7]){
   rod([v(x),.25,v(z)],[v(x),3.9,v(z)],.07,WOOD);
   const lanternBody=box(.55,.85,.55,glow(0xffdcb1,.55),v(x),3.20,v(z));
   box(.72,.1,.72,DARK,v(x),3.68,v(z));
 }
 for(let i=-7;i<8;i++)rod([v(i*.95),.4,v(-8)],[v(i*.95),2.6,v(-8)],.10,mat(0x71835b));
 for(let z of [-7,-4,-1]){const rock=ball(rand(.55,.85),STONE,v(10),.56,v(z));rock.scale.set(1.4,.66,1.1);}
 createPortal(0,-9,'mass-chamber','Mass Chamber',.72);
 announce('Steam rises from the temple’s outdoor onsen');
}
function toiletFixture(x,z){
 const g=new THREE.Group();g.position.set(v(x),0,v(z));scene.add(g);
 const porcelain=mat(0xf4f2eb),water=mat(0x86b7c3,.15,.82);
 // Tank rests against the rear stall wall. Open seat and bowl face the door.
 box(.80,.85,.43,porcelain,0,.73,-.54,g);
 cyl(.47,.44,.35,porcelain,0,.54,.15,g,18);
 cyl(.33,.33,.045,water,0,.74,.16,g,18);
 const seat=ring(.38,.065,porcelain,0,.81,.15,g);seat.rotation.x=-Math.PI/2;
 box(.85,.06,.9,porcelain,0,.31,.11,g);
 box(.10,.12,.15,STONE,.27,1.17,-.57,g); // flush lever
 blockTile(x,z);
}
function washSinkCounter(x,z){
 const g=new THREE.Group();g.position.set(v(x),0,v(z));scene.add(g);
 box(9.8,.20,1.42,WHITE,0,1.04,0,g);
 box(9.7,.92,1.1,mat(0x6a7378),0,.52,0,g);
 box(10.0,.10,1.7,mat(0xc4b6a0),0,1.17,0,g);
 for(const dx of [-3.15,0,3.15]){
   // Recessed ceramic basin, blue water, curved tap and individual mirror.
   cyl(.56,.50,.15,mat(0xe6e9e8),dx,1.22,-.02,g,18);
   cyl(.43,.43,.035,mat(0x82b7c5,.2,.85),dx,1.305,-.01,g,18);
   rod([dx,1.30,-.43],[dx,1.66,-.43],.045,STONE,g);
   rod([dx,1.65,-.43],[dx,1.65,-.10],.042,STONE,g);
   box(2.16,1.46,.11,GOLD,dx,2.39,-.62,g);
   box(1.94,1.27,.125,mat(0xbdd4e2,.28,.78),dx,2.39,-.53,g);
   box(.60,.30,.07,WHITE,dx+.9,1.83,-.54,g); // clean folded towel
 }
 for(let xoff=-3;xoff<=3;xoff+=3)blockTile(Math.round(x+xoff/CELL),z);
}
function enclosedStall(x,z,index,isMen){
 const g=new THREE.Group();g.position.set(v(x),0,v(z));scene.add(g);
 const wall=mat(isMen?0x627b83:0x8994a0),doorMat=mat(isMen?0x9db7b3:0xbea9af);
 const depth=4.95,width=4.22,side=width/2;
 // Proper floor-to-ceiling partition panels (not floating single strips).
 for(const s of [-1,1])box(.14,2.70,depth,wall,s*side,1.48,0,g);
 box(width,.21,.14,GOLD,0,2.82,depth/2,g);
 box(width,2.75,.13,wall,0,1.48,-depth/2,g);
 // Door is attached to a visible left hinge, slightly ajar toward the aisle.
 const hinge=new THREE.Group();hinge.position.set(-side+.14,0,depth/2);g.add(hinge);
 const door=box(width*.78,2.37,.105,doorMat,(width*.78)/2,1.34,0,hinge);
 hinge.rotation.y= index%2===0?-.35:-.17;
 ball(.055,GOLD,width*.68,1.28,.10,hinge);
 // Door frame and gaps at top/bottom make each enclosure read as a cubicle.
 box(.12,2.7,.16,GOLD,side-.08,1.46,depth/2,g);
 box(.12,2.7,.16,GOLD,-side+.08,1.46,depth/2,g);
 toiletFixture(x,z-1);
 // Partitions block lateral movement through neighbouring cubicles.
 for(const sideSign of [-1,1])for(let dz=-2;dz<=1;dz++)blockTile(x+sideSign,z+dz);
}
function urinal(x,z){
 const g=new THREE.Group();g.position.set(v(x),0,v(z));scene.add(g);
 const porcelain=mat(0xf2f0e8);
 box(.18,1.17,.82,porcelain,-.24,1.26,0,g);
 const bowl=ball(.44,porcelain,.10,1.04,0,g);bowl.scale.set(.66,1.01,.96);
 const water=ball(.23,mat(0x91bec6,.16,.75),.30,.95,0,g);water.scale.set(.30,.25,.77);
 box(.16,.16,.11,STONE,-.23,2.10,0,g);rod([-.23,2.10,0],[-.23,1.90,0],.026,STONE,g);
 box(.10,1.58,1.03,mat(0x597482),-.45,1.10,0,g); // ceramic side screen
 blockTile(x,z);
}
function buildToilets(){
 makeFloor(0x9badaa);walls(0x7d9292,3.9);
 // Clear visual gender separation, private cubicles, proper wash stations.
 box(.42,3.72,26.8,STONE,0,1.89,0);
 for(let z=-8;z<=8;z++)blockTile(0,z);
 for(const side of [-1,1]){
   const isMen=side<0,coords=side<0?[-8,-5,-2]:[2,5,8];
   for(let i=0;i<coords.length;i++)enclosedStall(coords[i],-4,i,isMen);
   washSinkCounter(side*5.2,7);
   // A clearly labelled entrance for each wing.
   label(isMen?'MEN':'WOMEN',new THREE.Vector3(v(side*5.5),4.0,-v(8)),'artifact');
   for(let i=0;i<3;i++){
     // towel rail and decorative soap beside the sinks
     const tx=v(side*5.2)+(i-1)*2.3;
     rod([tx,1.85,v(7)+.87],[tx+1.1,1.85,v(7)+.87],.05,GOLD);
     box(.49,.48,.09,mat(isMen?0xa6cece:0xe0c2c8),tx+.34,1.65,v(7)+.90);
   }
 }
 // ONLY the men's (left) washroom has wall-mounted urinals.
 for(const z of [0,2,4])urinal(-10,z);
 // An in-world exit in each wing, accessible without passing through the central wall.
 createPortal(-5,-9,'mass-chamber','Mass Chamber',.64);
 createPortal(5,-9,'mass-chamber','Mass Chamber',.64);
 announce('Private stalls, sinks and men’s urinals in separate washrooms');
}

// Four additional temple chambers. All share the original DM camera and grid.
function trainingDummy(x,z,type='straw'){
 const g=new THREE.Group();g.position.set(v(x),0,v(z));scene.add(g);
 const straw=mat(0xd8b77b),rope=mat(0xa88b63),red=mat(0xb65e48);
 cyl(.20,.25,2.68,WOOD,0,1.55,0,g);
 for(const s of [-1,1])rod([0,.34,0],[s*.9,.22,.20],.10,WOOD,g);
 if(type==='target'){
   const target=cyl(.84,.84,.20,WOOD,0,1.83,.23,g,22);target.rotation.x=Math.PI/2;
   const rings=[.73,.53,.31];rings.forEach((rad,i)=>ring(rad,.055,i%2?WHITE:red,0,1.83,.36+i*.012,g));
   ball(.12,mat(0xe9bd4d),0,1.83,.46,g);
 }else{
   cyl(.48,.45,1.14,straw,0,1.68,0,g);
   cyl(.33,.32,.50,straw,0,2.52,0,g);
   rod([-.95,2.12,0],[.95,2.12,0],.13,WOOD,g);
   for(const s of [-1,1])cyl(.22,.22,.73,straw,s*.7,1.89,0,g);
   box(.82,.18,.16,rope,0,1.45,.46,g);
   ring(.26,.040,red,0,1.95,.50,g);
   ball(.10,red,0,1.95,.53,g);
 }
 blockTile(x,z);
}
function monkMini(kind){
 const g=new THREE.Group();g.userData.type='piece';
 const senior=kind==='monk-instructor',tunic=mat(senior?0x677c66:0xc4a377),under=mat(0xf2dec0),belt=mat(0x6b4a35);
 cyl(.29,.43,.93,tunic,0,.80,0,g);
 cone(.42,.55,tunic,0,.59,0,g).rotation.z=Math.PI;
 ball(.25,mat(0xc69472),0,1.49,.06,g);
 ball(.18,mat(0x4f382e),0,1.68,-.04,g).scale.y=.34;
 for(const side of [-1,1]){
   rod([side*.30,1.17,0],[side*.46,.66,.18],.11,under,g);
   rod([side*.16,.58,0],[side*.16,.19,0],.13,tunic,g);
   box(.28,.14,.40,mat(0x51453a),side*.16,.16,.09,g);
 }
 box(.62,.10,.33,belt,0,.84,.08,g);
 if(senior){rod([.55,.16,.15],[.60,2.47,.14],.06,WOOD,g);ball(.12,GOLD,.61,2.48,.14,g);}
 else {box(.18,.20,.18,WHITE,-.43,.70,.20,g);box(.18,.20,.18,WHITE,.43,.70,.20,g);}
 cyl(.45,.47,.15,DARK,0,.14,0,g);
 return g;
}
function buildTraining(){
 makeFloor(0xa99678);scene.background=new THREE.Color(0x627988);scene.fog=new THREE.FogExp2(0x73898a,.010);
 // Outdoor temple courtyard. Low fences keep the combat grid readable.
 const w=(HALF_X*2+1)*CELL,d=(HALF_Z*2+1)*CELL;
 box(w,.75,.32,STONE,0,.54,-d/2-.22);
 for(const side of [-1,1])box(.31,.72,d,STONE,side*(w/2+.22),.54,0);
 for(let x=-10;x<=10;x+=4){cyl(.35,.41,2.2,WOOD,v(x),1.15,-d/2);cyl(.46,.46,.17,GOLD,v(x),2.3,-d/2);}
 for(const x of [-8,-3,3,8])for(const z of [-4,2])trainingDummy(x,z,(x===3&&z===2)||(x===-8&&z===-4)?'target':'straw');
 for(let z of [-6,5]){
   box(3.2,.35,1.4,WOOD,v(-10),.52,v(z));
   blockRect(-10,z,1,0); // weapon racks are solid obstacles
   for(let i=0;i<4;i++){const dx=v(-10)+(i-1.5)*.56;
     rod([dx,.80,v(z)],[dx,2.4,v(z)],.055,STONE);
     ball(.09,GOLD,dx,2.39,v(z));}
 }
 for(let x of [-10,10])for(let z of [-7,7])lantern(x,z,0xffd28d);
 const teacher=placeStandingNPC(0,-7,{robe:0xdac292,trim:0x8a7660,staff:true},2);
 if(teacher)label('Master of Training',teacher.position.clone().add(new THREE.Vector3(0,2.9,0)),'character');
 createPortal(0,-9,'mass-chamber','Mass Chamber',.76);
 announce('The training grounds — summon monks for a sparring session');
}
function buildLoom(){
 makeFloor(0x867c6e);walls(0x6c665b,4.5);
 for(const x of [-10,10])lantern(x,-7,0xf4d2a3);
 // ONE monumental upright loom in the centre of the chamber.
 const g=new THREE.Group();scene.add(g);g.position.set(0,0,-v(1));
 const wood=mat(0x88613d),yarn=[0xdec8a0,0xa15e5e,0x73918f,0xb7a1d5,0xd8bf75];
 for(const side of [-1,1]){
   box(.36,4.65,.47,wood,side*3.10,2.36,0,g);
   box(.52,.30,1.8,LWOOD,side*3.13,.39,.04,g);
 }
 for(const y of [.76,1.5,4.30])box(6.55,.23,.40,wood,0,y,0,g);
 for(let i=0;i<42;i++){
   const x=-2.78+i*(5.56/41),col=mat(yarn[Math.floor(i/7)%yarn.length]);
   rod([x,1.11,.02],[x,4.19,.02],.019,col,g);
 }
 // Woven tapestry rising from a horizontal roll, plus shuttle and treadles.
 box(5.45,1.31,.12,mat(0x68847c),0,1.54,.22,g);
 for(let i=0;i<8;i++)box(5.45,.085,.035,mat(yarn[i%yarn.length]),0,1.00+i*.17,.30,g);
 cyl(.24,.24,6.1,wood,0,1.02,.32,g); // horizontal cloth roll
 g.children[g.children.length-1].rotation.z=Math.PI/2;
 rod([-1.1,1.88,.61],[1.0,1.88,.61],.065,GOLD,g);
 for(const side of [-1,1])box(.85,.15,1.22,wood,side*1.00,.35,1.48,g);
 blockRect(0,-1,2,1);
 // Seamstress sits at a wooden bench, to the side rather than inside the loom.
 const stool=box(1.2,.23,.93,LWOOD,v(4),.62,v(2));box(.20,.56,.22,WOOD,v(4),.35,v(2));
 blockTile(4,2);
 const worker=person(4,2,{robe:0x9a6b76,trim:0xe4c49b,skin:0xc89475,hair:0x60483a,pose:'sit'});
 worker.rotation.y=-.65;
 label('Temple Seamstress',worker.position.clone().add(new THREE.Vector3(0,2.75,0)),'character');
 // A few yarn skeins and folded cloth rolls are supplies, not additional looms.
 for(const x of [-9,9]){
   shelf(x,-5,3.3,3.6);
   for(let i=0;i<5;i++){
     const roll=cyl(.32,.32,1.28,mat(yarn[i]),v(x)+Math.sin(i*2.3)*.58,.53,v(4)+Math.floor(i/3)*.8);
     roll.rotation.x=Math.PI/2;
   }
 }
 carpet(0,6,4.3,4.8,0x786657);
 createPortal(0,-9,'mass-chamber','Mass Chamber',.76);
 announce('The seamstress works quietly at her single loom');
}
function appleTree(x,z,seed){
 const g=new THREE.Group();g.position.set(v(x),0,v(z));scene.add(g);
 cyl(.40,.51,2.75,WOOD,0,1.48,0,g);
 rod([0,2.42,0],[-1.14,3.13,.23],.17,WOOD,g);
 rod([0,2.55,0],[1.10,3.31,-.30],.16,WOOD,g);
 for(const [cx,cy,cz,scale] of [[-.95,3.40,.12,1.10],[.85,3.73,-.35,1.12],[0,4.18,.17,1.25],[-.20,3.21,.9,.93]]){
   const leaf=ball(scale,mat(seed%2?0x477e53:0x568753),cx,cy,cz,g);leaf.scale.set(1.2,.82,1.02);
 }
 for(let i=0;i<9;i++){
   const a=(i*2.399+seed*.45),rr=1.1+.4*(i%3),xx=Math.sin(a)*rr,zz=Math.cos(a)*rr;
   ball(.17,glow(i%3===0?0xe4aa4c:0xc93235,.2),xx,3.3+(i%4)*.30,zz,g);
   rod([xx,3.47+(i%4)*.30,zz],[xx,3.59+(i%4)*.30,zz],.025,WOOD,g);
 }
 blockTile(x,z);
}
function dwarfGardener(x,z,index){
 const g=new THREE.Group();g.position.set(v(x),0,v(z));scene.add(g);
 const clothes=[0x53679b,0xa36c4f,0x6b9663,0x946f9e,0x8b794f,0x577d7d,0xa64d5f];
 const coat=mat(clothes[index]),skin=mat(0xc69672),beard=mat(index%2?0xf1d0a0:0x8a6c56);
 const body=ball(.45,coat,0,.80,0,g);body.scale.set(1.0,1.02,.83);
 for(const s of [-1,1]){
   rod([s*.32,.91,0],[s*.48,.47,.25],.11,coat,g);
   box(.24,.36,.27,mat(0x5f5449),s*.19,.27,.08,g);
 }
 ball(.30,skin,0,1.33,.04,g);
 const beardFace=cone(.30,.45,beard,0,1.07,.29,g);beardFace.rotation.z=Math.PI;
 for(const sx of [-1,1])ball(.038,DARK,sx*.13,1.40,.29,g);
 cyl(.34,.38,.12,coat,0,1.61,.03,g);cone(.33,.69,coat,.05,1.95,.02,g).rotation.z=.13*(index%2?1:-1);
 if(index%3===0){ // water pot
   cyl(.24,.30,.38,mat(0x849d98),.65,.38,.42,g);
   rod([.45,.48,.42],[.79,.77,.42],.05,STONE,g);
 }else if(index%3===1){ // garden hoe
   rod([.48,.22,.26],[.86,1.60,.12],.055,WOOD,g);
   box(.52,.12,.15,STONE,.90,1.62,.12,g);
 }else{ // wicker basket of apples
   cyl(.34,.36,.30,mat(0xa77b4b),.68,.32,.48,g,8);
   for(let j=0;j<3;j++)ball(.15,mat(0xc7443e),.57+j*.12,.50,.48,g);
 }
 blockTile(x,z);
 // Quiet gardening motion: kneeling, working the soil and tending baskets.
 animated.push(t=>{g.position.y=.025*Math.sin(t*1.8+index*1.7);});
 return g;
}
function buildGarden(){
 makeFloor(0x607e57);scene.background=new THREE.Color(0x83a4ad);scene.fog=new THREE.FogExp2(0x73948c,.009);
 const w=(HALF_X*2+1)*CELL,d=(HALF_Z*2+1)*CELL;
 box(w,.63,.20,WOOD,0,.56,-d/2-.18);
 for(const side of [-1,1])box(.20,.64,d,WOOD,side*(w/2+.18),.56,0);
 for(let x=-10;x<=10;x+=3)for(const z of [-9,9])cyl(.17,.20,1.15,WOOD,v(x),.66,v(z));
 for(const z of [-6,1])for(const x of [-9,-3,3,9])appleTree(x,z,Math.abs(x)+z+11);
 // Seven separate, recognizable dwarfs. No duplicate stacks or embedded geometry.
 const spots=[[-7,-3],[-1,-3],[5,-3],[10,-3],[-7,5],[-1,5],[5,5]];
 spots.forEach(([x,z],i)=>{
   const dwarf=dwarfGardener(x,z,i);
   dwarf.rotation.y=(i%4)*Math.PI/2;
   label(`Dwarf Gardener ${i+1}`,dwarf.position.clone().add(new THREE.Vector3(0,2.6,0)),'character');
 });
 // Raised vegetable beds and scattered fallen fruit.
 for(const x of [-5,0,6]){
   box(2.25,.35,2.1,WOOD,v(x),.39,v(8));blockTile(x,8);
   for(let i=0;i<4;i++){
     ball(.20,LEAF,v(x)+(i%2)*.55-.26,.65,v(8)+Math.floor(i/2)*.6-.3);
     ball(.10,mat(0xc76b44),v(x)+(i%2)*.55-.26,.78,v(8)+Math.floor(i/2)*.6-.3);
   }
 }
 for(let i=0;i<24;i++){
   const x=-10+(i*17%21),z=-7+(i*13%15);
   if(walkable(x,z))ball(.085,mat(i%3===0?0xd34a40:0xb8a653),v(x)+.28,.29,v(z)-.19);
 }
 createPortal(0,-9,'mass-chamber','Mass Chamber',.73);
 announce('Seven dwarven gardeners tend the apple orchard');
}
function dustyCrate(x,z,size=1){
 const g=new THREE.Group();g.position.set(v(x),0,v(z));scene.add(g);
 const timber=mat(0x7d6447),bands=mat(0xb1926c);
 const w=1.10*size,h=1.06*size;
 box(w,h,w,timber,0,h/2+.22,0,g);
 for(const side of [-1,1]){
   box(.09,h,w+.09,bands,side*(w/2-.10),h/2+.22,0,g);
   box(w+.09,h,.08,bands,0,h/2+.22,side*(w/2-.10),g);
 }
 for(const sz of [-1,1]){
   const brace=rod([-.40*w,h*.28+.22,sz*w/2],[.40*w,h*.78+.22,sz*w/2],.055,bands,g);
 }
 box(w*.91,.035,w*.91,mat(0xa58b6d),0,h+.23,0,g); // dust on lid
 blockTile(x,z);
 return g;
}
function storageSack(x,z){
 const g=new THREE.Group();g.position.set(v(x),0,v(z));scene.add(g);
 const bag=ball(.49,mat(0xb7a287),0,.63,0,g);bag.scale.set(.86,1.20,.82);
 cyl(.13,.17,.10,WOOD,0,1.19,0,g);
 ring(.20,.035,GOLD,0,1.16,0,g).rotation.x=-Math.PI/2;
 blockTile(x,z);
}
function buildStore(){
 makeFloor(0x6d665e);walls(0x4f4a48,4.9);scene.fog=new THREE.FogExp2(0x191820,.018);
 const rows=[[-9,-6],[-6,-6],[6,-6],[9,-6],[-9,-2],[-6,-2],[6,-2],[9,-2],[-9,2],[-6,2],[6,2],[9,2],[-9,6],[-6,6],[6,6],[9,6]];
 rows.forEach(([x,z],i)=>{
   dustyCrate(x,z,i%5===0?1.23:1);
   if(i%4===1){const top=dustyCrate(x,z,0.62);top.position.y=1.12;}
 });
 for(const [x,z] of [[-3,-5],[3,-5],[-3,2],[3,2],[-3,7],[3,7]])barrel(x,z);
 for(const [x,z] of [[-10,4],[10,4],[-2,6],[2,6]])storageSack(x,z);
 shelf(-10,-8,2.8,3.8);shelf(10,-8,2.8,3.8);
 for(const x of [-10,10])lantern(x,-6,0xf1c388);
 // Dim shafts of light illuminate suspended dust, without external textures.
 const dustPositions=new Float32Array(180*3);
 for(let i=0;i<180;i++){
   dustPositions[3*i]=rand(-16,16);dustPositions[3*i+1]=rand(.4,4.7);dustPositions[3*i+2]=rand(-13,13);
 }
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(dustPositions,3));
 const motes=new THREE.Points(geo,new THREE.PointsMaterial({size:.08,color:0xf2d7a4,transparent:true,opacity:.59,depthWrite:false}));
 scene.add(motes);animated.push(t=>{motes.rotation.y=.016*Math.sin(t*.12);});
 // Cobwebs in the four upper corners.
 for(const x of [-1,1])for(const z of [-1,1]){
   const corners=[x*16.8,4.3,z*13.3,x*14.0,4.3,z*13.3,x*16.8,3.1,z*10.6];
   const webGeo=new THREE.BufferGeometry();webGeo.setAttribute('position',new THREE.Float32BufferAttribute(corners,3));webGeo.computeVertexNormals();
   mesh(webGeo,mat(0xc6beb0,0,.23));
 }
 createPortal(0,-9,'mass-chamber','Mass Chamber',.75);
 announce('Dust gathers on the temple’s storeroom crates and barrels');
}

const ROOM_INFO={
 'mass-chamber': ['Lady Runara welcomes pilgrims beneath the Platinum Dragon. Monks and priests gather in pews; the hidden library is accessed from the statue podium.','Click a glowing doorway to enter its room, or use the room selector at the top.'],
 'dining-hall':['Temple monks and priests share meals beneath warm lanterns. Platters and bread cover the long communal tables.','This is a peaceful role-playing scene: no extra DM mechanics.'],
 'kitchen':['An Overcooked-style bustle of stoves, chopping boards, sinks, storage, hanging pans, barrels and food.','Summon chickens, ducks, pigs and cows on any free tile. You can move or remove them afterward.'],
 'healing-ward':['Injured sailors from the coast rest on beds under the supervision of temple healers.','Use this as a place to narrate recovery, blessing or bedside conversations.'],
 'reliquary':['Four relics are kept beneath glass. The Cloak of Bellowing hangs openly on a coat rack.','Toggle artifact names below. Guardians occasionally enter, stand watch and leave.'],
 'crypts':['Honored founders and high priests rest in stone sarcophagi below the temple floor.','Golden Guardians of Faith protect these ancient tombs.'],
 'hotspring':['An open-air Japanese-style onsen with warm stone pools, lanterns, timber paths and flowering trees.','Steam rises over the water; the camera and hero pieces remain fully interactive.'],
 'toilets':['Separate men’s and women’s washrooms, each with enclosed cubicles, individual mirrors and three sinks.','Urinals are present only in the men’s wing. Each wing has its own exit to the Mass Chamber.'],
 'training-field':['A sunlit training courtyard with weapon racks, target boards and eight practice dummies.','Spawn Temple Monks or Monk Instructors. Move them up to six tiles or remove them from the encounter.'],
 'loom-room':['A seamstress works at one large standing loom with dozens of coloured threads and a half-finished tapestry.','The seamstress and her workstation are decorative. The remainder of the room can be used for role-play.'],
 'apple-garden':['Seven dwarf gardeners tend an orchard of apple trees, watering seedlings, hoeing beds and gathering fruit.','Each dwarf is a separate stationary NPC and apple trees are solid movement obstacles.'],
 'store-room':['Dusty crates, barrels, grain sacks, shelves and spider webs fill a dim storeroom.','The narrow aisles remain passable by player miniatures.']
};
function configureHUD(){
 document.title=`${room.short} | Temple of Bahamut`;
 document.querySelector('.brand-block h1').textContent=`Temple of Bahamut — ${room.short}`;
 document.querySelector('.mini-metric').hidden=true;
 // [hidden] alone is overridden by some desktop CSS display rules.
 document.querySelector('.mini-metric').style.display='none';
 $('toggle-books').style.display='none';
 document.querySelector('.party-panel .panel-intro').textContent='All four heroes begin unspawned. Click a hero, then click a free square to place them. Heroes move up to six squares.';
 $('reset-party').textContent='Unspawn all ↺';
 document.querySelector('.bottom-hint').textContent='DRAG TO ORBIT · SCROLL TO ZOOM · SELECT AN UNSPAWNED HERO & CLICK A TILE · KEYS 1–4 · CLICK DOORWAYS TO TRAVEL';
 document.querySelector('.encounter-panel').innerHTML=`
   <div class="panel-kicker">02 / THE TEMPLE</div>
   <h2 id="encounter-title">${room.short}</h2>
   <p class="room-note">${ROOM_INFO[room.id][0]}</p>
   <div class="room-stat">${ROOM_INFO[room.id][1]}</div>
   <div id="room-controls"></div>
   <div class="room-divider"></div>
   <button class="room-action" type="button" id="return-sanctuary">✦ Return to the Mass Chamber</button>`;
 const area=$('room-controls');
 if(room.id==='kitchen'||room.id==='training-field'){
   area.innerHTML='<div class="section-label">SUMMON A PIECE <span>CLICK TO PLACE</span></div><div class="spawn-list" id="spawn-list"></div><button class="text-button cancel-spawn" id="cancel-spawn" hidden>Cancel placement ×</button><div class="section-label">ACTIVE SUMMONS <span id="enemy-count">0</span></div><div class="enemy-list" id="enemy-list"></div><div class="enemy-actions"><button class="text-button" id="remove-enemy" disabled>Remove selected</button><button class="text-button" id="clear-enemies">Clear all summons</button></div>';
   $('remove-enemy').addEventListener('click',removeSelectedCreature);
   $('clear-enemies').addEventListener('click',clearCreatures);
   $('cancel-spawn').addEventListener('click',()=>{pendingCreature=null;refresh();renderCreatures();});
 }
 if(room.id==='reliquary'){
   area.innerHTML='<label class="room-control"><input type="checkbox" id="relic-names" checked> Show artifact names</label><p class="room-note">The guard patrol is automatic. Each guard occasionally enters the hall, stands watch, then exits.</p>';
   $('relic-names').addEventListener('change',e=>{labels.forEach(l=>{if(l.el.classList.contains('artifact'))l.hidden=!e.target.checked;});});
 }
 $('return-sanctuary').addEventListener('click',()=>{location.href=roomURL('mass-chamber');});
 $('help-title').textContent='Temple of Bahamut — Game Master Guide';
 const modal=document.querySelector('#help-modal .modal');
 modal.querySelectorAll('p').forEach(p=>p.remove());
 const guide=document.createElement('p');guide.innerHTML='<strong>Room selector:</strong> choose any temple chamber from the top dropdown, or click the glowing exit portals in the scene.<br><br><strong>Heroes:</strong> all four begin unspawned in every room. Click a hero or press 1–4, then click an empty grid square. Select the hero again to show six-square orthogonal movement. Remove the selected hero or unspawn the entire party.<br><br><strong>Camera:</strong> drag to orbit, right-drag to pan, scroll to zoom, or choose Battle map for an overhead view.<br><br><strong>Special rooms:</strong> the kitchen has four spawnable animals, and Training has spawnable monks. In the Reliquary, toggle the names of relics. Guards patrol on a repeating schedule.<br><br><strong>Deployment:</strong> all rooms are browser-only scenes with shareable ?room= links.';
 modal.insertBefore(guide,$('start-exploring'));$('start-exploring').textContent='Enter this room';
}
function createPiece(data,kind,x=0,z=0){
 const root=kind==='hero'?buildHero(data):kind==='monk'?monkMini(data.id):animal(data.id);
 if(kind!=='hero'){scene.add(root);root.visible=true;}
 const number=kind==='hero'?0:++creatureCounter;
 root.userData={type:'piece',id:kind==='hero'?data.id:`summon-${number}`};
 root.position.set(v(x),0,v(z));
 const id=root.userData.id,spawned=kind!=='hero';
 const piece={...data,id,number,kind,root,x,z,spawned,moving:false,path:[],progress:0};
 piece.tag=label(kind==='hero'?data.name:`${data.name} #${number}`,root.position,'hero',!spawned);
 pieces.push(piece);return piece;
}
function renderParty(){
 const panel=$('party-list');panel.replaceChildren();
 for(const [i,p] of pieces.filter(p=>p.kind==='hero').entries()){
   const b=document.createElement('button');b.className=`party-member ${selected===p||pendingHero===p.id?'selected':''}`;
   b.innerHTML=`<span class="character-gem" style="background:${hex(p.color)}33;border-color:${hex(p.color)}99">${p.symbol}</span><span class="member-copy"><span class="member-name">${p.name}</span><span class="member-class">${p.job}</span></span><span class="member-index">${!p.spawned?(pendingHero===p.id?'PLACE':'SPAWN'):'0'+(i+1)}</span>`;
   b.addEventListener('click',()=>selectOrArm(p.id));panel.append(b);
 }
 $('unspawn-hero').disabled=selected?.kind!=='hero';
}
function renderCreatures(){
 if(room.id!=='kitchen'&&room.id!=='training-field')return;
 const container=$('spawn-list');container.replaceChildren();
 for(const type of (room.id==='kitchen'?CREATURES:MONKS)){
   const btn=document.createElement('button');btn.className=`spawn-button ${pendingCreature===type.id?'selected':''}`;
   btn.innerHTML=`<span class="spawn-glyph" style="color:${hex(type.color)}">${type.symbol}</span><span class="spawn-copy"><strong>${type.name}</strong><small>${type.detail}</small></span><span class="spawn-action">${pendingCreature===type.id?'CANCEL':'SPAWN'}</span>`;
   btn.addEventListener('click',()=>{
     pendingHero=null;selected=null;pendingCreature=pendingCreature===type.id?null:type.id;
     refresh();renderParty();renderCreatures();
     if(pendingCreature)toast(`Click a free tile to summon ${type.name}.`);
   });container.append(btn);
 }
 const enemies=pieces.filter(p=>p.kind!=='hero');
 const list=$('enemy-list');list.replaceChildren();
 if(!enemies.length){const empty=document.createElement('p');empty.className='empty-enemies';empty.textContent='No summons have been placed.';list.append(empty);}
 for(const p of enemies){const b=document.createElement('button');b.className=`enemy-entry ${selected===p?'selected':''}`;
   b.innerHTML=`<span style="color:${hex(p.color)}">●</span><span>${p.name} #${p.number}</span><small>${p.x}, ${p.z}</small>`;
   b.addEventListener('click',()=>selectOrArm(p.id));list.append(b);
 }
 $('enemy-count').textContent=String(enemies.length);$('remove-enemy').disabled=!selected||selected.kind==='hero';$('cancel-spawn').hidden=!pendingCreature;
}
function selectOrArm(id){
 if(pieces.some(p=>p.moving))return;
 const p=pieces.find(p=>p.id===id);if(!p)return;
 if(!p.spawned){pendingCreature=null;selected=null;pendingHero=pendingHero===id?null:id;
   if(pendingHero)toast(`Choose an empty tile to place ${p.name}.`);
 }else{pendingHero=null;pendingCreature=null;selected=p;announce(`${p.name} is selected`);}
 refresh();renderParty();renderCreatures();
}
function spawnAt(x,z){
 if(!free(x,z)){toast('Choose an empty tile clear of furniture, NPCs and other miniatures.');return;}
 if(pendingHero){const p=pieces.find(p=>p.id===pendingHero);if(!p)return;
   p.x=x;p.z=z;p.spawned=true;p.root.visible=true;p.root.position.set(v(x),0,v(z));p.tag.hidden=false;
   pendingHero=null;selectOrArm(p.id);toast(`${p.name} is now on the board.`);return;
 }
 if(pendingCreature){const kind=(room.id==='kitchen'?CREATURES:MONKS).find(t=>t.id===pendingCreature);if(!kind)return;
   const p=createPiece(kind,room.id==='kitchen'?'animal':'monk',x,z);pendingCreature=null;
   selectOrArm(p.id);toast(`${kind.name} summoned. Select a highlighted tile to move it.`);
 }
}
function unspawnHero(){if(selected?.kind!=='hero'||selected.moving)return;const p=selected;p.spawned=false;p.root.visible=false;p.tag.hidden=true;
 selected=null;refresh();renderParty();renderCreatures();toast(`${p.name} removed from the board.`);
}
function unspawnAll(){if(pieces.some(p=>p.moving))return;for(const p of pieces.filter(p=>p.kind==='hero')){p.spawned=false;p.root.visible=false;p.tag.hidden=true;p.path=[];p.moving=false;}
 selected=null;pendingHero=null;pendingCreature=null;refresh();renderParty();renderCreatures();toast('All heroes are unspawned.');
}
function removeSelectedCreature(){if(!selected||selected.kind==='hero'||selected.moving)return;
 const p=selected;p.root.parent.remove(p.root);p.tag.el.remove();labels.splice(labels.indexOf(p.tag),1);pieces.splice(pieces.indexOf(p),1);
 selected=null;refresh();renderParty();renderCreatures();toast('Summoned miniature removed.');
}
function clearCreatures(){if(pieces.some(p=>p.moving))return;for(const p of [...pieces.filter(p=>p.kind!=='hero')]){
 p.root.parent.remove(p.root);p.tag.el.remove();labels.splice(labels.indexOf(p.tag),1);pieces.splice(pieces.indexOf(p),1);
 }selected=null;pendingCreature=null;refresh();renderParty();renderCreatures();toast('All summoned miniatures removed.');}
function pathTiles(p){
 const found=new Map([[tileKey(p.x,p.z),[]]]),queue=[{x:p.x,z:p.z,path:[]}];
 for(let i=0;i<queue.length;i++){const cur=queue[i];if(cur.path.length===STEP_LIMIT)continue;
   for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
     const x=cur.x+dx,z=cur.z+dz,k=tileKey(x,z);if(found.has(k)||!free(x,z,p.id))continue;
     const path=[...cur.path,{x,z}];found.set(k,path);queue.push({x,z,path});
   }
 }
 found.delete(tileKey(p.x,p.z));return found;
}
function refresh(){
 reachable=selected?.spawned&&!selected.moving&&!pendingHero&&!pendingCreature?pathTiles(selected):new Map();
 const dummy=new THREE.Object3D();let n=0;
 for(const k of reachable.keys()){
   const [x,z]=k.split(',').map(Number);dummy.position.set(v(x),FLOOR+.065,v(z));dummy.rotation.set(-Math.PI/2,0,0);dummy.updateMatrix();overlay.setMatrixAt(n++,dummy.matrix);
 }overlay.count=n;overlay.instanceMatrix.needsUpdate=true;
 $('move-status').textContent=pendingHero?'Click a free tile to place hero':pendingCreature?'Click to summon creature':selected?`${selected.name} · ${n} reachable squares`:'Select a hero to spawn';
}
function moveTo(x,z){if(!selected||selected.moving)return;const path=reachable.get(tileKey(x,z));if(!path)return;
 selected.start={x:selected.x,z:selected.z};selected.path=path;selected.progress=0;selected.moving=true;
 selected.x=x;selected.z=z;refresh();announce(`${selected.name} moves ${path.length} squares`);
}
function updateMovement(dt){
 for(const p of allSpawned()){
  if(!p.moving)continue;p.progress+=dt*4;
  const i=Math.floor(p.progress);const start=i===0?p.start:p.path[Math.min(i-1,p.path.length-1)];const end=p.path[Math.min(i,p.path.length-1)];
  if(p.progress>=p.path.length){p.root.position.set(v(p.x),0,v(p.z));p.path=[];p.moving=false;if(p===selected)refresh();continue;}
  if(start&&end){const t=p.progress-i,s=t*t*(3-2*t);p.root.position.set(THREE.MathUtils.lerp(v(start.x),v(end.x),s),Math.sin(t*Math.PI)*.13,THREE.MathUtils.lerp(v(start.z),v(end.z),s));p.root.rotation.y=Math.atan2(end.x-start.x,end.z-start.z);}
 }
}
function updateLabels(){
 const pt=new THREE.Vector3();
 for(const l of labels){
   if(l.hidden){l.el.hidden=true;continue;}
   pt.copy(l.position);
   if(l.el.classList.contains('hero'))pt.y+=2.65;
   pt.project(camera);
   const visible=pt.z>0&&pt.z<1&&Math.abs(pt.x)<.93&&Math.abs(pt.y)<.90;
   l.el.hidden=!visible;if(visible){l.el.style.left=`${(pt.x*.5+.5)*innerWidth}px`;l.el.style.top=`${(-pt.y*.5+.5)*innerHeight}px`;}
 }
}
function setCameraMode(mode){
 $('view-orbit').classList.toggle('active',mode==='orbit');$('view-board').classList.toggle('active',mode==='board');
 cameraTween={from:camera.position.clone(),to:mode==='board'?new THREE.Vector3(.01,61,.01):new THREE.Vector3(28,30,35),look:controls.target.clone(),target:new THREE.Vector3(0,0,0),start:clock.getElapsedTime()};
}
function initInput(){
 let down={x:0,y:0};
 renderer.domElement.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};});
 renderer.domElement.addEventListener('pointerup',e=>{
  if(Math.hypot(e.clientX-down.x,e.clientY-down.y)>6)return;
  const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);
  raycaster.setFromCamera(pointer,camera);
  const targets=[...allSpawned().map(p=>p.root),...staticTargets];
  const hit=raycaster.intersectObjects(targets,true)[0];if(!hit)return;
  let object=hit.object;while(object&&!object.userData.type)object=object.parent;
  if(object?.userData.type==='portal'){
    location.href=roomURL(object.userData.room);return;
  }
  if(object?.userData.type==='piece'){
    if(pendingHero||pendingCreature){toast('Choose a free grid square for placement.');return;}
    selectOrArm(object.userData.id);return;
  }
  if(object?.userData.type==='floor'){
    const x=Math.round(hit.point.x/CELL),z=Math.round(hit.point.z/CELL);if(!within(x,z))return;
    if(pendingHero||pendingCreature)spawnAt(x,z);else moveTo(x,z);
  }
 });
 $('reset-party').addEventListener('click',unspawnAll);$('unspawn-hero').addEventListener('click',unspawnHero);
 $('view-orbit').addEventListener('click',()=>setCameraMode('orbit'));
 $('view-board').addEventListener('click',()=>setCameraMode('board'));
 $('reset-camera').addEventListener('click',()=>setCameraMode('orbit'));
 controls.addEventListener('start',()=>{cameraTween=null;});
 $('hide-topbar').addEventListener('click',()=>{$('topbar').hidden=true;$('show-topbar').hidden=false;});
 $('show-topbar').addEventListener('click',()=>{$('topbar').hidden=false;$('show-topbar').hidden=true;});
 const help=$('help-modal');
 $('help-button').addEventListener('click',()=>{help.hidden=false;});
 $('close-help').addEventListener('click',()=>{help.hidden=true;});
 $('start-exploring').addEventListener('click',()=>{help.hidden=true;});
 help.addEventListener('click',e=>{if(e.target===help)help.hidden=true;});
 window.addEventListener('keydown',e=>{
   if(e.target instanceof HTMLElement&&['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName))return;
   if(e.key>='1'&&e.key<='4'&&!e.ctrlKey&&!e.metaKey&&!e.altKey)selectOrArm(HEROES[Number(e.key)-1].id);
   if(e.key==='Escape'){help.hidden=true;pendingHero=null;pendingCreature=null;refresh();renderParty();renderCreatures();}
 });
 window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));});
}
export function startTempleRoom(theRoom){
 room=theRoom;configureHUD();
 const builders={'mass-chamber':buildMass,'dining-hall':buildDining,kitchen:buildKitchen,'healing-ward':buildHealing,reliquary:buildReliquary,crypts:buildCrypts,hotspring:buildHotSpring,toilets:buildToilets,'training-field':buildTraining,'loom-room':buildLoom,'apple-garden':buildGarden,'store-room':buildStore};
 camera=new THREE.PerspectiveCamera(52,innerWidth/innerHeight,.1,230);camera.position.set(28,30,35);
 renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
 renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.45;
 $('viewport').appendChild(renderer.domElement);
 controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,0,0);controls.enableDamping=true;controls.dampingFactor=.07;controls.minDistance=7;controls.maxDistance=100;controls.maxPolarAngle=Math.PI*.495;controls.update();
 scene.add(new THREE.HemisphereLight(0xc6dcf9,0x393533,2.5));scene.add(new THREE.AmbientLight(0xffdfae,.65));
 light(0xffe5b0,85,0,18,6,55);light(0xc1d7ff,90,-18,15,-12,50);light(0xf5d6ac,70,18,16,9,44);
 builders[room.id]();
 for(const hero of HEROES)createPiece(hero,'hero');
 clock=new THREE.Clock();initInput();renderParty();renderCreatures();refresh();
 let old=0;
 function animate(){requestAnimationFrame(animate);
   const t=clock.getElapsedTime(),dt=Math.min(.06,t-old);old=t;
   updateMovement(dt);for(const fn of animated)fn(t,dt);
   if(cameraTween){const f=Math.min(1,(t-cameraTween.start)/.9),e=f*f*(3-2*f);
     camera.position.lerpVectors(cameraTween.from,cameraTween.to,e);controls.target.lerpVectors(cameraTween.look,cameraTween.target,e);if(f>=1)cameraTween=null;
   }
   controls.update();updateLabels();renderer.render(scene,camera);
 }
 animate();
}
