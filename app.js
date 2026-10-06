
const $ = (s, el=document) => el.querySelector(s);
const $$ = (s, el=document) => [...el.querySelectorAll(s)];

const THEME_NAMES = {
  boy: "BOY · Electric Manga",
  girl: "GIRL · Neo Manga",
  machine: "MACHINE · Grid Core",
  football: "FOOTBALL · Night Match"
};

const state = {
  theme: localStorage.getItem("hit_theme_v2") || "boy",
  skin: localStorage.getItem("hit_skin_v2") || "classic",
  unlockedLevel: Number(localStorage.getItem("hit_unlocked_level_v2") || 1),
  mode: null,
  playerCount: 2,
  players: [],
  targetMode: "5",
  freeTarget: 4.2,
  target: 5,
  currentPlayer: 0,
  roundResults: [],
  level: 1,
  levelTarget: 0,
  started: false,
  startTime: 0,
  raf: null
};

const skins = [
  {id:"classic", name:"Classic Red", unlock:1, preview:"🔴"},
  {id:"neon", name:"Neon Core", unlock:1, preview:"◉"},
  {id:"tiny", name:"Tiny Hit", unlock:2, preview:"•"},
  {id:"football", name:"Football", unlock:3, preview:"⚽"},
  {id:"flower", name:"Flower", unlock:4, preview:"🌸"},
  {id:"poop", name:"Seriously?", unlock:5, preview:"💩"},
  {id:"unicorn", name:"Unicorn", unlock:6, preview:"🦄"},
  {id:"teddy", name:"Soft Mode", unlock:7, preview:"🧸"},
  {id:"cup", name:"Champions Cup", unlock:8, preview:"🏆"},
  {id:"goat", name:"GOAT", unlock:10, preview:"🐐"}
];

const nickPool = ["Ace","Nova","Pixel","Echo","Jinx","Ghost","Rookie","Turbo","Zero","Vibe","Flash","Nox"];

// Deutlich anspruchsvoller als V1.
const levelTargets = [2.0, 2.7, 3.9, 5.0, 6.4, 7.8, 9.1, 11.3, 13.7, 15.5];
const levelLimits  = [0.50,0.45,0.40,0.35,0.30,0.25,0.20,0.15,0.10,0.05];

function fmt(n){ return Number(n).toFixed(2).replace(".", ","); }
function signed(n){
  if (Math.abs(n) < 0.005) return "±0,00";
  return `${n>0?"+":"−"}${fmt(Math.abs(n))}`;
}
function escapeHtml(str=""){
  return str.replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));
}
function randomTarget(){
  const tenth = Math.floor(Math.random() * (155 - 16 + 1)) + 16;
  return tenth / 10;
}
function commentFor(absDiff){
  const pools = [
    [0.001, ["Exakt. Mehr geht nicht.","Null Abweichung. Respekt.","Perfekt getroffen."]],
    [0.03, ["Unverschämt präzise.","Das war richtig stark.","Timing auf Anschlag."]],
    [0.06, ["Sehr stark. Fast perfekt.","Sauber getroffen.","Das sitzt."]],
    [0.10, ["Richtig eng. Stark.","Kaum Luft dazwischen.","Sehr sauber."]],
    [0.18, ["Starkes Timing.","Knapp. Und zwar richtig.","Das kann sich sehen lassen."]],
    [0.30, ["Guter Hit.","Solide unter Druck.","Sauber. Noch etwas Feinschliff."]],
    [0.50, ["Ordentlich. Aber noch kein Flex.","Solide. Nächster wird enger.","Gut drin. Noch nicht gefährlich gut."]],
    [0.80, ["Noch okay. Fokus.","War drin. War aber nicht knapp.","Da geht deutlich mehr."]],
    [1.20, ["Das war eher Gefühl als Timing.","Der Moment war da. Du etwas später.","Uff. Nicht dein bester Hit."]],
    [2.00, ["Der Button war übrigens ziemlich groß.","Mutig. Präzise eher nicht.","Das war kreative Zeitrechnung."]],
    [Infinity, ["Komplett eigene Zeitzone.","Das war kein Hit. Das war ein Ausflug.","Starkes Selbstvertrauen. Fragwürdiges Timing."]]
  ];
  for(const [limit,list] of pools){
    if(absDiff <= limit) return list[Math.floor(Math.random()*list.length)];
  }
}
function setTheme(theme){
  state.theme = theme;
  document.body.dataset.theme = theme;
  localStorage.setItem("hit_theme_v2", theme);
}
function availableSkin(id){
  const s = skins.find(x=>x.id===id);
  return !!s && state.unlockedLevel >= s.unlock;
}
function setSkin(id){
  if(!availableSkin(id)) return;
  state.skin=id;
  localStorage.setItem("hit_skin_v2",id);
}
function stopTimer(){
  state.started=false;
  if(state.raf) cancelAnimationFrame(state.raf);
  state.raf=null;
}
function updateUnlock(level){
  const before = state.unlockedLevel;
  state.unlockedLevel = Math.max(state.unlockedLevel, level);
  localStorage.setItem("hit_unlocked_level_v2", state.unlockedLevel);
  return state.unlockedLevel > before;
}
function lockNextButton(button, ms=1350){
  button.disabled=true;
  const original=button.textContent;
  button.textContent="KURZ ANSCHAUEN…";
  setTimeout(()=>{
    if(!document.body.contains(button)) return;
    button.disabled=false;
    button.textContent=original;
  }, ms);
}
function animateMeter(absDiff, max=1){
  const el=$("#meterFill");
  if(!el) return;
  const pct=Math.max(4,100-(Math.min(absDiff,max)/max)*100);
  requestAnimationFrame(()=>el.style.width=`${pct}%`);
}
function renderHome(){
  stopTimer();
  state.mode=null;
  $("#homeBtn").classList.add("hidden");
  $("#screen").innerHTML=$("#home-template").innerHTML;
  setTheme(state.theme);
  $("#currentStyle").innerHTML=`<span>${THEME_NAMES[state.theme]}</span><span>·</span><span>${skins.find(s=>s.id===state.skin)?.name || "Classic Red"}</span>`;
  $$("[data-mode]").forEach(btn=>btn.addEventListener("click",()=>{
    state.mode=btn.dataset.mode;
    state.mode==="level"?renderLevelIntro():renderPartySetup();
  }));
}
function renderSettings(){
  stopTimer();
  $("#homeBtn").classList.remove("hidden");
  $("#screen").innerHTML=`
    <h1 class="screen-title">SETTINGS</h1>
    <p class="screen-sub">Look und Button ändern das Spielgefühl – nicht die Messung.</p>

    <section class="panel">
      <div class="panel-head"><h2>Style</h2><span class="muted">vier komplett unterschiedliche Looks</span></div>
      <div class="settings-grid">
        <button class="theme-card ${state.theme==="boy"?"active":""}" data-theme-choice="boy">
          <span class="theme-symbol">⚡</span><strong>BOY</strong><small>Electric Manga · dunkel · direkt</small>
        </button>
        <button class="theme-card ${state.theme==="girl"?"active":""}" data-theme-choice="girl">
          <span class="theme-symbol">✦</span><strong>GIRL</strong><small>Neo Manga · sharp · magenta</small>
        </button>
        <button class="theme-card ${state.theme==="machine"?"active":""}" data-theme-choice="machine">
          <span class="theme-symbol">⌁</span><strong>MACHINE</strong><small>Grid Core · cyan · technisch</small>
        </button>
        <button class="theme-card ${state.theme==="football"?"active":""}" data-theme-choice="football">
          <span class="theme-symbol">⚽</span><strong>FOOTBALL</strong><small>Night Match · pitch · stadium</small>
        </button>
      </div>
    </section>

    <section class="panel">
      <div class="panel-head"><h2>Button</h2><span class="muted">freigeschaltet bis Level ${state.unlockedLevel}</span></div>
      <div id="skinGrid" class="skin-grid"></div>
    </section>

    <div class="actions"><button id="settingsDone" class="primary">FERTIG</button></div>
  `;
  renderSkinGrid();
  $$("[data-theme-choice]").forEach(card=>card.addEventListener("click",()=>{
    setTheme(card.dataset.themeChoice);
    $$("[data-theme-choice]").forEach(x=>x.classList.toggle("active",x===card));
  }));
  $("#settingsDone").addEventListener("click",renderHome);
}
function renderSkinGrid(){
  const grid=$("#skinGrid");
  if(!grid) return;
  grid.innerHTML=skins.map(s=>{
    const locked=state.unlockedLevel<s.unlock;
    return `<button class="skin-card ${state.skin===s.id?"active":""}" data-skin="${s.id}" ${locked?"disabled":""}>
      ${locked?`<span class="lock">🔒 L${s.unlock}</span>`:""}
      <div class="skin-preview">${s.preview}</div>
      <div class="skin-name">${s.name}</div>
    </button>`;
  }).join("");
  $$(".skin-card").forEach(b=>b.addEventListener("click",()=>{setSkin(b.dataset.skin);renderSkinGrid();}));
}
function renderPartySetup(){
  $("#homeBtn").classList.remove("hidden");
  $("#screen").innerHTML=`
    <h1 class="screen-title">HIT! ROUND</h1>
    <p class="screen-sub">Gleiche Zielzeit für alle. Danach zählt nur die kleinste Abweichung.</p>
    <div class="setup-grid">
      <section class="panel">
        <h2>Wie viele spielen?</h2>
        <div class="choice-row">${[1,2,3,4,5,6].map(n=>`<button class="choice ${state.playerCount===n?"active":""}" data-count="${n}">${n}</button>`).join("")}</div>
      </section>

      <section class="panel">
        <h2>Zielzeit</h2>
        <div class="choice-row">
          ${["2","3","5","10"].map(v=>`<button class="choice ${state.targetMode===v?"active":""}" data-target="${v}">${v} s</button>`).join("")}
          <button class="choice ${state.targetMode==="random"?"active":""}" data-target="random">ZUFALL</button>
          <button class="choice ${state.targetMode==="free"?"active":""}" data-target="free">FREI</button>
        </div>
        <div id="freeWrap" style="margin-top:12px;${state.targetMode==="free"?"":"display:none"}">
          <label class="muted">Freie Zielzeit ab 1,50 Sekunden</label>
          <input id="freeTarget" class="input" type="number" min="1.5" max="99.99" step="0.01" value="${state.freeTarget}">
        </div>
      </section>
    </div>

    <section class="panel">
      <h2>Spieler</h2>
      <div id="playerList" class="player-list"></div>
      <div class="actions"><button id="randomNames" class="secondary">NICKS MISCHEN</button></div>
    </section>

    <div class="actions"><button id="startParty" class="primary">RUNDE STARTEN →</button></div>
  `;
  bindPartySetup();
}
function renderPlayers(){
  const list=$("#playerList");
  const current=state.players.slice(0,state.playerCount);
  while(current.length<state.playerCount) current.push(nickPool[current.length]||`Player ${current.length+1}`);
  state.players=current;
  list.innerHTML=current.map((n,i)=>`<input class="input playerName" data-i="${i}" maxlength="16" value="${escapeHtml(n)}" placeholder="Player ${i+1}">`).join("");
}
function bindPartySetup(){
  renderPlayers();
  $$("[data-count]").forEach(b=>b.addEventListener("click",()=>{
    state.playerCount=Number(b.dataset.count);
    $$("[data-count]").forEach(x=>x.classList.toggle("active",x===b));
    renderPlayers();
  }));
  $$("[data-target]").forEach(b=>b.addEventListener("click",()=>{
    state.targetMode=b.dataset.target;
    $$("[data-target]").forEach(x=>x.classList.toggle("active",x===b));
    $("#freeWrap").style.display=state.targetMode==="free"?"block":"none";
  }));
  $("#randomNames").addEventListener("click",()=>{
    state.players=[...nickPool].sort(()=>Math.random()-.5).slice(0,state.playerCount);
    renderPlayers();
  });
  $("#startParty").addEventListener("click",()=>{
    state.players=$$(".playerName").map((el,i)=>el.value.trim()||`Player ${i+1}`);
    if(state.targetMode==="random") state.target=randomTarget();
    else if(state.targetMode==="free"){
      const v=Number($("#freeTarget").value);
      state.target=Math.max(1.5,Math.min(99.99,Number.isFinite(v)?v:5));
      state.freeTarget=state.target;
    } else state.target=Number(state.targetMode);
    state.currentPlayer=0;
    state.roundResults=[];
    renderGame();
  });
}
function renderGame(){
  stopTimer();
  state.started=false;
  const name=state.mode==="level"?`LEVEL ${state.level}`:state.players[state.currentPlayer];
  const target=state.mode==="level"?state.levelTarget:state.target;
  const levelBar=state.mode==="level"?`
    <div class="level-track">${Array.from({length:10},(_,i)=>`<span class="level-dot ${i+1<state.level?"done":i+1===state.level?"current":""}"></span>`).join("")}</div>
    <div class="level-rule">Weiter bei ≤ ${fmt(levelLimits[state.level-1])} s Abweichung</div>`:"";
  const emoji={football:"⚽",flower:"🌸",unicorn:"🦄",teddy:"🧸",cup:"🏆",poop:"💩",goat:"🐐"}[state.skin];
  $("#screen").innerHTML=`
    <section class="game-wrap">
      <div class="game-meta">
        <span class="pill">${escapeHtml(name)}</span>
        ${state.mode==="party"?`<span class="pill">${state.currentPlayer+1} / ${state.playerCount}</span>`:""}
      </div>
      ${levelBar}
      <div class="target-label">TARGET</div>
      <div class="target">${fmt(target)} s</div>
      <div id="timer" class="timer">0,00<small>s</small></div>
      <div class="buzzer-wrap">
        <button id="buzzer" class="buzzer ${state.skin}" aria-label="Start oder Stopp">
          ${emoji?emoji:'<span id="buzzerLabel" class="buzzer-label">START</span>'}
        </button>
      </div>
      <div id="statusLine" class="status-line">Erster Tap startet. Zweiter Tap stoppt.</div>
    </section>`;
  $("#buzzer").addEventListener("pointerdown",e=>{
    e.preventDefault();
    state.started?finishHit():startHit();
  },{passive:false});
}
function startHit(){
  state.started=true;
  state.startTime=performance.now();
  const label=$("#buzzerLabel"); if(label) label.textContent="HIT!";
  $("#statusLine").textContent="Jetzt zählt dein Timing.";
  const tick=()=>{
    if(!state.started) return;
    const elapsed=(performance.now()-state.startTime)/1000;
    $("#timer").innerHTML=`${fmt(elapsed)}<small>s</small>`;
    state.raf=requestAnimationFrame(tick);
  };
  state.raf=requestAnimationFrame(tick);
}
function finishHit(){
  const elapsed=(performance.now()-state.startTime)/1000;
  stopTimer();
  const result=Math.round(elapsed*100)/100;
  const target=state.mode==="level"?state.levelTarget:state.target;
  const diff=Math.round((result-target)*100)/100;
  const absDiff=Math.abs(diff);
  state.mode==="level" ? renderLevelResult(result,diff,absDiff) : (
    state.roundResults.push({name:state.players[state.currentPlayer],target,result,diff,absDiff}),
    renderPartyResult(result,diff,absDiff)
  );
}
function resultCardHTML(title,result,diff,absDiff,target,buttonLabel){
  return `
    <section class="panel result-card">
      <div class="target-label">${title}</div>
      <div class="result-big">${fmt(result)}</div>
      <div class="result-diff">${signed(diff)} s</div>
      <div class="result-comment">${commentFor(absDiff)}</div>
      <div class="result-detail">Ziel: ${fmt(target)} s · Abweichung: ${fmt(absDiff)} s</div>
      <div class="result-meter"><span id="meterFill"></span></div>
      <div class="actions" style="justify-content:center"><button id="resultNext" class="primary">${buttonLabel}</button></div>
    </section>`;
}
function renderPartyResult(result,diff,absDiff){
  const label=state.currentPlayer+1<state.playerCount?"NÄCHSTER →":"AUSWERTUNG →";
  $("#screen").innerHTML=resultCardHTML(escapeHtml(state.players[state.currentPlayer]),result,diff,absDiff,state.target,label);
  animateMeter(absDiff,1);
  const btn=$("#resultNext"); lockNextButton(btn,1450);
  btn.addEventListener("click",()=>{
    state.currentPlayer++;
    state.currentPlayer<state.playerCount?renderGame():finishRound();
  });
}
async function finishRound(){
  const ranked=[...state.roundResults].sort((a,b)=>a.absDiff-b.absDiff);
  await HitScores.save(ranked.map(r=>({...r,mode:"party",theme:state.theme,createdAt:new Date().toISOString()})));
  $("#screen").innerHTML=`
    <h1 class="screen-title">RUNDE DURCH.</h1>
    <p class="screen-sub">Zielzeit: ${fmt(state.target)} s</p>
    <section class="panel">
      <div class="ranking">${ranked.map((r,i)=>`
        <div class="rank-row">
          <div class="rank-pos">${i+1}.</div>
          <div class="rank-name">${escapeHtml(r.name)} ${i===0?'<span class="badge">BEST HIT</span>':i===ranked.length-1&&ranked.length>1?'<span class="badge">NEEDS WORK</span>':""}</div>
          <div class="rank-score">${fmt(r.result)} s<br><span class="muted">${signed(r.diff)} s</span></div>
        </div>`).join("")}</div>
    </section>
    <section class="panel result-card">
      <div class="result-comment">${escapeHtml(ranked[0].name)} holt die Runde.</div>
      <div class="result-detail">${fmt(ranked[0].absDiff)} s Abweichung.${ranked.length>1?` ${escapeHtml(ranked.at(-1).name)} hat für die Revanche noch Arbeit.`:""}</div>
    </section>
    <div class="actions">
      <button id="again" class="primary">NOCHMAL</button>
      <button id="menu" class="secondary">HAUPTMENÜ</button>
    </div>`;
  $("#again").addEventListener("click",()=>{
    state.currentPlayer=0;state.roundResults=[];
    if(state.targetMode==="random") state.target=randomTarget();
    renderGame();
  });
  $("#menu").addEventListener("click",renderHome);
}
function renderLevelIntro(){
  $("#homeBtn").classList.remove("hidden");
  $("#screen").innerHTML=`
    <h1 class="screen-title">LEVEL RUN</h1>
    <p class="screen-sub">10 feste Challenges. Ab Level 6 wird’s ernst. Level 10 erlaubt nur noch 0,05 Sekunden Abweichung.</p>
    <section class="panel">
      <div class="ranking">${levelLimits.map((limit,i)=>`
        <div class="rank-row">
          <div class="rank-pos">${i+1}</div>
          <div class="rank-name">Level ${i+1}${skins.some(s=>s.unlock===i+1&&i+1>1)?` <span class="badge">UNLOCK</span>`:""}</div>
          <div class="rank-score">${fmt(levelTargets[i])} s<br><span class="muted">≤ ${fmt(limit)} s</span></div>
        </div>`).join("")}</div>
    </section>
    <div class="actions"><button id="startLevel" class="primary">LEVEL 1 STARTEN →</button></div>`;
  $("#startLevel").addEventListener("click",()=>{
    state.level=1;state.levelTarget=levelTargets[0];renderGame();
  });
}
function renderLevelResult(result,diff,absDiff){
  const limit=levelLimits[state.level-1];
  const passed=absDiff<=limit+0.0001;
  let unlockText="";
  if(passed){
    const before=state.unlockedLevel;
    updateUnlock(state.level);
    if(state.unlockedLevel>before){
      const newly=skins.filter(s=>s.unlock===state.unlockedLevel);
      if(newly.length) unlockText=`Freigeschaltet: ${newly.map(x=>x.name).join(", ")}`;
    }
  }
  const exactGoat=state.level===10&&absDiff===0;
  $("#screen").innerHTML=`
    <section class="panel result-card">
      <div class="target-label">LEVEL ${state.level}</div>
      <div class="result-big">${fmt(result)}</div>
      <div class="result-diff">${signed(diff)} s</div>
      <div class="result-comment">${passed?(exactGoat?"Perfekt. GOAT STATUS.":commentFor(absDiff)):"Noch nicht. Das Level bleibt stehen."}</div>
      <div class="result-detail">Ziel: ${fmt(state.levelTarget)} s · Grenze: ≤ ${fmt(limit)} s · Abweichung: ${fmt(absDiff)} s</div>
      <div class="result-meter"><span id="meterFill"></span></div>
      ${unlockText?`<div class="unlock-toast">${unlockText}</div>`:""}
      <div class="actions" style="justify-content:center">
        <button id="levelNext" class="primary">${passed?(state.level===10?"FINISH →":"NÄCHSTES LEVEL →"):"NOCHMAL →"}</button>
      </div>
    </section>`;
  animateMeter(absDiff,Math.max(.5,limit*2));
  const btn=$("#levelNext"); lockNextButton(btn,1550);
  btn.addEventListener("click",()=>{
    if(!passed){renderGame();return;}
    if(state.level===10){renderLevelFinish(exactGoat);return;}
    state.level++;state.levelTarget=levelTargets[state.level-1];renderGame();
  });
}
function renderLevelFinish(exact){
  updateUnlock(10);
  $("#screen").innerHTML=`
    <section class="panel result-card">
      <div class="target-label">LEVEL RUN COMPLETE</div>
      <div class="result-big">${exact?"🐐":"10/10"}</div>
      <div class="result-comment">${exact?"0,00 im Finale. GOAT.":"Alle 10 Level geschafft."}</div>
      <div class="result-detail">${exact?"Mehr Präzision gibt das Spiel nicht her.":"Der perfekte GOAT-Finish bleibt: Level 10 exakt treffen."}</div>
      <div class="unlock-toast">GOAT-Button freigeschaltet.</div>
      <div class="actions" style="justify-content:center">
        <button id="runAgain" class="primary">NOCH EIN RUN</button>
        <button id="finishMenu" class="secondary">HAUPTMENÜ</button>
      </div>
    </section>`;
  $("#runAgain").addEventListener("click",renderLevelIntro);
  $("#finishMenu").addEventListener("click",renderHome);
}
async function renderScores(){
  $("#homeBtn").classList.remove("hidden");
  const scores=await HitScores.top(30);
  $("#screen").innerHTML=`
    <h1 class="screen-title">HIGHSCORES</h1>
    <p class="screen-sub">${HitScores.provider==="local"?"Aktuell lokal auf diesem Gerät. Die Datenstruktur ist bereits für die spätere Online-Bestenliste vorbereitet.":"Online-Bestenliste"}</p>
    <section class="panel">
      ${scores.length?`<div class="score-table">${scores.map((s,i)=>{
        const d=new Date(s.createdAt);
        return `<div class="score-row">
          <strong>${i+1}.</strong>
          <div><strong>${escapeHtml(s.name)}</strong><br><span class="muted">Target ${fmt(s.target)} · Hit ${fmt(s.result)}</span></div>
          <strong>${fmt(s.absDiff)} s</strong>
          <span class="score-date muted">${d.toLocaleDateString("de-DE")}</span>
        </div>`;
      }).join("")}</div>`:`<div class="empty">Noch kein Highscore. Erst spielen, dann angeben.</div>`}
    </section>
    <div class="actions"><button id="clearScores" class="secondary">LOKALE HIGHSCORES LÖSCHEN</button></div>`;
  $("#clearScores").addEventListener("click",async()=>{
    if(confirm("Lokale Highscores wirklich löschen?")){
      await HitScores.clearLocal();renderScores();
    }
  });
}

$("#homeBtn").addEventListener("click",renderHome);
$("#settingsBtn").addEventListener("click",renderSettings);
$("#scoreBtn").addEventListener("click",renderScores);

setTheme(state.theme);
if(!availableSkin(state.skin)) state.skin="classic";
renderHome();

if("serviceWorker" in navigator){
  window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
}
