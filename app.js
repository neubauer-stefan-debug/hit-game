
const $ = (s, el=document) => el.querySelector(s);
const $$ = (s, el=document) => [...el.querySelectorAll(s)];

const state = {
  theme: localStorage.getItem("hit_theme") || "boy",
  skin: localStorage.getItem("hit_skin") || "classic",
  unlockedLevel: Number(localStorage.getItem("hit_unlockedLevel") || 1),
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
  {id:"neon", name:"Neon", unlock:1, preview:"◉"},
  {id:"mini", name:"Tiny", unlock:3, preview:"•"},
  {id:"poop", name:"💩", unlock:5, preview:"💩"},
  {id:"goat", name:"GOAT", unlock:10, preview:"🐐"}
];

const nickPool = ["Ace","Nova","Pixel","Echo","Jinx","Ghost"];

const levelTargets = [2.0, 3.4, 5.0, 7.2, 4.6, 8.8, 6.3, 10.0, 12.7, 15.5];
const levelLimits  = [1.0, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1];

function fmt(n){ return Number(n).toFixed(2).replace(".", ","); }
function signed(n){
  if (Math.abs(n) < 0.005) return "±0,00";
  return `${n>0?"+":"−"}${fmt(Math.abs(n))}`;
}
function randomTarget(){
  const tenth = Math.floor(Math.random() * (155 - 16 + 1)) + 16;
  return tenth / 10;
}
function escapeHtml(str=""){
  return str.replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));
}
function commentFor(absDiff){
  const pools = [
    [0.001, ["Exakt. Mehr geht nicht.","Null Abweichung. Das ist absurd gut.","Perfekt getroffen. Respekt."]],
    [0.03, ["Unverschämt präzise.","Das war richtig stark.","So sieht Timing aus."]],
    [0.08, ["Sehr stark. Fast perfekt.","Sauber getroffen.","Das sitzt."]],
    [0.15, ["Knapp am Perfekten.","Starkes Timing.","Da war kaum Luft dazwischen."]],
    [0.30, ["Sauber. Da ist Druck drauf.","Guter Hit.","Stabil. Noch etwas Feinschliff."]],
    [0.50, ["Solide. Aber da geht noch was.","Nicht schlecht. Nächster Versuch wird enger.","Ordentlich. Noch nicht gefährlich gut."]],
    [1.00, ["Noch im Spiel. Fokus.","Okay. Aber die Bestenliste zittert noch nicht.","War drin. War aber nicht knapp."]],
    [1.50, ["Das war eher Gefühl als Timing.","Uff. Da fehlen ein paar Hundertstel. Und noch ein paar.","Der Moment war da. Du nur etwas später."]],
    [2.50, ["Der Button war übrigens ziemlich groß.","Wir nennen das kreative Zeitrechnung.","Das war mutig. Präzise war’s nicht."]],
    [Infinity, ["Komplett eigene Zeitzone.","Das war kein Hit. Das war ein Ausflug.","Starkes Selbstvertrauen. Fragwürdiges Timing."]]
  ];
  for(const [limit, list] of pools){
    if(absDiff <= limit) return list[Math.floor(Math.random()*list.length)];
  }
}
function setTheme(theme){
  state.theme = theme;
  document.body.dataset.theme = theme;
  localStorage.setItem("hit_theme", theme);
}
function availableSkin(id){
  const s = skins.find(x=>x.id===id);
  return s && state.unlockedLevel >= s.unlock;
}
function setSkin(id){
  if(!availableSkin(id)) return;
  state.skin = id;
  localStorage.setItem("hit_skin", id);
}
function renderSkinGrid(){
  const grid = $("#skinGrid");
  if(!grid) return;
  grid.innerHTML = skins.map(s=>{
    const locked = state.unlockedLevel < s.unlock;
    return `<button class="skin-card ${state.skin===s.id?"active":""}" data-skin="${s.id}" ${locked?"disabled":""}>
      ${locked?`<span class="lock">🔒 L${s.unlock}</span>`:""}
      <div class="skin-preview" style="font-size:${s.id==="mini"?"28":"42"}px">${s.preview}</div>
      <div class="skin-name">${s.name}</div>
    </button>`;
  }).join("");
  $("#unlockHint").textContent = state.unlockedLevel >= 10 ? "Alle Buttons freigeschaltet" : `Bis Level ${state.unlockedLevel} freigeschaltet`;
  $$(".skin-card").forEach(b=>b.addEventListener("click",()=>{setSkin(b.dataset.skin); renderSkinGrid();}));
}
function renderHome(){
  stopTimer();
  state.mode = null;
  $("#homeBtn").classList.add("hidden");
  $("#screen").innerHTML = $("#home-template").innerHTML;
  setTheme(state.theme);
  $$(".theme-card").forEach(card=>{
    card.classList.toggle("active", card.dataset.themeChoice===state.theme);
    card.addEventListener("click",()=>{
      setTheme(card.dataset.themeChoice);
      $$(".theme-card").forEach(x=>x.classList.toggle("active",x===card));
    });
  });
  $$("[data-mode]").forEach(btn=>btn.addEventListener("click",()=>{
    state.mode = btn.dataset.mode;
    state.mode==="level" ? renderLevelIntro() : renderPartySetup();
  }));
  renderSkinGrid();
}
function renderPartySetup(){
  $("#homeBtn").classList.remove("hidden");
  $("#screen").innerHTML = `
    <h1 class="screen-title">HIT! ROUND</h1>
    <p class="screen-sub">Gleiche Zeit für alle. Danach zählt nur die kleinste Abweichung.</p>

    <div class="setup-grid">
      <section class="panel">
        <h2>Wie viele spielen?</h2>
        <div class="choice-row" id="countChoices">
          ${[1,2,3,4,5,6].map(n=>`<button class="choice ${state.playerCount===n?"active":""}" data-count="${n}">${n}</button>`).join("")}
        </div>
      </section>

      <section class="panel">
        <h2>Zielzeit</h2>
        <div class="choice-row" id="targetChoices">
          ${["2","3","5","10"].map(v=>`<button class="choice ${state.targetMode===v?"active":""}" data-target="${v}">${v} s</button>`).join("")}
          <button class="choice ${state.targetMode==="random"?"active":""}" data-target="random">ZUFALL</button>
          <button class="choice ${state.targetMode==="free"?"active":""}" data-target="free">FREI</button>
        </div>
        <div id="freeWrap" style="margin-top:12px;${state.targetMode==="free"?"":"display:none"}">
          <label class="muted">Freie Zielzeit ab 1,50 s</label>
          <input id="freeTarget" class="input" type="number" min="1.5" max="99.99" step="0.01" value="${state.freeTarget}">
        </div>
      </section>
    </div>

    <section class="panel">
      <h2>Spieler</h2>
      <div id="playerList" class="player-list"></div>
      <div class="actions">
        <button id="randomNames" class="secondary">NICKS MISCHEN</button>
      </div>
    </section>

    <div class="actions">
      <button id="startParty" class="primary">RUNDE STARTEN →</button>
    </div>
  `;
  bindPartySetup();
}
function renderPlayers(){
  const list = $("#playerList");
  const current = state.players.slice(0,state.playerCount);
  while(current.length < state.playerCount) current.push(nickPool[current.length] || `Player ${current.length+1}`);
  state.players = current;
  list.innerHTML = current.map((n,i)=>`<input class="input playerName" data-i="${i}" maxlength="16" value="${escapeHtml(n)}" placeholder="Player ${i+1}">`).join("");
}
function bindPartySetup(){
  renderPlayers();
  $$("[data-count]").forEach(b=>b.addEventListener("click",()=>{
    state.playerCount = Number(b.dataset.count);
    $$("[data-count]").forEach(x=>x.classList.toggle("active",x===b));
    renderPlayers();
  }));
  $$("[data-target]").forEach(b=>b.addEventListener("click",()=>{
    state.targetMode = b.dataset.target;
    $$("[data-target]").forEach(x=>x.classList.toggle("active",x===b));
    $("#freeWrap").style.display = state.targetMode==="free"?"block":"none";
  }));
  $("#randomNames").addEventListener("click",()=>{
    const shuffled = [...nickPool].sort(()=>Math.random()-.5);
    state.players = shuffled.slice(0,state.playerCount);
    renderPlayers();
  });
  $("#startParty").addEventListener("click",()=>{
    state.players = $$(".playerName").map((el,i)=>el.value.trim() || `Player ${i+1}`);
    if(state.targetMode==="random") state.target = randomTarget();
    else if(state.targetMode==="free"){
      const v = Number($("#freeTarget").value);
      state.target = Math.max(1.5, Math.min(99.99, Number.isFinite(v)?v:5));
      state.freeTarget = state.target;
    } else state.target = Number(state.targetMode);
    state.currentPlayer = 0;
    state.roundResults = [];
    renderGame();
  });
}
function renderGame(){
  stopTimer();
  state.started = false;
  const name = state.mode==="level" ? `LEVEL ${state.level}` : state.players[state.currentPlayer];
  const target = state.mode==="level" ? state.levelTarget : state.target;
  const levelBar = state.mode==="level" ? `
    <div class="level-track">${Array.from({length:10},(_,i)=>`<span class="level-dot ${i+1<state.level?"done":i+1===state.level?"current":""}"></span>`).join("")}</div>
    <div class="level-rule">Weiter bei ≤ ${fmt(levelLimits[state.level-1])} s Abweichung</div>` : "";
  $("#screen").innerHTML = `
    <section class="game-wrap">
      <div class="game-meta">
        <span class="pill">${escapeHtml(name)}</span>
        ${state.mode==="party"?`<span class="pill">${state.currentPlayer+1} / ${state.playerCount}</span>`:""}
      </div>
      ${levelBar}
      <div class="target-label">TARGET</div>
      <div class="target">${fmt(target)} s</div>
      <div id="timer" class="timer">0,00</div>
      <div class="buzzer-wrap">
        <button id="buzzer" class="buzzer ${state.skin}" aria-label="Start oder Stopp">
          ${state.skin==="poop"?"💩":state.skin==="goat"?"🐐":'<span id="buzzerLabel" class="buzzer-label">START</span>'}
        </button>
      </div>
      <div id="statusLine" class="status-line">Erster Tap startet. Zweiter Tap stoppt.</div>
    </section>`;
  const buzzer = $("#buzzer");
  buzzer.addEventListener("pointerdown", e=>{
    e.preventDefault();
    state.started ? finishHit() : startHit();
  }, {passive:false});
}
function startHit(){
  state.started = true;
  state.startTime = performance.now();
  const lab = $("#buzzerLabel"); if(lab) lab.textContent = "HIT!";
  $("#statusLine").textContent = "Jetzt zählt dein Timing.";
  const tick = ()=>{
    if(!state.started) return;
    const elapsed = (performance.now()-state.startTime)/1000;
    $("#timer").textContent = fmt(elapsed);
    state.raf = requestAnimationFrame(tick);
  };
  state.raf = requestAnimationFrame(tick);
}
function stopTimer(){
  state.started = false;
  if(state.raf) cancelAnimationFrame(state.raf);
  state.raf = null;
}
function finishHit(){
  const elapsed = (performance.now()-state.startTime)/1000;
  stopTimer();
  const result = Math.round(elapsed*100)/100;
  const target = state.mode==="level" ? state.levelTarget : state.target;
  const diff = Math.round((result-target)*100)/100;
  const absDiff = Math.abs(diff);
  if(state.mode==="level"){
    renderLevelResult(result,diff,absDiff);
  }else{
    state.roundResults.push({name:state.players[state.currentPlayer], target, result, diff, absDiff});
    renderPartyResult(result,diff,absDiff);
  }
}
function renderPartyResult(result,diff,absDiff){
  $("#screen").innerHTML = `
    <section class="panel result-card">
      <div class="target-label">${escapeHtml(state.players[state.currentPlayer])}</div>
      <div class="result-big">${fmt(result)}</div>
      <div class="result-diff">${signed(diff)} s</div>
      <div class="result-comment">${commentFor(absDiff)}</div>
      <div class="result-detail">Ziel: ${fmt(state.target)} s · Abweichung: ${fmt(absDiff)} s</div>
      <div class="actions" style="justify-content:center">
        <button id="nextPlayer" class="primary">${state.currentPlayer+1<state.playerCount?"NÄCHSTER →":"AUSWERTUNG →"}</button>
      </div>
    </section>`;
  $("#nextPlayer").addEventListener("click",()=>{
    state.currentPlayer++;
    state.currentPlayer < state.playerCount ? renderGame() : finishRound();
  });
}
function finishRound(){
  const ranked = [...state.roundResults].sort((a,b)=>a.absDiff-b.absDiff);
  saveScores(ranked);
  $("#screen").innerHTML = `
    <h1 class="screen-title">RUNDE DURCH.</h1>
    <p class="screen-sub">Zielzeit: ${fmt(state.target)} s</p>
    <section class="panel">
      <div class="ranking">
        ${ranked.map((r,i)=>`
          <div class="rank-row">
            <div class="rank-pos">${i+1}.</div>
            <div class="rank-name">${escapeHtml(r.name)} ${i===0?'<span class="badge">BEST HIT</span>':i===ranked.length-1 && ranked.length>1?'<span class="badge">NEEDS WORK</span>':""}</div>
            <div class="rank-score">${fmt(r.result)} s<br><span class="muted">${signed(r.diff)} s</span></div>
          </div>`).join("")}
      </div>
    </section>
    <section class="panel result-card">
      <div class="result-comment">${escapeHtml(ranked[0].name)} holt die Runde.</div>
      <div class="result-detail">${fmt(ranked[0].absDiff)} s Abweichung. ${ranked.length>1?`${escapeHtml(ranked[ranked.length-1].name)} hat noch Luft nach oben.`:""}</div>
    </section>
    <div class="actions">
      <button id="again" class="primary">NOCHMAL</button>
      <button id="menu" class="secondary">HAUPTMENÜ</button>
    </div>`;
  $("#again").addEventListener("click",()=>{
    state.currentPlayer=0; state.roundResults=[];
    if(state.targetMode==="random") state.target=randomTarget();
    renderGame();
  });
  $("#menu").addEventListener("click",renderHome);
}
function saveScores(results){
  const old = JSON.parse(localStorage.getItem("hit_scores") || "[]");
  const now = new Date();
  const entries = results.map(r=>({
    name:r.name,target:r.target,result:r.result,diff:r.diff,absDiff:r.absDiff,
    ts:now.toISOString()
  }));
  const merged = [...old,...entries].sort((a,b)=>a.absDiff-b.absDiff).slice(0,30);
  localStorage.setItem("hit_scores",JSON.stringify(merged));
}
function renderScores(){
  $("#homeBtn").classList.remove("hidden");
  const scores = JSON.parse(localStorage.getItem("hit_scores") || "[]");
  $("#screen").innerHTML = `
    <h1 class="screen-title">HIGHSCORES</h1>
    <p class="screen-sub">V1: lokal auf diesem Gerät. Online-Ranking kommt mit Firebase.</p>
    <section class="panel">
      ${scores.length?`<div class="score-table">${scores.map((s,i)=>{
        const d=new Date(s.ts);
        return `<div class="score-row">
          <strong>${i+1}.</strong>
          <div><strong>${escapeHtml(s.name)}</strong><br><span class="muted">Target ${fmt(s.target)} · Hit ${fmt(s.result)}</span></div>
          <strong>${fmt(s.absDiff)} s</strong>
          <span class="score-date muted">${d.toLocaleDateString("de-DE")}</span>
        </div>`
      }).join("")}</div>`:`<div class="empty">Noch kein Highscore. Erst spielen, dann angeben.</div>`}
    </section>
    <div class="actions"><button id="clearScores" class="secondary">LOKALE HIGHSCORES LÖSCHEN</button></div>`;
  $("#clearScores").addEventListener("click",()=>{
    if(confirm("Lokale Highscores wirklich löschen?")){
      localStorage.removeItem("hit_scores"); renderScores();
    }
  });
}
function renderLevelIntro(){
  $("#homeBtn").classList.remove("hidden");
  $("#screen").innerHTML = `
    <h1 class="screen-title">LEVEL RUN</h1>
    <p class="screen-sub">10 Level. Jeder Fehler zählt. Schaffst du die Grenze, geht’s weiter.</p>
    <section class="panel">
      <div class="ranking">
        ${levelLimits.map((limit,i)=>`
          <div class="rank-row">
            <div class="rank-pos">${i+1}</div>
            <div class="rank-name">Level ${i+1}${[3,5,10].includes(i+1)?` <span class="badge">UNLOCK</span>`:""}</div>
            <div class="rank-score">≤ ${fmt(limit)} s</div>
          </div>`).join("")}
      </div>
    </section>
    <section class="panel">
      <p class="screen-sub" style="margin:0">Level 10 verlangt maximal 0,10 s Abweichung. Triffst du dort exakt 0,00 s, gibt’s den perfekten GOAT-Finish.</p>
    </section>
    <div class="actions"><button id="startLevel" class="primary">LEVEL 1 STARTEN →</button></div>`;
  $("#startLevel").addEventListener("click",()=>{
    state.level=1;
    state.levelTarget=levelTargets[0];
    renderGame();
  });
}
function renderLevelResult(result,diff,absDiff){
  const limit = levelLimits[state.level-1];
  const passed = absDiff <= limit + 0.0001;
  let unlockText = "";
  if(passed){
    const prev = state.unlockedLevel;
    state.unlockedLevel = Math.max(state.unlockedLevel,state.level);
    localStorage.setItem("hit_unlockedLevel",state.unlockedLevel);
    if(state.unlockedLevel > prev){
      const newly = skins.filter(s=>s.unlock===state.unlockedLevel);
      if(newly.length) unlockText = `Freigeschaltet: ${newly.map(x=>x.name).join(", ")}`;
    }
  }
  const exactGoat = state.level===10 && absDiff===0;
  $("#screen").innerHTML = `
    <section class="panel result-card">
      <div class="target-label">LEVEL ${state.level}</div>
      <div class="result-big">${fmt(result)}</div>
      <div class="result-diff">${signed(diff)} s</div>
      <div class="result-comment">${passed ? (exactGoat?"PERFEKT. GOAT STATUS.":commentFor(absDiff)) : "Noch nicht. Dasselbe Level nochmal."}</div>
      <div class="result-detail">Ziel: ${fmt(state.levelTarget)} s · Grenze: ≤ ${fmt(limit)} s · Abweichung: ${fmt(absDiff)} s</div>
      ${unlockText?`<div class="unlock-toast">${unlockText}</div>`:""}
      <div class="actions" style="justify-content:center">
        <button id="levelNext" class="primary">${passed?(state.level===10?"FINISH →":"NÄCHSTES LEVEL →"):"NOCHMAL →"}</button>
      </div>
    </section>`;
  $("#levelNext").addEventListener("click",()=>{
    if(!passed){ renderGame(); return; }
    if(state.level===10){ renderLevelFinish(exactGoat); return; }
    state.level++;
    state.levelTarget=levelTargets[state.level-1];
    renderGame();
  });
}
function renderLevelFinish(exact){
  state.unlockedLevel = Math.max(state.unlockedLevel,10);
  localStorage.setItem("hit_unlockedLevel",state.unlockedLevel);
  $("#screen").innerHTML = `
    <section class="panel result-card">
      <div class="target-label">LEVEL RUN COMPLETE</div>
      <div class="result-big">${exact?"🐐":"10/10"}</div>
      <div class="result-comment">${exact?"Exakt im letzten Level. Das ist GOAT.":"Run geschafft. Alle 10 Level durch."}</div>
      <div class="result-detail">${exact?"0,00 s Abweichung im Finale. Mehr geht nicht.":"Der GOAT-Finish wartet noch: Level 10 exakt treffen."}</div>
      <div class="unlock-toast">GOAT-Button freigeschaltet.</div>
      <div class="actions" style="justify-content:center">
        <button id="runAgain" class="primary">NOCH EIN RUN</button>
        <button id="finishMenu" class="secondary">HAUPTMENÜ</button>
      </div>
    </section>`;
  $("#runAgain").addEventListener("click",renderLevelIntro);
  $("#finishMenu").addEventListener("click",renderHome);
}

$("#homeBtn").addEventListener("click",renderHome);
$("#scoreBtn").addEventListener("click",renderScores);

setTheme(state.theme);
renderHome();

if("serviceWorker" in navigator){
  window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
}
