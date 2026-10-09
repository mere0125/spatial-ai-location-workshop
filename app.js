const canvas = document.querySelector("#world");
const ctx = canvas.getContext("2d");

const pulls = [
  { id:"deadline", name:"THE DEADLINE", x:76, y:18, rx:18, ry:13, color:"#ef5b45", note:"loud · urgent · impossible to ignore" },
  { id:"idea", name:"A GOOD IDEA", x:52, y:35, rx:16, ry:12, color:"#f2c230", note:"fragile · exciting · finally moving" },
  { id:"home", name:"HOME", x:23, y:62, rx:18, ry:13, color:"#4b78d1", note:"quiet · far away · soft bed" },
  { id:"hunger", name:"HUNGER", x:72, y:63, rx:17, ry:12, color:"#44a46b", note:"noodles? · definitely noodles" },
  { id:"phone", name:"MY PHONE", x:22, y:22, rx:14, ry:11, color:"#9a67bd", note:"one quick look · never one quick look" },
];

const objects = [
  { id:"coffee", name:"cold coffee", x:42, y:55, glyph:"☕" },
  { id:"charger", name:"phone charger", x:31, y:31, glyph:"⌁" },
  { id:"card", name:"metro card", x:18, y:52, glyph:"▭" },
  { id:"sketch", name:"crumpled sketch", x:62, y:46, glyph:"✎" },
];

const initialThoughts = [
  ["the section cut",60,28,0], ["train home",31,57,2], ["unread text",25,29,4],
  ["noodles",65,58,3], ["one good line",50,39,1], ["tomorrow morning",69,34,0],
  ["laundry",37,63,2], ["change it again",55,49,1],
];
const spareThoughts = ["email professor","buy oat milk","is this too much?","save the file","call mom","the missing stair"];

let thoughts=[];
let playing=true;
let speed=1;
let elapsed=0;
let last=performance.now();
let pulse=null;

function makeThought(name,x,y,target){
  return {id:`t-${Math.random().toString(36).slice(2,8)}`,name,x,y,target,vx:(Math.random()-.5)*.4,vy:(Math.random()-.5)*.4,phase:Math.random()*6.28};
}
function reset(){
  thoughts=initialThoughts.map(v=>makeThought(...v));
  fillSelects();
}
function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function inside(x,y,p,m=1){return ((x-p.x)/(p.rx*m))**2+((y-p.y)/(p.ry*m))**2<=1}
function direction(dx,dy){
  const a=Math.atan2(dy,dx)*180/Math.PI;
  if(a>=-22.5&&a<22.5)return"east";if(a<67.5&&a>=22.5)return"southeast";if(a<112.5&&a>=67.5)return"south";if(a<157.5&&a>=112.5)return"southwest";if(a>=157.5||a<-157.5)return"west";if(a<-112.5)return"northwest";if(a<-67.5)return"north";return"northeast";
}
function toScreen(x,y){return{x:x/100*canvas.clientWidth,y:y/80*canvas.clientHeight}}
function toWorld(x,y){return{x:x/canvas.clientWidth*100,y:y/canvas.clientHeight*80}}

function locate(x,y){
  const here=pulls.filter(p=>inside(x,y,p));
  if(here.length>1)return{title:`between ${here.map(p=>p.name.toLowerCase()).join(" + ")}`,detail:"two pulls are competing here"};
  if(here.length===1){
    const p=here[0],d=dist({x,y},p);
    return d<Math.min(p.rx,p.ry)*.35?{title:`right in ${p.name.toLowerCase()}`,detail:p.note}:{title:`the ${direction(x-p.x,y-p.y)} edge of ${p.name.toLowerCase()}`,detail:p.note};
  }
  const nearest=[...pulls].sort((a,b)=>dist({x,y},a)-dist({x,y},b))[0];
  return{title:"in the blank space",detail:`closest pull: ${nearest.name.toLowerCase()}`};
}

function resize(){
  const ratio=Math.min(devicePixelRatio||1,2);
  canvas.width=Math.round(canvas.clientWidth*ratio);canvas.height=Math.round(canvas.clientHeight*ratio);
  ctx.setTransform(ratio,0,0,ratio,0,0);
}

function paper(){
  const w=canvas.clientWidth,h=canvas.clientHeight;
  ctx.clearRect(0,0,w,h);
  ctx.strokeStyle="rgba(40,37,33,.10)";ctx.lineWidth=1;ctx.setLineDash([1,7]);
  for(let x=5;x<100;x+=5){const sx=toScreen(x,0).x;ctx.beginPath();ctx.moveTo(sx,0);ctx.lineTo(sx,h);ctx.stroke()}
  for(let y=5;y<80;y+=5){const sy=toScreen(0,y).y;ctx.beginPath();ctx.moveTo(0,sy);ctx.lineTo(w,sy);ctx.stroke()}
  ctx.setLineDash([]);ctx.fillStyle="rgba(40,37,33,.34)";ctx.font="9px Courier New";
  ctx.fillText("N ↑",w-42,20);ctx.fillText("0,0",7,14);
}

function scribbleBlob(p,i){
  const c=toScreen(p.x,p.y),sx=canvas.clientWidth/100,sy=canvas.clientHeight/80;
  const breathe=1+Math.sin(elapsed*.0008+i*1.3)*.035;
  ctx.save();ctx.globalAlpha=.52;ctx.fillStyle=p.color;ctx.globalCompositeOperation="multiply";
  ctx.beginPath();
  for(let n=0;n<=55;n++){
    const a=n/55*Math.PI*2;
    const rough=1+.055*Math.sin(a*5+i*2)+.035*Math.cos(a*9+elapsed*.00025);
    const x=c.x+Math.cos(a)*p.rx*sx*rough*breathe,y=c.y+Math.sin(a)*p.ry*sy*rough*breathe;
    n?ctx.lineTo(x,y):ctx.moveTo(x,y);
  }
  ctx.closePath();ctx.fill();ctx.restore();
  ctx.save();ctx.translate(c.x,c.y);ctx.rotate((i-2)*.025);
  ctx.fillStyle="#282521";ctx.font='700 13px "Courier New"';ctx.textAlign="center";ctx.fillText(p.name,0,-2);
  ctx.font='10px "Bradley Hand","Comic Sans MS",cursive';ctx.fillText(p.note,0,13);ctx.restore();
}

function drawObject(o){
  const p=toScreen(o.x,o.y);ctx.save();ctx.translate(p.x,p.y);ctx.rotate(-.08);
  ctx.fillStyle="#faf7ee";ctx.strokeStyle="#282521";ctx.lineWidth=1.5;ctx.setLineDash([3,2]);
  ctx.beginPath();ctx.rect(-12,-12,24,24);ctx.fill();ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle="#282521";ctx.font="15px serif";ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(o.glyph,0,0);ctx.restore();
}

function drawThought(t){
  const p=toScreen(t.x,t.y),bob=Math.sin(elapsed*.004+t.phase)*2;
  ctx.save();ctx.translate(p.x,p.y+bob);ctx.rotate(Math.sin(t.phase+elapsed*.001)*.08);
  ctx.strokeStyle="#282521";ctx.fillStyle="#fffdf7";ctx.lineWidth=1.7;
  ctx.beginPath();ctx.ellipse(0,0,7,5,0,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.beginPath();ctx.moveTo(-5,3);ctx.lineTo(-9,8);ctx.lineTo(-1,5);ctx.stroke();
  ctx.fillStyle="#282521";ctx.font='10px "Bradley Hand","Comic Sans MS",cursive';ctx.textAlign="center";ctx.fillText(t.name,0,-10);ctx.restore();
}

function drawPulse(){
  if(!pulse)return;const age=performance.now()-pulse.time;if(age>1100){pulse=null;return}
  const p=toScreen(pulse.x,pulse.y);ctx.save();ctx.strokeStyle=`rgba(40,37,33,${1-age/1100})`;ctx.lineWidth=2;ctx.setLineDash([4,3]);ctx.beginPath();ctx.arc(p.x,p.y,8+age*.025,0,Math.PI*2);ctx.stroke();ctx.restore();
}

function move(dt){
  thoughts.forEach((t,i)=>{
    const goal=pulls[t.target];t.vx+=(goal.x-t.x)*.00055*dt;t.vy+=(goal.y-t.y)*.00055*dt;
    t.vx+=Math.cos(elapsed*.0007+t.phase)*.0007*dt;t.vy+=Math.sin(elapsed*.0009+t.phase)*.0007*dt;
    thoughts.forEach((o,j)=>{if(i===j)return;const dx=t.x-o.x,dy=t.y-o.y,d=dx*dx+dy*dy;if(d>0&&d<20){t.vx+=dx/d*.004*dt;t.vy+=dy/d*.004*dt}});
    t.vx*=Math.pow(.986,dt/16);t.vy*=Math.pow(.986,dt/16);
    const mag=Math.hypot(t.vx,t.vy),cap=.034*dt;if(mag>cap){t.vx=t.vx/mag*cap;t.vy=t.vy/mag*cap}
    t.x+=t.vx*speed;t.y+=t.vy*speed;
    if(t.x<3||t.x>97)t.vx*=-1;if(t.y<3||t.y>77)t.vy*=-1;t.x=Math.max(3,Math.min(97,t.x));t.y=Math.max(3,Math.min(77,t.y));
    if(dist(t,goal)<5&&Math.random()<.0015*dt)t.target=Math.floor(Math.random()*pulls.length);
  });
}

function frame(now){
  const dt=Math.min(now-last,32);last=now;if(playing){elapsed+=dt*speed;move(dt)}
  paper();pulls.forEach(scribbleBlob);objects.forEach(drawObject);thoughts.forEach(drawThought);drawPulse();updateObject();updateRelative();requestAnimationFrame(frame);
}

function fillSelects(){
  const one=document.querySelector("#object-select"),two=document.querySelector("#occupant-select"),old1=one.value,old2=two.value;
  one.innerHTML=`<optgroup label="thoughts that move">${thoughts.map(t=>`<option value="thought:${t.id}">${t.name}</option>`).join("")}</optgroup><optgroup label="things stuck on the desk">${objects.map(o=>`<option value="object:${o.id}">${o.name}</option>`).join("")}</optgroup>`;
  two.innerHTML=thoughts.map(t=>`<option value="${t.id}">${t.name}</option>`).join("");
  if([...one.options].some(o=>o.value===old1))one.value=old1;if([...two.options].some(o=>o.value===old2))two.value=old2;
}
function referent(id){return thoughts.find(t=>`thought:${t.id}`===id)||objects.find(o=>`object:${o.id}`===id)}
function updateObject(){
  const o=referent(document.querySelector("#object-select").value);if(!o)return;const l=locate(o.x,o.y);
  document.querySelector("#object-result").innerHTML=`<strong>${l.title}</strong>${o.name} is at (${o.x.toFixed(1)}, ${o.y.toFixed(1)}). <small>${l.detail}</small>`;
}
function inspect(x,y,screen){
  x=Math.max(0,Math.min(100,Number(x)||0));y=Math.max(0,Math.min(80,Number(y)||0));
  document.querySelector("#query-x").value=x.toFixed(1);document.querySelector("#query-y").value=y.toFixed(1);pulse={x,y,time:performance.now()};
  const areas=pulls.filter(p=>inside(x,y,p)),near=[...thoughts.filter(t=>dist(t,{x,y})<4.5),...objects.filter(o=>dist(o,{x,y})<3.5)],l=locate(x,y);
  document.querySelector("#occupancy-result").innerHTML=`<strong>${l.title}</strong>${areas.length?areas.map(a=>a.name.toLowerCase()).join(" and ")+" occupy this point":"no pull fully occupies this point"}. ${near.length?`Nearby: ${near.map(n=>n.name).join(", ")}.`:"No thought is close enough right now."} <small>(${x.toFixed(1)}, ${y.toFixed(1)})</small>`;
  if(screen){const tip=document.querySelector("#map-tooltip");tip.hidden=false;tip.style.left=`${Math.min(screen.x,canvas.clientWidth-235)}px`;tip.style.top=`${Math.max(35,screen.y)}px`;tip.innerHTML=`<b>${l.title}</b><br>${near.length?near.map(n=>n.name).join(", "):"nothing claiming this exact spot"}`;setTimeout(()=>tip.hidden=true,2400)}
}
function updateRelative(){
  const t=thoughts.find(t=>t.id===document.querySelector("#occupant-select").value),p=pulls.find(p=>p.id===document.querySelector("#anchor-select").value);if(!t||!p)return;
  const dx=t.x-p.x,dy=t.y-p.y,bearing=(Math.atan2(dx,-dy)*180/Math.PI+360)%360,relation=inside(t.x,t.y,p)?"inside its pull":"outside its pull";
  document.querySelector("#frame-result").innerHTML=`<strong>${t.name} is ${direction(dx,dy)} of ${p.name.toLowerCase()}</strong>${relation}, ${Math.hypot(dx,dy).toFixed(1)} units from the center. <small>local vector ⟨${dx.toFixed(1)}, ${dy.toFixed(1)}⟩ / bearing ${bearing.toFixed(0)}°</small>`;
}
function crowded(){return thoughts.map(t=>({...t,count:thoughts.filter(o=>dist(t,o)<12).length})).sort((a,b)=>b.count-a.count)[0]}
function resolve(text){
  const q=text.trim().toLowerCase();let a;
  if((q.includes("idea")||q.includes("good"))&&(q.includes("panic")||q.includes("deadline")))a={title:"the productive panic seam",x:64,y:27,why:"halfway between a good idea and the deadline"};
  else if(q.includes("home")&&(q.includes("hungry")||q.includes("hunger")))a={title:"the homesick snack corridor",x:47,y:62,why:"between home and hunger"};
  else if((q.includes("far")||q.includes("away"))&&q.includes("phone"))a={title:"the phone-free corner",x:88,y:70,why:"the farthest useful corner from my phone"};
  else if(q.includes("stuck")||q.includes("crowd")||q.includes("all my thoughts")){const c=crowded();a={title:"the current thought traffic jam",x:c.x,y:c.y,why:`${c.count} thoughts are packed into this neighborhood`}}
  else if(q.includes("food")||q.includes("noodle")||q.includes("hungry"))a={title:"hunger",x:72,y:63,why:"food language resolves to the hunger pull"};
  else if(q.includes("sleep")||q.includes("bed")||q.includes("home"))a={title:"home",x:23,y:62,why:"rest and bed resolve to home"};
  else {const p=pulls.find(p=>q.includes(p.id));a=p?{title:p.name.toLowerCase(),x:p.x,y:p.y,why:"you named this pull directly"}:{title:"the desk's undecided center",x:50,y:40,why:"the description gave no strong clue, which is also a location"}}
  pulse={x:a.x,y:a.y,time:performance.now()};document.querySelector("#description-result").innerHTML=`<strong>${a.title}</strong>(${a.x.toFixed(1)}, ${a.y.toFixed(1)}) — ${a.why}.`;
}

document.querySelectorAll(".tab").forEach(tab=>tab.addEventListener("click",()=>{document.querySelectorAll(".tab").forEach(t=>{t.classList.toggle("active",t===tab);t.setAttribute("aria-selected",t===tab?"true":"false")});document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.dataset.view===tab.dataset.tab))}));
document.querySelector("#play-button").addEventListener("click",e=>{playing=!playing;e.currentTarget.textContent=playing?"pause the noise":"let thoughts move";document.querySelector("#sim-status").textContent=playing?"currently overthinking":"brain briefly quiet"});
document.querySelector("#speed-range").addEventListener("input",e=>{speed=Number(e.target.value);document.querySelector("#speed-output").value=`${speed.toFixed(1)}×`});
document.querySelector("#add-wanderer").addEventListener("click",()=>{const used=new Set(thoughts.map(t=>t.name)),name=spareThoughts.find(n=>!used.has(n))||`thought #${thoughts.length+1}`;thoughts.push(makeThought(name,50+(Math.random()-.5)*8,42+(Math.random()-.5)*8,Math.floor(Math.random()*pulls.length)));fillSelects()});
document.querySelector("#stir-button").addEventListener("click",()=>thoughts.forEach(t=>{t.target=Math.floor(Math.random()*pulls.length);t.vx+=(Math.random()-.5)*.8;t.vy+=(Math.random()-.5)*.8}));
document.querySelector("#reset-button").addEventListener("click",reset);
document.querySelector("#occupancy-query").addEventListener("click",()=>inspect(document.querySelector("#query-x").value,document.querySelector("#query-y").value));
document.querySelector("#resolve-button").addEventListener("click",()=>resolve(document.querySelector("#description-input").value));
document.querySelector("#description-input").addEventListener("keydown",e=>{if(e.key==="Enter")resolve(e.currentTarget.value)});
document.querySelectorAll(".suggestions button").forEach(b=>b.addEventListener("click",()=>{document.querySelector("#description-input").value=b.textContent;resolve(b.textContent)}));
canvas.addEventListener("click",e=>{const r=canvas.getBoundingClientRect(),s={x:e.clientX-r.left,y:e.clientY-r.top},p=toWorld(s.x,s.y);inspect(p.x,p.y,s);document.querySelector('[data-tab="occupancy"]').click()});
document.querySelector("#anchor-select").innerHTML=pulls.map(p=>`<option value="${p.id}">${p.name.toLowerCase()}</option>`).join("");
window.addEventListener("resize",resize);reset();resize();inspect(50,40);requestAnimationFrame(frame);
