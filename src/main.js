import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import './style.css';

// THE LIBRARY OF THE LAST WYRM — DM-controlled encounter board.
// All miniatures and scenery are original low-poly primitives, no external models.
// Edit these constants to tune the board or the number of floating books.
const GRID_COUNT = 15;
const CELL = 1.55;             // One grid square = five feet in your game.
const MOVE_RANGE = 6;          // Orthogonal grid steps per move, heroes and enemies.
const BOOK_COUNT = 1_000;     // The wandering/flying books (shelf décor is separate).
const BRIDGE_HALF_WIDTH = 2; // 5 squares wide: x = -2 ... +2.
const BRIDGE_START = 8;      // Adjoins the main platform at z = 7.
const BRIDGE_END = 25;       // Long approach from the entrance.
const BOARD_SIZE = GRID_COUNT * CELL;
const HALF = Math.floor(GRID_COUNT / 2);
const FLOOR_Y = 0.42;
const random = mulberry32(770127);
const $ = (id) => document.getElementById(id);

const PARTY = [
  { id:'lethia', name:'Lethia', job:'WIZARD', symbol:'✦', style:'wizard', color:0x9d91ec, x:-2, z:23 },
  { id:'elsa', name:'Elsa', job:'ICE SORCERESS', symbol:'❄', style:'ice', color:0x9ee8f6, x:-1, z:23 },
  { id:'gilchris', name:'Gilchris', job:'WARLOCK', symbol:'☾', style:'warlock', color:0xb594d7, x:1, z:23 },
  { id:'leda', name:'Leda', job:'HALFLING ROGUE', symbol:'⚔', style:'rogue', color:0x9bc6a0, x:2, z:23 },
];
const ENEMY_TYPES = [
  { id:'book', name:'Enchanted Book', symbol:'▤', color:0xd9a873, detail:'Animated grimoire' },
  { id:'wolf', name:'Red-Hooded Wolf', symbol:'♞', color:0xb96665, detail:'A wolf cloaked in crimson' },
  { id:'goose', name:'Ugly Goose', symbol:'◉', color:0xe2d8a4, detail:'A very disagreeable bird' },
  { id:'flutist', name:'Man with a Flute', symbol:'♫', color:0xc5a875, detail:'The wandering piper' },
  { id:'woodcutter', name:'Boy with an Axe', symbol:'⚒', color:0x97aab4, detail:'The young woodsman' },
];
const PODIUMS = [
  { x:-4,z:0,color:0xc4b385 }, { x:4,z:0,color:0x9fb7de },
  { x:0,z:-4,color:0xb8a2cf }, { x:0,z:4,color:0xc5a89a },
];
function mulberry32(seed) {
  return () => { let t=seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296; };
}
const rrange=(min,max)=>min+(max-min)*random();
const pick=arr=>arr[Math.floor(random()*arr.length)];
const world=n=>n*CELL;
const key=(x,z)=>`${x},${z}`;
const hex=v=>`#${v.toString(16).padStart(6,'0')}`;
const isTile=(x,z)=>Number.isInteger(x)&&Number.isInteger(z)&&(
  (Math.abs(x)<=HALF&&Math.abs(z)<=HALF) ||
  (Math.abs(x)<=BRIDGE_HALF_WIDTH&&z>=BRIDGE_START&&z<=BRIDGE_END));
const blockedByStatue=(x,z)=>Math.abs(x)<=2&&Math.abs(z)<=2;
const blockedByPodium=(x,z)=>PODIUMS.some(p=>p.x===x&&p.z===z);
const walkable=(x,z)=>isTile(x,z)&&!blockedByStatue(x,z)&&!blockedByPodium(x,z);

const scene=new THREE.Scene();
scene.background=new THREE.Color(0x080d1a);
scene.fog=new THREE.FogExp2(0x111624,0.0055);
const camera=new THREE.PerspectiveCamera(55,innerWidth/innerHeight,.1,300);
camera.position.set(24,29,29);
const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setSize(innerWidth,innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.43;
renderer.shadowMap.enabled=false;
$('viewport').appendChild(renderer.domElement);
const controls=new OrbitControls(camera,renderer.domElement);
controls.target.set(0,5,13);
controls.enableDamping=true;
controls.dampingFactor=.06;
controls.minDistance=8;
controls.maxDistance=120;
controls.maxPolarAngle=Math.PI*.495;
controls.update();

scene.add(new THREE.HemisphereLight(0x98b6ff,0x312317,2));
scene.add(new THREE.AmbientLight(0x9b91b2,.36));
function pointLight(color,intensity,distance,x,y,z) {
  const light=new THREE.PointLight(color,intensity,distance,1.6);
  light.position.set(x,y,z);scene.add(light);return light;
}
pointLight(0x9f9fff,125,64,0,27,0);
pointLight(0xffca7c,78,46,-16,18,9);
pointLight(0x76b9db,95,45,17,25,-15);
pointLight(0xe1a5ee,45,40,-7,12,-22);
pointLight(0xb9c3ff,44,45,0,13,29);
const statueLight=pointLight(0xdbd1f0,130,42,0,16,4);
const stone=new THREE.MeshStandardMaterial({color:0x41485a,roughness:.95,flatShading:true});
const stoneLight=new THREE.MeshStandardMaterial({color:0x6b7286,roughness:.94,flatShading:true});
const stoneDark=new THREE.MeshStandardMaterial({color:0x272c3b,roughness:1,flatShading:true});
const gold=new THREE.MeshStandardMaterial({color:0xbfa273,metalness:.67,roughness:.37});
const midnight=new THREE.MeshStandardMaterial({color:0x161e30,metalness:.22,roughness:.73});
function material(color,metalness=.08){return new THREE.MeshStandardMaterial({color,metalness,roughness:.78,flatShading:true,side:THREE.DoubleSide});}
function emissive(color,intensity=1.1){return new THREE.MeshStandardMaterial({color,emissive:color,emissiveIntensity:intensity,roughness:.32});}
function mesh(geometry,mat,parent=scene){const o=new THREE.Mesh(geometry,mat);parent.add(o);return o;}
function box(w,h,d,mat,x,y,z,parent=scene){const m=mesh(new THREE.BoxGeometry(w,h,d),mat,parent);m.position.set(x,y,z);return m;}
function cylinder(rt,rb,h,segments,mat,x,y,z,parent=scene){const m=mesh(new THREE.CylinderGeometry(rt,rb,h,segments),mat,parent);m.position.set(x,y,z);return m;}
function orb(radius,mat,x,y,z,parent=scene,detail=1){const m=mesh(new THREE.IcosahedronGeometry(radius,detail),mat,parent);m.position.set(x,y,z);return m;}
function torus(radius,tube,mat,x,y,z,parent=scene,radial=8,tubular=70){const m=mesh(new THREE.TorusGeometry(radius,tube,radial,tubular),mat,parent);m.position.set(x,y,z);return m;}
function rod(a,b,r,mat,parent=scene,rTop=r){const va=new THREE.Vector3(...a),vb=new THREE.Vector3(...b),d=new THREE.Vector3().subVectors(vb,va);const m=mesh(new THREE.CylinderGeometry(rTop,r,d.length(),7),mat,parent);m.position.copy(va).add(vb).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return m;}

function createHall() {
  cylinder(53,55,1.4,48,stoneDark,0,-4.0,0);
  const wall=mesh(new THREE.CylinderGeometry(47,47,89,48,1,true), new THREE.MeshStandardMaterial({color:0x1c2234,side:THREE.BackSide,roughness:1}));
  wall.position.y=42;
  for(let tier=0;tier<5;tier++) {
    const y=4+tier*18;
    const ring=torus(46.6,0.38,tier%2?stoneLight:gold,0,y,0);
    ring.rotation.x=Math.PI/2;
  }
  // Circular sweeping balcony and monumental ribbed columns.
  for(let i=0;i<24;i++) {
    const a=i*Math.PI*2/24;
    const x=Math.sin(a)*44.9,z=Math.cos(a)*44.9;
    cylinder(.65,.85,84,10,stoneLight,x,40.6,z);
    for(let j=0;j<5;j++) cylinder(.96,.96,.5,10,gold,x,7+j*18,z);
    const rib=mesh(new THREE.CylinderGeometry(.25,.43,30,6),stoneLight);
    rib.position.set(Math.sin(a)*35,83,Math.cos(a)*35);
    rib.rotation.z=Math.sin(a)*.55;
    rib.rotation.x=-Math.cos(a)*.55;
  }
  // The roof is visible only as far-off star-laced vaults.
  cylinder(45,45,1,48,stoneDark,0,92,0);
  for(let i=0;i<16;i++) {
    const a=i*Math.PI*2/16;
    rod([Math.sin(a)*44,89,Math.cos(a)*44],[0,99,0],.20,gold);
  }
  const portal=torus(20,.30,emissive(0x766ca4,.7),0,94,0);
  portal.rotation.x=Math.PI/2;
  for(let i=0;i<8;i++) {
    const a=i*Math.PI*2/8;
    const g=torus(4,.09,emissive(0xb7a7dd,.6),Math.sin(a)*22,89,Math.cos(a)*22);
    g.rotation.x=Math.PI/2;
  }
  // Warm glowing windows / arched niches behind the books.
  const windowMat=emissive(0xb2a3e6,.56);
  for(let i=0;i<12;i++) {
    const a=i*Math.PI*2/12;
    const niche=box(3,17,.18,windowMat,Math.sin(a)*46,63,Math.cos(a)*46);
    niche.rotation.y=a;
  }
  // Long, pale shafts of magical light make the ceiling read taller.
  const beamMat=new THREE.MeshBasicMaterial({color:0xb1a7ee,transparent:true,opacity:.024,depthWrite:false,side:THREE.DoubleSide});
  for(let i=0;i<7;i++) {
    const a=i*Math.PI*2/7;
    const beam=mesh(new THREE.ConeGeometry(8.5,83,24,1,true),beamMat);
    beam.position.set(Math.cos(a)*15,45,Math.sin(a)*15);
    beam.rotation.z=Math.sin(a)*.06;
  }
}

// Shelved scenery uses a separate instanced mesh, keeping the room packed with volumes.
function createShelves() {
  const bayCount=24, levels=21, perLevel=23, shelfWidth=8.25;
  const covers=[0x514a70,0x876050,0x4f6b78,0x6f7956,0x8d726c,0x454d65,0x715d82,0x8e7651];
  const spineMat=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.78,metalness:.08});
  const total=bayCount*levels*perLevel;
  const instances=new THREE.InstancedMesh(new THREE.BoxGeometry(.34,2.14,.64),spineMat,total);
  instances.frustumCulled=false;
  const dummy=new THREE.Object3D();const col=new THREE.Color();let idx=0;
  for(let b=0;b<bayCount;b++) {
    const a=b*Math.PI*2/bayCount, r=42.4;
    const sx=Math.sin(a),sz=Math.cos(a);
    const bay=new THREE.Group();bay.position.set(sx*r,0,sz*r);bay.rotation.y=a;scene.add(bay);
    box(shelfWidth+.5,89,1.35,midnight,0,45,0.1,bay);
    box(shelfWidth+.75,89,.14,gold,0,45,.83,bay);
    box(.23,89,1.75,gold,-shelfWidth/2-.20,45,-.05,bay);
    box(.23,89,1.75,gold,shelfWidth/2+.20,45,-.05,bay);
    for(let l=0;l<levels;l++) {
      const levelY=2.9+l*4.10;
      box(shelfWidth+.3,.20,1.65,l%4===0?gold:stone,0,levelY-.15,-.10,bay);
      for(let n=0;n<perLevel;n++) {
        const dx=-shelfWidth/2+.28+n*(shelfWidth-.56)/(perLevel-1);
        const pos=new THREE.Vector3(dx,levelY+1.1+rrange(-.10,.12),-.51).applyAxisAngle(new THREE.Vector3(0,1,0),a).add(new THREE.Vector3(sx*r,0,sz*r));
        dummy.position.copy(pos);
        dummy.rotation.set(rrange(-.045,.045),a+rrange(-.075,.075),rrange(-.085,.085));
        dummy.scale.set(rrange(.75,1.10),rrange(.7,1.16),rrange(.8,1.04));
        dummy.updateMatrix();instances.setMatrixAt(idx,dummy.matrix);
        col.setHex(pick(covers)).multiplyScalar(rrange(.80,1.25));instances.setColorAt(idx,col);idx++;
      }
    }
    // Circular crest above every bay.
    const crest=torus(1.1,.13,gold,0,90,-.1,bay);crest.rotation.y=0;
    const star=orb(.55,emissive(0xd6bd88,.5),0,90,-.1,bay);
  }
  instances.instanceMatrix.needsUpdate=true;
  instances.instanceColor.needsUpdate=true;
  scene.add(instances);
}


const dragon=new THREE.Group();
let arcaneRings=[];
function createBahamut() {
  scene.add(dragon);
  // Multi-layered plinth; dragonstone sculpture is deliberately stylized, low-poly.
  cylinder(3.65,4.1,.75,8,stoneDark,0,.83,0,dragon);
  cylinder(3.05,3.55,.65,8,stoneLight,0,1.50,0,dragon);
  cylinder(2.53,2.80,.39,8,gold,0,1.92,0,dragon);
  cylinder(2.37,2.43,.39,8,stone,0,2.26,0,dragon);
  const dragonStone=new THREE.MeshStandardMaterial({color:0x8a90a4,metalness:.12,roughness:.87,flatShading:true});
  const dragonShadow=new THREE.MeshStandardMaterial({color:0x596175,metalness:.12,roughness:.87,flatShading:true,side:THREE.DoubleSide});
  const scaleStone=new THREE.MeshStandardMaterial({color:0xb3b4bf,metalness:.21,roughness:.81,flatShading:true});
  // Chest, haunches, arms, massive vertical neck.
  const abdomen=orb(2.0,dragonStone,0,4.5,.05,dragon,1);abdomen.scale.set(1.10,1.26,.87);
  const torso=orb(1.55,dragonStone,0,6.3,.32,dragon,1);torso.scale.set(1.18,1.0,.90);
  rod([0,6.4,.3],[0,9.1,1.12],.79,dragonStone,dragon,.50);
  for(const s of [-1,1]) {
    const thigh=orb(1.12,dragonStone,s*1.54,3.6,1.05,dragon);thigh.scale.set(.8,.97,1.1);
    rod([s*1.4,3.65,1.1],[s*1.18,2.75,2],.44,dragonStone,dragon,.37);
    const foot=orb(.58,dragonStone,s*1.22,2.78,2.04,dragon);foot.scale.set(1.0,.4,1.28);
    for(let i=0;i<3;i++) {
      const claw=mesh(new THREE.ConeGeometry(.145,.5,5),scaleStone,dragon);
      claw.position.set(s*(.86+i*.29),2.6,2.67);
      claw.rotation.x=Math.PI/2;
    }
    rod([s*1.2,6.5,1],[s*1.7,5.2,1.95],.31,dragonStone,dragon,.22);
    rod([s*1.7,5.2,1.95],[s*1.27,4.62,2.55],.24,dragonStone,dragon,.14);
    for(let i=0;i<3;i++) rod([s*1.27,4.6,2.55],[s*(.98+i*.25),4.42,2.94],.075,scaleStone,dragon,.02);
    // Wing: wide segmented stone membranes and long wing fingers.
    const root=[s*1.1,6.9,-.55];
    const fan=[[s*3.3,9.65,-1.7],[s*6.4,11.3,-2.2],[s*8.3,9.4,-2.6],[s*8.55,6.9,-2.3],[s*7.35,4.8,-1.7],[s*4.5,5.45,-1.15]];
    const vertices=[];
    for(let i=0;i<fan.length-1;i++) vertices.push(...root,...fan[i],...fan[i+1]);
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.computeVertexNormals();
    const wing=mesh(geo,dragonShadow,dragon);
    for(let i=0;i<fan.length;i++) rod(root,fan[i],i===1?.15:.085,scaleStone,dragon,.05);
    for(let i=0;i<fan.length-1;i++) rod(fan[i],fan[i+1],.07,dragonStone,dragon,.04);
  }
  // Head and swept antler-like dragon horns.
  const head=orb(.92,scaleStone,0,9.3,1.25,dragon,1);head.scale.set(.98,.83,1.38);
  const snout=orb(.64,dragonStone,0,8.98,2.36,dragon,1);snout.scale.set(.78,.49,1.33);
  for(const s of [-1,1]) {
    orb(.13,emissive(0x9ddfff,2.1),s*.55,9.44,1.92,dragon,2);
    rod([s*.55,9.73,.85],[s*.98,10.83,.23],.20,scaleStone,dragon,.08);
    rod([s*.98,10.83,.23],[s*1.42,11.25,-.54],.09,scaleStone,dragon,.015);
    rod([s*.74,8.95,2.1],[s*1.37,8.63,2.50],.10,scaleStone,dragon,.01);
    orb(.14,dragonShadow,s*.38,9.12,3.1,dragon);
  }
  // Rows of sharp dorsal spines; tapering curled tail.
  for(let i=0;i<7;i++) {
    const spine=mesh(new THREE.ConeGeometry(.28-i*.02,.75+i*.04,5),scaleStone,dragon);
    spine.position.set(0,6.8-i*.43,-1.36-i*.15);
    spine.rotation.x=-.37;
  }
  const tailPts=[[0,3.7,-1.1],[.8,2.8,-2.5],[2.05,2.4,-3.35],[3.65,2.3,-3.1],[4.3,2.9,-2.2],[4.1,3.6,-1.55]];
  tailPts.slice(1).forEach((p,i)=>rod(tailPts[i],p,.44-i*.07,dragonStone,dragon,.32-i*.05));
  const tip=mesh(new THREE.ConeGeometry(.23,.9,5),scaleStone,dragon);tip.position.set(4.05,4,-1.3);tip.rotation.x=.72;
  // Glowing geometric nimbus around Bahamut.
  const halo=torus(4.8,.07,emissive(0xb8acff,1.45),0,9.7,-2.8,dragon);
  halo.rotation.x=.15;
  arcaneRings.push(halo);
  const second=torus(5.65,.048,emissive(0xd6bb89,.75),0,9.7,-2.9,dragon);
  second.rotation.y=.14;
  arcaneRings.push(second);
  // Runic circles around the plinth.
  const sigil=torus(4.6,.075,emissive(0xc1a36c,1.0),0,.54,0);sigil.rotation.x=-Math.PI/2;
  const sigil2=torus(5.18,.045,emissive(0x8c9ed1,.75),0,.55,0);sigil2.rotation.x=-Math.PI/2;
  for(let i=0;i<24;i++) {
    const a=i*Math.PI*2/24,r=4.9;
    const mark=box(.14,.018,.36,gold,Math.cos(a)*r,.57,Math.sin(a)*r);
    mark.rotation.y=-a;
  }
}


let dust;
function createParticles() {
  const count=1500, vertices=new Float32Array(count*3), colors=new Float32Array(count*3);
  for(let i=0;i<count;i++) {
    const a=rrange(0,Math.PI*2),r=rrange(6,44);
    vertices[3*i]=Math.cos(a)*r;vertices[3*i+1]=rrange(3,91);vertices[3*i+2]=Math.sin(a)*r;
    const c=new THREE.Color(pick([0xded3a6,0x9eaccd,0xbdb1ea])).multiplyScalar(rrange(.5,1.2));
    colors[3*i]=c.r;colors[3*i+1]=c.g;colors[3*i+2]=c.b;
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(vertices,3));g.setAttribute('color',new THREE.BufferAttribute(colors,3));
  dust=new THREE.Points(g,new THREE.PointsMaterial({size:.16,vertexColors:true,transparent:true,opacity:.66,depthWrite:false,sizeAttenuation:true}));
  scene.add(dust);
}

let flyingBooks,bookMotion=[],lastBooksUpdate=-1,booksPaused=false;
const bookDummy=new THREE.Object3D();
function createFlyingBooks() {
  // One instanced mesh = 1,000 drifting books, one draw call.
  const coverGeometry=new THREE.BoxGeometry(.36,.53,.105);
  const coverMaterial=new THREE.MeshStandardMaterial({color:0xffffff,roughness:.67,metalness:.13,side:THREE.DoubleSide});
  flyingBooks=new THREE.InstancedMesh(coverGeometry,coverMaterial,BOOK_COUNT);
  flyingBooks.frustumCulled=false;
  const c=new THREE.Color();
  const hues=[0x9e6c6f,0xc1a171,0x727ca8,0x7b9b95,0xa18abc,0x8a744f,0x788c74,0xd0bea3];
  for(let i=0;i<BOOK_COUNT;i++) {
    const inner=random()<.19;
    bookMotion.push({
      radius:inner?rrange(10.4,24):rrange(18,41),
      phase:rrange(0,Math.PI*2),
      height:inner?rrange(13,83):rrange(9,84),
      speed:rrange(-.09,.10),
      bob:rrange(.4,3.8),
      spin:rrange(-.4,.4),
      size:rrange(.56,1.6),
      tilt:rrange(-1.0,1.0),
    });
    c.setHex(pick(hues)).multiplyScalar(rrange(.9,1.35));flyingBooks.setColorAt(i,c);
  }
  updateFlyingBooks(0,true);
  scene.add(flyingBooks);
}
function updateFlyingBooks(time,force=false) {
  if (booksPaused && !force) return;
  if (!force && time-lastBooksUpdate<.045) return; // cap instance CPU updates ~22 Hz
  lastBooksUpdate=time;
  for(let i=0;i<BOOK_COUNT;i++) {
    const b=bookMotion[i],a=b.phase+time*b.speed;
    const radius=b.radius+Math.sin(time*.23+b.phase*4)*.8;
    bookDummy.position.set(Math.sin(a)*radius,b.height+Math.sin(time*.49+b.phase*2)*b.bob,Math.cos(a)*radius);
    bookDummy.rotation.set(b.tilt+time*b.spin*.13,a+Math.PI/2,b.phase*.7+time*b.spin*.2);
    bookDummy.scale.set(b.size,b.size,Math.max(.72,b.size));
    bookDummy.updateMatrix();flyingBooks.setMatrixAt(i,bookDummy.matrix);
  }
  flyingBooks.instanceMatrix.needsUpdate=true;
}



// An open arena at the statue, attached to a long five-tile-wide stone causeway.
const boardHitMat=new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide});
const hitSurfaces=[];
let moveOverlay;
function gridEtching(widthTiles,lengthTiles,centerX,centerZ) {
  const verts=[];
  const minX=centerX-widthTiles*CELL/2,maxX=centerX+widthTiles*CELL/2;
  const minZ=centerZ-lengthTiles*CELL/2,maxZ=centerZ+lengthTiles*CELL/2;
  const y=FLOOR_Y+.034;
  for(let i=0;i<=widthTiles;i++) {
    const x=minX+i*CELL;verts.push(x,y,minZ,x,y,maxZ);
  }
  for(let i=0;i<=lengthTiles;i++) {
    const z=minZ+i*CELL;verts.push(minX,y,z,maxX,y,z);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
  scene.add(new THREE.LineSegments(g,new THREE.LineBasicMaterial({color:0xc0ad88,transparent:true,opacity:.48,depthWrite:false})));
}
function hitPlane(w,d,z) {
  const hit=mesh(new THREE.PlaneGeometry(w,d),boardHitMat);
  hit.position.set(0,FLOOR_Y+.048,z);hit.rotation.x=-Math.PI/2;
  hit.userData.type='board';hitSurfaces.push(hit);
}
function createBoard() {
  cylinder(18.4,19.2,.75,12,stoneDark,0,-.55,0);
  cylinder(17,17.8,.30,12,gold,0,-.06,0);
  box(BOARD_SIZE+1.3,.8,BOARD_SIZE+1.3,stone,0,.02,0);
  box(BOARD_SIZE,.09,BOARD_SIZE,material(0x555d6d),0,.395,0);
  gridEtching(GRID_COUNT,GRID_COUNT,0,0);
  hitPlane(BOARD_SIZE,BOARD_SIZE,0);
  const end=BOARD_SIZE/2+.38;
  box(BOARD_SIZE+1,.19,.23,gold,0,.37,-end);
  box(.23,.19,BOARD_SIZE+1,gold,BOARD_SIZE/2+.38,.37,0);
  box(.23,.19,BOARD_SIZE+1,gold,-BOARD_SIZE/2-.38,.37,0);
  // Leave a five-cell opening in the southern (positive Z) platform balustrade.
  const segment=(BOARD_SIZE-5*CELL)/2;
  const center=(5*CELL+segment)/2;
  for(const s of [-1,1]) box(segment,.19,.23,gold,s*center,.37,end);
  for(const sx of [-1,1]) for(const sz of [-1,1]) {
    const outer=torus(.9,.055,emissive(0xc3a96a,.55),sx*10,.48,sz*10);outer.rotation.x=-Math.PI/2;
    const inner=torus(.48,.04,gold,sx*10,.48,sz*10);inner.rotation.x=-Math.PI/2;
  }

  const bridgeLength=BRIDGE_END-BRIDGE_START+1;
  const bridgeCenter=(BRIDGE_START+BRIDGE_END)*CELL/2;
  const bridgeWidth=(BRIDGE_HALF_WIDTH*2+1)*CELL;
  box(bridgeWidth+.6,1.05,bridgeLength*CELL+.5,stoneDark,0,-.14,bridgeCenter);
  box(bridgeWidth,.12,bridgeLength*CELL,material(0x667081),0,.38,bridgeCenter);
  gridEtching(5,bridgeLength,0,bridgeCenter);
  hitPlane(bridgeWidth,bridgeLength*CELL,bridgeCenter);
  // Low raised parapets, carved pillars, tiny arcane lanterns and a grand entry arch.
  for(const s of [-1,1]) {
    const side=s*(bridgeWidth/2+.33);
    box(.55,1.1,bridgeLength*CELL+.3,stone,side,.55,bridgeCenter);
    box(.63,.16,bridgeLength*CELL+.5,gold,side,1.14,bridgeCenter);
    for(let z=BRIDGE_START+1;z<=BRIDGE_END;z+=3) {
      cylinder(.41,.55,2.2,8,stoneLight,side,1.02,world(z));
      const lamp=orb(.19,emissive(z%2?0x9fb5eb:0xe4c48d,1.2),side,2.28,world(z),scene,1);
      lamp.scale.set(.8,1.4,.8);
    }
    for(let z=BRIDGE_START+2;z<=BRIDGE_END;z+=5) {
      cylinder(.45,.62,5.8,8,stoneDark,side,-3.0,world(z));
    }
    const archPost=box(.85,11,1.15,stoneLight,s*4.15,5.3,world(BRIDGE_END));
    box(1,1,1.2,gold,s*4.15,10.7,world(BRIDGE_END));
  }
  box(9.1,.85,1.25,stoneLight,0,11.1,world(BRIDGE_END));
  box(8.85,.15,1.4,gold,0,11.6,world(BRIDGE_END));
  const archRune=orb(.5,emissive(0xd1aee5,1.0),0,10.6,world(BRIDGE_END),scene,2);
  const endRune=torus(3.1,.075,emissive(0xbb9bda,.65),0,7.7,world(BRIDGE_END),scene);
  endRune.rotation.y=0;
  // Highlight layers use instanced geometry so hundreds of cells remain inexpensive.
  moveOverlay=new THREE.InstancedMesh(
    new THREE.PlaneGeometry(CELL*.90,CELL*.90),
    new THREE.MeshBasicMaterial({color:0x91dbd4,transparent:true,opacity:.31,depthWrite:false,side:THREE.DoubleSide}),
    GRID_COUNT*GRID_COUNT+bridgeLength*5);
  moveOverlay.count=0;moveOverlay.frustumCulled=false;scene.add(moveOverlay);
}
function createPodiums() {
  PODIUMS.forEach((p,i)=>{
    const base=new THREE.Group();base.position.set(world(p.x),0,world(p.z));scene.add(base);
    cylinder(.71,.85,.35,8,stoneDark,0,FLOOR_Y+.18,0,base);
    cylinder(.55,.72,1.3,8,stoneLight,0,FLOOR_Y+.95,0,base);
    cylinder(.72,.73,.18,8,gold,0,FLOOR_Y+1.64,0,base);
    const top=orb(.31,emissive(p.color,.72),0,FLOOR_Y+1.99,0,base,2);
    top.scale.y=1.5;
    for(let j=0;j<4;j++) {
      const a=j*Math.PI/2;
      const rune=box(.15,.36,.045,emissive(p.color,.25),Math.sin(a)*.54,FLOOR_Y+.98,Math.cos(a)*.54,base);
      rune.rotation.y=a;
    }
    const halo=torus(.71,.035,emissive(p.color,.6),0,FLOOR_Y+1.7,0,base);
    halo.rotation.x=-Math.PI/2;
  });
}

// Low-poly, distinctive miniature silhouettes. No external model downloads.
const players=[];
const enemies=[];
const labels=[];
function makeLabel(text,kind) {
  const el=document.createElement('div');el.className=`world-label ${kind}`;el.textContent=text;
  document.body.appendChild(el);labels.push(el);return el;
}
function baseFor(g,color,small=false) {
  const radius=small?.38:.48;
  cylinder(radius,radius+.035,.20,12,stoneDark,0,FLOOR_Y+.12,0,g);
  cylinder(radius-.02,radius-.02,.055,12,material(color,.38),0,FLOOR_Y+.23,0,g);
  const ring=torus(radius+.20,.055,emissive(color,.9),0,FLOOR_Y+.14,0,g);
  ring.rotation.x=-Math.PI/2;ring.visible=false;
  return ring;
}
function human(g,{height=1.8,skin=0xcbaa91,cloth=0x596a84,cape=0x413b61,face=true,skirt=true}) {
  const s=height/1.8;
  const skinMat=material(skin),coat=material(cloth),cloak=material(cape);
  const body=cylinder(.25*s,.37*s,.84*s,7,coat,0,FLOOR_Y+.75*s+.24,0,g);
  if(skirt) {
    const dress=mesh(new THREE.ConeGeometry(.47*s,.84*s,8,1,true),cloak,g);
    dress.position.set(0,FLOOR_Y+.56*s+.23,-.07*s);dress.rotation.z=Math.PI;
  } else {
    for(const side of [-1,1])box(.19*s,.43*s,.22*s,coat,side*.16*s,FLOOR_Y+.33*s+.23,0,g);
  }
  for(const side of [-1,1]) {
    rod([side*.29*s,FLOOR_Y+1.05*s+.21,0],[side*.45*s,FLOOR_Y+.56*s+.22,.13*s],.105*s,coat,g,.085*s);
  }
  orb(.23*s,skinMat,0,FLOOR_Y+1.39*s+.20,.05*s,g,1);
  if(face) {
    for(const side of [-1,1])orb(.026*s,material(0x282837),side*.09*s,FLOOR_Y+1.43*s+.20,.245*s,g,0);
  }
  return {skinMat,coat,cloak,s};
}
function hair(g,color,height=1.8,length=.55) {
  const s=height/1.8,mat=material(color);
  const hairCap=orb(.235*s,mat,0,FLOOR_Y+1.51*s+.19,-.04*s,g,1);hairCap.scale.z=1.06;
  const back=box(.37*s,length*s,.17*s,mat,0,FLOOR_Y+1.26*s+.18,-.21*s,g);
  return mat;
}
function createPlayerMini(data,g) {
  const skin=material(0xf0d2b7);
  if(data.style==='wizard') {
    const {s}=human(g,{height:1.95,cloth:0x7267aa,cape:0x332e61,skin:0xdfbaa1});
    hair(g,0x3b2948,1.95,.78);
    const brim=cylinder(.48*s,.48*s,.07,10,material(0x494071),0,FLOOR_Y+1.72*s+.21,0,g);
    const hat=mesh(new THREE.ConeGeometry(.36*s,.81*s,8),material(0x574d86),g);
    hat.position.set(.05,FLOOR_Y+2.10*s+.20,0);hat.rotation.z=-.14;
    rod([.50,FLOOR_Y+.41,.14],[.57,FLOOR_Y+2.36,.14],.055,gold,g,.033);
    orb(.19,emissive(0xbcb5ff,1.5),.57,FLOOR_Y+2.43,.14,g,2);
    for(let i=0;i<3;i++)box(.09,.03,.05,gold,-.19+i*.16,FLOOR_Y+.99,.35,g);
  } else if(data.style==='ice') {
    const {s}=human(g,{height:1.9,cloth:0x9ce6f0,cape:0x78bfd4,skin:0xf2d2be});
    // Pale-blue gown with translucent icy cape and a long blonde side braid.
    const gown=mesh(new THREE.ConeGeometry(.66,1.32,10,1,true),material(0x83cddd),g);
    gown.position.set(0,FLOOR_Y+.79,0);gown.rotation.z=Math.PI;
    const hairMat=hair(g,0xead59d,1.9,.78);
    for(let i=0;i<5;i++)orb(.085, hairMat,.20+i*.020,FLOOR_Y+1.63-i*.17,.18,g,1);
    const capeMat=new THREE.MeshStandardMaterial({color:0xbceefa,transparent:true,opacity:.42,roughness:.45,side:THREE.DoubleSide,depthWrite:false});
    const cape=mesh(new THREE.ConeGeometry(.73,1.56,7,1,true),capeMat,g);
    cape.position.set(0,FLOOR_Y+.93,-.23);cape.rotation.z=Math.PI;
    const crystal=mesh(new THREE.OctahedronGeometry(.21),emissive(0xc6f6ff,1.4),g);
    crystal.position.set(.46,FLOOR_Y+1.46,.29);
  } else if(data.style==='warlock') {
    human(g,{height:2.0,cloth:0x594166,cape:0x25233d,skin:0xb88e7a,skirt:false});
    const hood=mesh(new THREE.ConeGeometry(.39,.52,8),material(0x272138),g);
    hood.position.set(0,FLOOR_Y+2.00,-.07);
    const collar=mesh(new THREE.ConeGeometry(.53,.56,8,1,true),material(0x392447),g);
    collar.position.set(0,FLOOR_Y+1.42,-.22);collar.rotation.x=Math.PI;
    rod([-.48,FLOOR_Y+.55,.13],[-.57,FLOOR_Y+2.30,.10],.068,stoneDark,g,.045);
    const focus=orb(.19,emissive(0xc78cff,1.45),-.57,FLOOR_Y+2.33,.1,g,2);
    const sigil=torus(.30,.028,emissive(0xd19bfa,.7),.06,FLOOR_Y+1.15,.40,g);
  } else if(data.style==='rogue') {
    human(g,{height:1.37,cloth:0x527054,cape:0x283e36,skin:0xd5ae8a,skirt:false});
    hair(g,0x5a3d2b,1.37,.40);
    const hood=mesh(new THREE.ConeGeometry(.35,.36,8),material(0x344b3c),g);
    hood.position.set(0,FLOOR_Y+1.43,.02);
    box(.49,.16,.32,material(0x614737),0,FLOOR_Y+.71,.04,g);
    for(const side of [-1,1]) {
      rod([side*.41,FLOOR_Y+.63,.1],[side*.55,FLOOR_Y+1.05,.40],.048,material(0x7c7a78,.4),g,.02);
      const dagger=mesh(new THREE.ConeGeometry(.10,.37,4),material(0xc0c6ce,.5),g);
      dagger.position.set(side*.55,FLOOR_Y+1.20,.41);
    }
  }
}
function createEnemyMini(data,g) {
  const cloth=material(data.color);
  if(data.style==='book') {
    const floating=new THREE.Group();floating.position.y=FLOOR_Y+.93;g.add(floating);g.userData.floating=floating;
    const pages=material(0xd9cfab),cover=material(0x703a5f,.25),trim=material(0xbba76f,.5);
    const left=box(.49,.13,.77,pages,-.25,0,0,floating);left.rotation.z=.20;
    const right=box(.49,.13,.77,pages,.25,0,0,floating);right.rotation.z=-.20;
    const l=box(.53,.055,.81,cover,-.25,-.10,0,floating);l.rotation.z=.20;
    const r=box(.53,.055,.81,cover,.25,-.10,0,floating);r.rotation.z=-.20;
    box(.14,.2,.81,trim,0,-.045,0,floating);
    const eye=orb(.13,emissive(0xf3d28e,1.35),0,.15,.05,floating,2);
    for(const side of [-1,1])box(.08,.02,.4,trim,side*.29,.10,0,floating);
  } else if(data.style==='wolf') {
    const fur=material(0x65616b),dark=material(0x353844),red=material(0xa92d3f),eyes=emissive(0xe9ad89,.8);
    const body=orb(.55,fur,0,FLOOR_Y+.78,-.19,g,1);body.scale.set(.77,.74,1.45);
    for(const side of [-1,1])for(const d of [-1,1]){
      rod([side*.35,FLOOR_Y+.65,d*.37],[side*.38,FLOOR_Y+.27,d*.43],.10,fur,g,.09);
      orb(.12,dark,side*.39,FLOOR_Y+.25,d*.46,g,1);
    }
    const head=orb(.42,fur,0,FLOOR_Y+1.08,.48,g,1);head.scale.set(1,.82,1.04);
    const snout=orb(.25,dark,0,FLOOR_Y+.99,.82,g,1);snout.scale.set(.9,.48,1.7);
    for(const side of [-1,1]) {
      const ear=mesh(new THREE.ConeGeometry(.17,.39,5),fur,g);ear.position.set(side*.26,FLOOR_Y+1.47,.32);
      orb(.062,eyes,side*.19,FLOOR_Y+1.15,.85,g,1);
    }
    const hood=mesh(new THREE.ConeGeometry(.49,.94,8,1,true),red,g);hood.position.set(0,FLOOR_Y+1.10,-.01);
    const tail=rod([0,FLOOR_Y+.83,-.65],[0,FLOOR_Y+1.30,-1.11],.18,fur,g,.04);
    const fringe=box(.84,.10,.13,red,0,FLOOR_Y+1.01,.48,g);
  } else if(data.style==='goose') {
    const feathers=material(0xdcd2b4),wingMat=material(0xb6a984),beak=material(0xd89548),ink=material(0x38333a);
    const body=orb(.52,feathers,0,FLOOR_Y+.83,-.12,g,1);body.scale.set(.82,.85,1.30);
    const wingL=orb(.27,wingMat,-.35,FLOOR_Y+.89,-.21,g,1);wingL.scale.set(.45,.62,1.1);wingL.rotation.z=-.35;
    const wingR=orb(.27,wingMat,.35,FLOOR_Y+.94,-.15,g,1);wingR.scale.set(.55,.43,1.08);wingR.rotation.z=.35;
    rod([0,FLOOR_Y+.87,.27],[.11,FLOOR_Y+1.65,.44],.16,feathers,g,.14);
    orb(.24,feathers,.12,FLOOR_Y+1.72,.44,g,1);
    const nose=mesh(new THREE.ConeGeometry(.14,.42,5),beak,g);
    nose.position.set(.12,FLOOR_Y+1.68,.74);nose.rotation.x=Math.PI/2;
    for(const side of [-1,1]) {
      rod([side*.2,FLOOR_Y+.50,-.10],[side*.20,FLOOR_Y+.30,.01],.048,beak,g,.046);
      box(.21,.06,.32,beak,side*.20,FLOOR_Y+.27,.22,g);
      orb(.055,ink,.12+side*.18,FLOOR_Y+1.80,.60,g,1);
    }
    for(let i=0;i<3;i++){
      const feather=mesh(new THREE.ConeGeometry(.07,.27,5),feathers,g);
      feather.position.set(.05+i*.09,FLOOR_Y+2.01,.33);feather.rotation.z=(i-1)*.47;
    }
  } else if(data.style==='flutist') {
    human(g,{height:1.83,cloth:0x82744e,cape:0x394d55,skin:0xcba084,skirt:false});
    const hat=mesh(new THREE.ConeGeometry(.37,.61,8),material(0x5f434d),g);hat.position.set(0,FLOOR_Y+1.97,0);
    cylinder(.47,.47,.09,10,material(0x5f434d),0,FLOOR_Y+1.70,0,g);
    box(.23,.07,.12,material(0x4a362d),0,FLOOR_Y+1.16,.27,g);
    // Held transverse flute, with visible finger holes.
    rod([-.66,FLOOR_Y+1.31,.49],[.67,FLOOR_Y+1.48,.49],.055,material(0xdabf80,.65),g);
    for(let i=0;i<5;i++)orb(.025,material(0x514538),-.36+i*.19,FLOOR_Y+1.37+i*.025,.535,g,0);
  } else if(data.style==='woodcutter') {
    human(g,{height:1.48,cloth:0x627e8a,cape:0x855c48,skin:0xd6b394,skirt:false});
    hair(g,0x69432c,1.48,.18);
    box(.49,.16,.30,material(0x855a33),0,FLOOR_Y+.70,.10,g);
    const handle=rod([.40,FLOOR_Y+.37,.15],[.66,FLOOR_Y+1.63,.17],.045,material(0x9e704b),g,.04);
    const blade=mesh(new THREE.CylinderGeometry(.19,.32,.32,3),material(0xc7c9cc,.48),g);
    blade.position.set(.62,FLOOR_Y+1.53,.21);blade.rotation.z=-Math.PI/2;
    box(.19,.065,.45,material(0x6a503a),-.25,FLOOR_Y+.65,.10,g);
  }
}
function createPiece(data,team) {
  const root=new THREE.Group();root.userData={type:'piece',id:data.id,team};
  root.position.set(world(data.x),0,world(data.z));scene.add(root);
  // All heroes start off-board, including in the original Library scene.
  root.visible = team !== 'hero';
  const small=(data.style==='rogue'||data.style==='woodcutter');
  const ring=baseFor(root,data.color,small);
  if(team==='hero')createPlayerMini(data,root);
  else createEnemyMini(data,root);
  // Every descendant returns to its owning piece for raycast selection.
  const label=makeLabel(data.name,team==='hero'?'hero':'enemy');
  const piece={...data,team,root,ring,label,spawned:team!=='hero',path:[],moving:false,moveProgress:0};
  if(team==='hero')label.style.display='none';
  if(team==='hero')players.push(piece);else enemies.push(piece);
  return piece;
}

// Movement and interaction work identically for heroes and enemies.
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
const tileDummy=new THREE.Object3D();
let clickTargets=[];
let selectedPiece=null,reachable=new Map(),pendingSpawn=null,pendingHeroSpawn=null,enemyCounter=0;
let cameraTween=null,currentCamera='orbit';
let toastTimeout,feedbackTimeout;
const allPieces=()=>[...players,...enemies];
const occupied=(x,z,exceptId)=>allPieces().some(p=>p.spawned&&p.id!==exceptId&&p.x===x&&p.z===z);
const freeTile=(x,z,exceptId)=>walkable(x,z)&&!occupied(x,z,exceptId);
function calculateReachable(piece) {
  const found=new Map(),queue=[{x:piece.x,z:piece.z,path:[]}];
  found.set(key(piece.x,piece.z),[]);
  for(let head=0;head<queue.length;head++) {
    const cur=queue[head];if(cur.path.length>=MOVE_RANGE)continue;
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const x=cur.x+dx,z=cur.z+dz,k=key(x,z);
      if(!freeTile(x,z,piece.id)||found.has(k))continue;
      const path=[...cur.path,{x,z}];found.set(k,path);queue.push({x,z,path});
    }
  }
  found.delete(key(piece.x,piece.z));return found;
}
function refreshReachable() {
  reachable=selectedPiece&&selectedPiece.spawned&&!selectedPiece.moving&&!pendingSpawn&&!pendingHeroSpawn?calculateReachable(selectedPiece):new Map();
  let i=0;
  for(const k of reachable.keys()) {
    const [x,z]=k.split(',').map(Number);
    tileDummy.position.set(world(x),FLOOR_Y+.073,world(z));
    tileDummy.rotation.set(-Math.PI/2,0,0);tileDummy.scale.set(1,1,1);
    tileDummy.updateMatrix();moveOverlay.setMatrixAt(i++,tileDummy.matrix);
  }
  moveOverlay.count=i;moveOverlay.instanceMatrix.needsUpdate=true;
  $('move-status').textContent=pendingHeroSpawn?'Click a free tile to place hero':pendingSpawn?'Choose an empty tile to spawn':selectedPiece?
    `${selectedPiece.name} · ${i} reachable tiles`:'Select a miniature to move';
}
function selectPiece(id) {
  if(allPieces().some(p=>p.moving))return;
  const next=allPieces().find(p=>p.id===id)||null;
  if(next?.team==='hero'&&!next.spawned){armHeroSpawn(next.id);return;}
  pendingSpawn=null;pendingHeroSpawn=null;
  selectedPiece=next;
  allPieces().forEach(p=>p.ring.visible=p===selectedPiece);
  refreshReachable();renderPartyUI();renderEncounterUI();
  if(selectedPiece)$('scene-status').textContent=`${selectedPiece.name.toUpperCase()} READY TO MOVE`;
}
function requestMove(x,z) {
  if(!selectedPiece||selectedPiece.moving)return;
  const path=reachable.get(key(x,z));
  if(!path){showToast('That square is blocked or beyond the six-tile movement range.');return;}
  selectedPiece.pathStart={x:selectedPiece.x,z:selectedPiece.z};
  selectedPiece.path=path;selectedPiece.moveProgress=0;selectedPiece.moving=true;
  selectedPiece.x=x;selectedPiece.z=z; // Reserve destination before animation.
  refreshReachable();
  $('scene-status').textContent=`${selectedPiece.name.toUpperCase()} MOVES ${path.length} SQUARE${path.length===1?'':'S'}`;
}
function updatePieceWalk(dt,time) {
  for(const p of allPieces()) {
    if(!p.spawned)continue;
    if(!p.moving) {
      if(p.style==='book'&&p.root.userData.floating){
        p.root.userData.floating.position.y=FLOOR_Y+.93+Math.sin(time*2+p.x)*.12;
        p.root.userData.floating.rotation.z=Math.sin(time*1.2+p.z)*.11;
      }
      continue;
    }
    p.moveProgress+=dt*3.75;
    const segment=Math.floor(p.moveProgress);
    const prev=segment===0?p.pathStart:p.path[Math.min(segment-1,p.path.length-1)];
    const next=p.path[Math.min(segment,p.path.length-1)];
    if(p.moveProgress>=p.path.length) {
      p.root.position.set(world(p.x),0,world(p.z));p.moving=false;p.path=[];
      if(selectedPiece===p)refreshReachable();
      $('scene-status').textContent=`${p.name.toUpperCase()} REACHED THEIR SQUARE`;
    } else if(prev&&next) {
      const t=p.moveProgress-segment,ease=t*t*(3-2*t);
      p.root.position.x=THREE.MathUtils.lerp(world(prev.x),world(next.x),ease);
      p.root.position.z=THREE.MathUtils.lerp(world(prev.z),world(next.z),ease);
      p.root.position.y=Math.sin(t*Math.PI)*.16;
      const dx=next.x-prev.x,dz=next.z-prev.z;
      if(dx||dz)p.root.rotation.y=Math.atan2(dx,dz);
    }
  }
}
function findFreeNear(x,z,exceptId,avoidTiles=new Set([key(x,z)])) {
  if(!avoidTiles.has(key(x,z))&&freeTile(x,z,exceptId))return {x,z};
  const candidates=[];
  for(let iz=-HALF;iz<=BRIDGE_END;iz++)for(let ix=-HALF;ix<=HALF;ix++)if(!avoidTiles.has(key(ix,iz))&&freeTile(ix,iz,exceptId)){
    candidates.push({x:ix,z:iz,d:Math.abs(x-ix)+Math.abs(z-iz)});
  }
  candidates.sort((a,b)=>a.d-b.d);return candidates[0]||null;
}
function resetParty() {
  if(allPieces().some(p=>p.moving))return;
  for(const p of players) {
    p.spawned=false;p.root.visible=false;p.label.style.display='none';p.path=[];p.moving=false;p.ring.visible=false;
  }
  pendingHeroSpawn=null;pendingSpawn=null;selectedPiece=null;
  rebuildClickTargets();refreshReachable();renderPartyUI();renderEncounterUI();
  showToast('All four heroes are now unspawned. Choose any hero to place them.');
}
function unspawnSelectedHero() {
  if(selectedPiece?.team!=='hero'||selectedPiece.moving)return;
  const p=selectedPiece;p.spawned=false;p.root.visible=false;p.label.style.display='none';p.ring.visible=false;
  selectedPiece=null;pendingHeroSpawn=null;rebuildClickTargets();refreshReachable();renderPartyUI();renderEncounterUI();
  showToast(`${p.name} removed from the board.`);
}
function armHeroSpawn(id) {
  if(allPieces().some(p=>p.moving))return;
  const hero=players.find(p=>p.id===id);
  if(!hero||hero.spawned)return;
  pendingSpawn=null;selectedPiece=null;
  pendingHeroSpawn=pendingHeroSpawn===id?null:id;
  allPieces().forEach(p=>p.ring.visible=false);
  refreshReachable();renderPartyUI();renderEncounterUI();
  if(pendingHeroSpawn)showToast(`Click an empty tile to place ${hero.name}. Escape cancels.`);
}
function placeHero(x,z) {
  if(!pendingHeroSpawn)return;
  if(!freeTile(x,z)){showToast('Choose an open, walkable grid square.');return;}
  const hero=players.find(p=>p.id===pendingHeroSpawn);
  if(!hero)return;
  hero.x=x;hero.z=z;hero.spawned=true;hero.root.visible=true;hero.root.position.set(world(x),0,world(z));
  hero.root.rotation.y=0;pendingHeroSpawn=null;
  rebuildClickTargets();selectPiece(hero.id);showToast(`${hero.name} enters the Library.`);
}
function startSpawning(typeId) {
  const type=ENEMY_TYPES.find(e=>e.id===typeId);
  if(!type||allPieces().some(p=>p.moving))return;
  pendingHeroSpawn=null;
  pendingSpawn=pendingSpawn===typeId?null:typeId;
  if(pendingSpawn){
    selectedPiece=null;allPieces().forEach(p=>p.ring.visible=false);
    $('scene-status').textContent=`PLACE ${type.name.toUpperCase()} ON THE MAP`;
    showToast(`Click a free grid square to spawn ${type.name}. Escape cancels.`);
  }
  refreshReachable();renderPartyUI();renderEncounterUI();
}
function placeEnemy(x,z) {
  if(!pendingSpawn)return;
  if(!freeTile(x,z)){showToast('Choose an unoccupied tile, away from the statue and podiums.');return;}
  const type=ENEMY_TYPES.find(e=>e.id===pendingSpawn);
  const n=++enemyCounter;
  const enemy=createPiece({...type,style:type.id,id:`enemy-${n}`,name:`${type.name} #${n}`,x,z},'enemy');
  pendingSpawn=null;rebuildClickTargets();selectPiece(enemy.id);
  $('scene-status').textContent=`${type.name.toUpperCase()} HAS ENTERED THE LIBRARY`;
  showToast(`${type.name} spawned. Select highlighted squares to move it.`);
}
function removeSelectedEnemy() {
  if(!selectedPiece||selectedPiece.team!=='enemy')return;
  const enemy=selectedPiece;
  enemy.root.parent.remove(enemy.root);
  enemy.label.remove();
  enemies.splice(enemies.indexOf(enemy),1);
  selectedPiece=null;rebuildClickTargets();selectPiece(null);
  showToast(`${enemy.name} removed.`);
}
function clearEnemies() {
  if(enemies.some(e=>e.moving))return;
  for(const enemy of enemies){enemy.root.parent.remove(enemy.root);enemy.label.remove();}
  enemies.length=0;pendingSpawn=null;selectedPiece=null;
  rebuildClickTargets();selectPiece(null);showToast('All enemy pieces have been removed.');
}
function renderPartyUI() {
  $('party-list').replaceChildren();
  players.forEach((p,i)=>{
    const btn=document.createElement('button');btn.className=`party-member ${selectedPiece===p||pendingHeroSpawn===p.id?'selected':''}`;
    btn.innerHTML=`<span class="character-gem" style="background:${hex(p.color)}33;border-color:${hex(p.color)}99">${p.symbol}</span><span class="member-copy"><span class="member-name">${p.name}</span><span class="member-class">${p.job}</span></span><span class="member-index">${!p.spawned?(pendingHeroSpawn===p.id?'PLACE':'SPAWN'):`0${i+1}`}</span>`;
    btn.addEventListener('click',()=>selectPiece(p.id));$('party-list').append(btn);
  });
  $('unspawn-hero').disabled=selectedPiece?.team!=='hero';
}
function renderEncounterUI() {
  $('spawn-list').replaceChildren();
  for(const type of ENEMY_TYPES) {
    const btn=document.createElement('button');btn.className=`spawn-button ${pendingSpawn===type.id?'selected':''}`;
    btn.innerHTML=`<span class="spawn-glyph" style="color:${hex(type.color)}">${type.symbol}</span><span class="spawn-copy"><strong>${type.name}</strong><small>${type.detail}</small></span><span class="spawn-action">${pendingSpawn===type.id?'CANCEL':'SPAWN'}</span>`;
    btn.addEventListener('click',()=>startSpawning(type.id));$('spawn-list').append(btn);
  }
  $('enemy-list').replaceChildren();
  if(!enemies.length){
    const empty=document.createElement('p');empty.className='empty-enemies';empty.textContent='No enemies in the encounter yet.';
    $('enemy-list').append(empty);
  } else {
    enemies.forEach(e=>{
      const btn=document.createElement('button');btn.className=`enemy-entry ${selectedPiece===e?'selected':''}`;
      btn.innerHTML=`<span style="color:${hex(e.color)}">●</span><span>${e.name}</span><small>${e.x}, ${e.z}</small>`;
      btn.addEventListener('click',()=>selectPiece(e.id));$('enemy-list').append(btn);
    });
  }
  $('enemy-count').textContent=String(enemies.length);
  $('remove-enemy').disabled=selectedPiece?.team!=='enemy';
  $('cancel-spawn').hidden=!pendingSpawn;
}
function showToast(message) {
  const el=$('toast');el.textContent=message;el.classList.add('visible');
  clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>el.classList.remove('visible'),3200);
}
function flashResult(success) {
  const layer=$('result-flash');const word=$('result-word');
  layer.hidden=false;layer.classList.remove('success','failure','playing');
  void layer.offsetWidth; // Restart the flash animation on repeated clicks.
  layer.classList.add(success?'success':'failure','playing');
  word.textContent=success?'SUCCESS':'FAILURE';
  $('scene-status').textContent=success?'THE TRIAL IS COMPLETE':'THE TRIAL HAS FAILED';
  clearTimeout(feedbackTimeout);feedbackTimeout=setTimeout(()=>{layer.hidden=true;layer.classList.remove('playing');},2600);
}
function rebuildClickTargets() {
  clickTargets=[...allPieces().filter(p=>p.spawned).map(p=>p.root),...hitSurfaces];
}
const down={x:0,y:0};
renderer.domElement.addEventListener('pointerdown',e=>{down.x=e.clientX;down.y=e.clientY;});
renderer.domElement.addEventListener('pointerup',e=>{
  if(Math.hypot(e.clientX-down.x,e.clientY-down.y)>5)return;
  const rect=renderer.domElement.getBoundingClientRect();
  pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);
  raycaster.setFromCamera(pointer,camera);
  const hits=raycaster.intersectObjects(clickTargets,true);
  if(!hits.length)return;
  const hit=hits[0];let obj=hit.object;
  while(obj&&!obj.userData.type)obj=obj.parent;
  if(!obj)return;
  if(obj.userData.type==='piece') {
    if(pendingSpawn||pendingHeroSpawn){showToast('Choose an empty square to place the miniature.');return;}
    selectPiece(obj.userData.id);
  } else if(obj.userData.type==='board') {
    const x=Math.round(hit.point.x/CELL),z=Math.round(hit.point.z/CELL);
    if(!isTile(x,z))return;
    if(pendingHeroSpawn)placeHero(x,z);
    else if(pendingSpawn)placeEnemy(x,z);
    else if(selectedPiece)requestMove(x,z);
  }
});

// Camera angles frame both the dramatic statue and its long approach bridge.
const clock=new THREE.Clock();
function setCameraMode(mode) {
  currentCamera=mode;
  $('view-orbit').classList.toggle('active',mode==='orbit');
  $('view-board').classList.toggle('active',mode==='board');
  const target=mode==='board'?new THREE.Vector3(0,0,14):new THREE.Vector3(0,5,13);
  const position=mode==='board'?new THREE.Vector3(.01,76,14.01):new THREE.Vector3(24,29,29);
  cameraTween={fromPos:camera.position.clone(),toPos:position,fromTarget:controls.target.clone(),toTarget:target,start:clock.getElapsedTime()};
}
function updateCameraTween(time) {
  if(!cameraTween)return;
  const t=Math.min(1,(time-cameraTween.start)/1.15),v=t*t*(3-2*t);
  camera.position.lerpVectors(cameraTween.fromPos,cameraTween.toPos,v);
  controls.target.lerpVectors(cameraTween.fromTarget,cameraTween.toTarget,v);
  if(t>=1)cameraTween=null;
}
controls.addEventListener('start',()=>{cameraTween=null;});
$('view-orbit').addEventListener('click',()=>setCameraMode('orbit'));
$('view-board').addEventListener('click',()=>setCameraMode('board'));
$('reset-camera').addEventListener('click',()=>setCameraMode('orbit'));
$('toggle-books').addEventListener('click',()=>{
  booksPaused=!booksPaused;
  $('toggle-books').innerHTML=booksPaused?'✧ <span>Resume books</span>':'✧ <span>Pause books</span>';
  $('toggle-books').classList.toggle('active',booksPaused);
  showToast(booksPaused?'The books are suspended in time.':'The books drift again.');
});
$('reset-party').addEventListener('click',resetParty);
$('unspawn-hero').addEventListener('click',unspawnSelectedHero);
$('remove-enemy').addEventListener('click',removeSelectedEnemy);
$('clear-enemies').addEventListener('click',clearEnemies);
$('cancel-spawn').addEventListener('click',()=>{pendingSpawn=null;refreshReachable();renderEncounterUI();});
$('feedback-success').addEventListener('click',()=>flashResult(true));
$('feedback-fail').addEventListener('click',()=>flashResult(false));
$('result-flash').addEventListener('click',()=>{$('result-flash').hidden=true;});
const help=$('help-modal');
$('help-button').addEventListener('click',()=>{help.hidden=false;});
$('close-help').addEventListener('click',()=>{help.hidden=true;});
$('start-exploring').addEventListener('click',()=>{help.hidden=true;});
help.addEventListener('click',e=>{if(e.target===help)help.hidden=true;});
function toggleTopbar(visible) {
  $('topbar').hidden=!visible;
  $('show-topbar').hidden=visible;
}
$('hide-topbar').addEventListener('click',()=>toggleTopbar(false));
$('show-topbar').addEventListener('click',()=>toggleTopbar(true));
window.addEventListener('keydown',e=>{
  if(e.target instanceof HTMLElement && ['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName))return;
  if(e.key>='1'&&e.key<='4'&&!e.altKey&&!e.ctrlKey&&!e.metaKey)selectPiece(PARTY[Number(e.key)-1].id);
  if(e.key==='Escape') {
    help.hidden=true;$('result-flash').hidden=true;pendingSpawn=null;pendingHeroSpawn=null;
    refreshReachable();renderEncounterUI();
  }
});
window.addEventListener('resize',()=>{
  camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();
  renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));
});
function updateWorldLabels() {
  const v=new THREE.Vector3();
  function place(el,position,dy,show=true) {
    if(!show){el.style.display='none';return;}
    v.copy(position);v.y+=dy;v.project(camera);
    const inView=v.z>0&&v.z<1&&Math.abs(v.x)<.94&&Math.abs(v.y)<.93;
    el.style.display=inView?'block':'none';
    if(!inView)return;
    el.style.left=`${(v.x*.5+.5)*innerWidth}px`;
    el.style.top=`${(-v.y*.5+.5)*innerHeight}px`;
  }
  for(const p of allPieces()) {
    const distance=camera.position.distanceTo(p.root.position);
    place(p.label,p.root.position,p.style==='book'?2:2.65,p.spawned&&distance<70);
  }
}

createHall();createShelves();createBoard();createBahamut();createPodiums();
createParticles();createFlyingBooks();PARTY.forEach(d=>createPiece(d,'hero'));
rebuildClickTargets();renderPartyUI();renderEncounterUI();refreshReachable();
$('book-count').textContent=BOOK_COUNT.toLocaleString('en-US');
let previousTime=0;
function animate() {
  requestAnimationFrame(animate);
  const time=clock.getElapsedTime(),dt=Math.min(.05,time-previousTime);previousTime=time;
  updateFlyingBooks(time);updatePieceWalk(dt,time);updateCameraTween(time);
  if(dust)dust.rotation.y=time*.0012;
  if(arcaneRings[0])arcaneRings[0].rotation.z=time*.025;
  if(arcaneRings[1])arcaneRings[1].rotation.z=-time*.018;
  controls.update();updateWorldLabels();renderer.render(scene,camera);
}
animate();
