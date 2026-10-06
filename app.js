
const $ = (s, el=document) => el.querySelector(s);
const $$ = (s, el=document) => [...el.querySelectorAll(s)];

const THEME_NAMES = {
  boy: "BOY · Electric Manga",
  girl: "GIRL · Neo Manga",
  machine: "MACHINE · Grid Core",
  football: "FOOTBALL · Night Match"
};

const CLOCK_NAMES = {
  clean: "Clock · Clean",
  digital: "Clock · Digital",
  arcade: "Clock · Arcade",
  analog: "Clock · Analog"
};

const SOUND_NAMES = {
  off: "Sound · Off",
  pulse: "Sound · Pulse 1s",
  focus: "Sound · Focus 0.5s",
  target: "Sound · Accelerate to target"
};

const state = {
  theme: localStorage.getItem("hit_theme_v3") || "boy",
  skin: localStorage.getItem("hit_skin_v3") || "classic",
  clockStyle: localStorage.getItem("hit_clock_v3") || "clean",
  soundMode: localStorage.getItem("hit_sound_v3") || "off",
  unlockedLevel: Number(localStorage.getItem("hit_unlocked_v3") || 1),
  mode: null,
  playerCount: 2,
  players: [],
  targetMode: "5",
  freeTarget: 4.20,
  target: 5,
  currentPlayer: 0,
  roundResults: [],
  level: 1,
  levelTarget: 0,
  started: false,
  startTime: 0,
  raf: null,
  soundTimer: null,
  audioCtx: null
};

const skins = [
  {id:"classic", name:"Classic Red", unlock:1, preview:"🔴"},
  {id:"neon", name:"Neon Core", unlock:3, preview:"◉"},
  {id:"tiny", name:"Tiny Hit", unlock:5, preview:"•"},
  {id:"football", name:"Football", unlock:8, preview:"⚽"},
  {id:"flower", name:"Flower", unlock:12, preview:"🌸"},
  {id:"poop", name:"Seriously?", unlock:18, preview:"💩"},
  {id:"unicorn", name:"Unicorn", unlock:25, preview:"🦄"},
  {id:"teddy", name:"Soft Mode", unlock:35, preview:"🧸"},
  {id:"cup", name:"Champions Cup", unlock:50, preview:"🏆"},
  {id:"meteor", name:"Meteor", unlock:65, preview:"☄️"},
  {id:"ice", name:"Ice", unlock:80, preview:"🧊"},
  {id:"star", name:"Star Burst", unlock:90, preview:"⭐"},
  {id:"goat", name:"GOAT", unlock:100, preview:"🐐"}
];

const nickPool = ["Ace","Nova","Pixel","Echo","Jinx","Ghost","Rookie","Turbo","Zero","Vibe","Flash","Nox"];

function fmt(n){ return Number(n).toFixed(2).replace(".", ","); }
function signed(n){ return Math.abs(n) < 0.005 ? "±0,00" : `${n>0?"+":"−"}${fmt(Math.abs(n))}`; }
function escapeHtml(str=""){ return str.replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c])); }
function randomTarget(){ return (Math.floor(Math.random()*(155-16+1))+16)/10; }
function levelTarget(level){
  // 1..100 => 1,6 .. 15,5 in Wellen + leichter Progress
  const wave = [1.6,2.0,2.4,2.8,3.2,3.7,4.1,4.6,5.0,5.4,5.8,6.3,6.7,7.1,7.6,8.0,8.4,8.9,9.3,9.8,10.2,10.7,11.1,11.6,12.0,12.5,12.9,13.4,13.8,14.3,14.7,15.5];
  return wave[(level-1) % wave.length];
}
function levelLimit(level){
  // von 0,50 auf 0,03 fallend
  const t = (level-1)/99;
  const value = 0.50 - t*(0.47);
  return Math.max(0.03, Math.round(value*100)/100);
}
function commentFor(absDiff){
  const pools = [
    [0.001, ["Exakt. Mehr geht nicht.","Null Abweichung. Respekt.","Perfekt getroffen."]],
    [0.03, ["Unverschämt präzise.","Timing auf Anschlag.","Das war richtig stark."]],
    [0.06, ["Sehr stark. Fast perfekt.","Sauber getroffen.","Das sitzt."]],
    [0.10, ["Richtig eng. Stark.","Kaum Luft dazwischen.","Sehr sauber."]],
    [0.18, ["Starkes Timing.","Knapp. Und zwar richtig.","Das kann sich sehen lassen."]],
    [0.30, ["Guter Hit.","Solide unter Druck.","Sauber. Noch etwas Feinschliff."]],
    [0.50, ["Ordentlich. Aber noch kein Flex.","Solide. Nächster wird enger.","Gut drin. Noch nicht gefährlich gut."]],
    [0.80, ["Noch okay. Fokus.","War drin. Aber nicht knapp.","Da geht mehr."]],
    [1.20, ["Das war eher Gefühl als Timing.","Der Moment war da. Du etwas später.","Uff. Nicht dein bester Hit."]],
    [2.00, ["Der Button war übrigens ziemlich groß.","Mutig. Präzise eher nicht.","Das war kreative Zeitrechnung."]],
    [Infinity, ["Komplett eigene Zeitzone.","Das war kein Hit. Das war ein Ausflug.","Starkes Selbstvertrauen. Fragwürdiges Timing."]]
  ];
  for (const [limit,list] of pools) if (absDiff <= limit) return list[Math.floor(Math.random()*list.length)];
}
function setTheme(theme){ state.theme=theme; document.body.dataset.theme=theme; localStorage.setItem("hit_theme_v3",theme); }
function setClockStyle(style){ state.clockStyle=style; document.body.dataset.clock=style; localStorage.setItem("hit_clock_v3",style); }
function setSoundMode(mode){ state.soundMode=mode; localStorage.setItem("hit_sound_v3",mode); }
function availableSkin(id){ const s=skins.find(x=>x.id===id); return !!s && state.unlockedLevel >= s.unlock; }
function setSkin(id){ if(availableSkin(id)){ state.skin=id; localStorage.setItem("hit_skin_v3",id); } }
function updateUnlock(level){ const before=state.unlockedLevel; state.unlockedLevel=Math.max(state.unlockedLevel,level); localStorage.setItem("hit_unlocked_v3",state.unlockedLevel); return state.unlockedLevel>before; }

function stopTimer(){
  state.started=false;
  if(state.raf) cancelAnimationFrame(state.raf);
  state.raf=null;
  if(state.soundTimer){ clearTimeout(state.soundTimer); state.soundTimer=null; }
}

function animateMeter(absDiff,max=1){
  const el=$("#meterFill"); if(!el) return;
  const pct=Math.max(4,100-(Math.min(absDiff,max)/max)*100);
  requestAnimationFrame(()=>el.style.width=`${pct}%`);
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

function ensureAudio(){
  if(!state.audioCtx){
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if(Ctx) state.audioCtx = new Ctx();
  }
  if(state.audioCtx?.state === "suspended") state.audioCtx.resume();
}
function beep(freq=660,dur=0.05,type="sine",gain=0.03){
  try{
    ensureAudio();
    if(!state.audioCtx) return;
    const ctx=state.audioCtx;
    const osc=ctx.createOscillator();
    const g=ctx.createGain();
    osc.type=type;
    osc.frequency.value=freq;
    g.gain.value=gain;
    osc.connect(g); g.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  }catch(e){}
}
function scheduleSoundLoop(target){
  if(state.soundMode==="off") return;
  const loop = ()=>{
    if(!state.started) return;
    const elapsed = (performance.now() - state.startTime)/1000;
    let interval = 1000;
    let freq = 700;
    let type = "sine";
    if(state.soundMode==="focus"){ interval = 500; freq = 620; type="triangle"; }
    if(state.soundMode==="target"){
      const remain = Math.max(0, target - elapsed);
      if(remain > 4){ interval=900; freq=520; }
      else if(remain > 2){ interval=550; freq=640; }
      else if(remain > 1){ interval=320; freq=760; }
      else if(remain > 0.5){ interval=180; freq=920; }
      else { interval=110; freq=1040; }
      type = "square";
    }
    beep(freq, 0.045, type, 0.035);
    state.soundTimer = setTimeout(loop, interval);
  };
  loop();
}

function renderHome(){
  stopTimer();
  state.mode=null;
  $("#homeBtn").classList.add("hidden");
  $("#screen").innerHTML = $("#home-template").innerHTML;
  setTheme(state.theme);
  setClockStyle(state.clockStyle);
  $("#currentThemeTag").textContent = THEME_NAMES[state.theme];
  $("#currentClockTag").textContent = CLOCK_NAMES[state.clockStyle];
  $("#currentSoundTag").textContent = SOUND_NAMES[state.soundMode];
  $("#homeProgress").textContent = `Level ${state.unlockedLevel} freigeschaltet`;
  $("#homeStatus").textContent = HitScores.provider === "firebase" ? "Online aktiv" : "Offline / Fallback";
  $$("[data-mode]").forEach(btn => btn.addEventListener("click", ()=>{
    state.mode = btn.dataset.mode;
    state.mode === "level" ? renderLevelIntro() : renderPartySetup();
  }));
}

function renderSettings(){
  stopTimer();
  $("#homeBtn").classList.remove("hidden");
  $("#screen").innerHTML = `
    <h1 class="screen-title">SETTINGS</h1>
    <p class="screen-sub">Theme, Uhr und Sound ändern das Gefühl – die Messung bleibt identisch.</p>

    <section class="panel">
      <div class="panel-head"><h2>Style</h2><span class="muted">deutlich unterschiedliche Welten</span></div>
      <div class="settings-grid">
        <button class="theme-card ${state.theme==="boy"?"active":""}" data-theme-choice="boy"><span class="theme-symbol">⚡</span><strong>BOY</strong><small>electric manga · blau · sharp</small></button>
        <button class="theme-card ${state.theme==="girl"?"active":""}" data-theme-choice="girl"><span class="theme-symbol">✦</span><strong>GIRL</strong><small>neo manga · pink · glossy</small></button>
        <button class="theme-card ${state.theme==="machine"?"active":""}" data-theme-choice="machine"><span class="theme-symbol">⌁</span><strong>MACHINE</strong><small>grid core · cyan · terminal</small></button>
        <button class="theme-card ${state.theme==="football"?"active":""}" data-theme-choice="football"><span class="theme-symbol">⚽</span><strong>FOOTBALL</strong><small>stadium · pitch · night match</small></button>
      </div>
    </section>

    <section class="panel">
      <div class="panel-head"><h2>Button</h2><span class="muted">freigeschaltet bis Level ${state.unlockedLevel}</span></div>
      <div id="skinGrid" class="skin-grid"></div>
    </section>

    <section class="panel">
      <div class="panel-head"><h2>Uhr-Design</h2><span class="muted">App-Look / Digital / Arcade / Analog</span></div>
      <div class="clock-grid">
        <button class="clock-card ${state.clockStyle==="clean"?"active":""}" data-clock-choice="clean"><div class="clock-preview">00,00</div><div class="clock-name">Clean</div></button>
        <button class="clock-card ${state.clockStyle==="digital"?"active":""}" data-clock-choice="digital"><div class="clock-preview">88:88</div><div class="clock-name">Digital</div></button>
        <button class="clock-card ${state.clockStyle==="arcade"?"active":""}" data-clock-choice="arcade"><div class="clock-preview">◢</div><div class="clock-name">Arcade</div></button>
        <button class="clock-card ${state.clockStyle==="analog"?"active":""}" data-clock-choice="analog"><div class="clock-preview">🕘</div><div class="clock-name">Analog</div></button>
      </div>
    </section>

    <section class="panel">
      <div class="panel-head"><h2>Sound-Hilfe</h2><span class="muted">für Rhythmus und Timing</span></div>
      <div class="sound-grid">
        <button class="sound-card ${state.soundMode==="off"?"active":""}" data-sound-choice="off"><div class="sound-preview">🔇</div><div class="sound-name">Off</div></button>
        <button class="sound-card ${state.soundMode==="pulse"?"active":""}" data-sound-choice="pulse"><div class="sound-preview">• • •</div><div class="sound-name">Pulse 1s</div></button>
        <button class="sound-card ${state.soundMode==="focus"?"active":""}" data-sound-choice="focus"><div class="sound-preview">• • • •</div><div class="sound-name">Focus 0.5s</div></button>
        <button class="sound-card ${state.soundMode==="target"?"active":""}" data-sound-choice="target"><div class="sound-preview">↗</div><div class="sound-name">Near Target</div></button>
      </div>
    </section>

    <div class="actions"><button id="settingsDone" class="primary">FERTIG</button></div>
  `;
  renderSkinGrid();
  $$("[data-theme-choice]").forEach(card=>card.addEventListener("click",()=>{
    setTheme(card.dataset.themeChoice);
    $$("[data-theme-choice]").forEach(x=>x.classList.toggle("active",x===card));
  }));
  $$("[data-clock-choice]").forEach(card=>card.addEventListener("click",()=>{
    setClockStyle(card.dataset.clockChoice);
    $$("[data-clock-choice]").forEach(x=>x.classList.toggle("active",x===card));
  }));
  $$("[data-sound-choice]").forEach(card=>card.addEventListener("click",()=>{
    setSoundMode(card.dataset.soundChoice);
    $$("[data-sound-choice]").forEach(x=>x.classList.toggle("active",x===card));
    beep(740,0.04,"sine",0.025);
  }));
  $("#settingsDone").addEventListener("click",renderHome);
}

function renderSkinGrid(){
  const grid = $("#skinGrid"); if(!grid) return;
  grid.innerHTML = skins.map(s=>{
    const locked = state.unlockedLevel < s.unlock;
    return `<button class="skin-card ${state.skin===s.id?"active":""}" data-skin="${s.id}" ${locked?"disabled":""}>
      ${locked?`<span class="lock">🔒 L${s.unlock}</span>`:""}
      <div class="skin-preview">${s.preview}</div>
      <div class="skin-name">${s.name}</div>
    </button>`;
  }).join("");
  $$(".skin-card").forEach(b=>b.addEventListener("click",()=>{ setSkin(b.dataset.skin); renderSkinGrid(); }));
}

function renderPartySetup(){
  $("#homeBtn").classList.remove("hidden");
  $("#screen").innerHTML = `
    <h1 class="screen-title">HIT! ROUND</h1>
    <p class="screen-sub">Gleiche Zielzeit für alle. Die kleinste Abweichung gewinnt.</p>
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
    $("#freeWrap").style.display = state.targetMode==="free" ? "block" : "none";
  }));
  $("#randomNames").addEventListener("click",()=>{
    state.players = [...nickPool].sort(()=>Math.random()-.5).slice(0,state.playerCount);
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

function timerMarkup(){
  if(state.clockStyle !== "analog") return `<div id="timer" class="timer">0,00<small>s</small></div>`;
  return `
    <div id="timer" class="timer">0,00<small>s</small></div>
    <div class="analog-face" id="analogFace">
      ${Array.from({length:12}, (_,i)=>`<span class="tick" style="transform:translate(-50%,-100%) rotate(${i*30}deg)"></span>`).join("")}
      <span class="analog-hand analog-minor" id="analogMinute"></span>
      <span class="analog-hand analog-sec" id="analogSecond"></span>
      <span class="analog-center"></span>
    </div>
    <div class="analog-label" id="analogLabel">0,00 s</div>
  `;
}
function buzzerInner(){
  const map = {football:"⚽", flower:"🌸", unicorn:"🦄", teddy:"🧸", cup:"🏆", poop:"💩", goat:"🐐", meteor:"☄️", ice:"🧊", star:"⭐"};
  return map[state.skin] || '<span id="buzzerLabel" class="buzzer-label">START</span>';
}
function renderGame(){
  stopTimer();
  state.started = false;
  const name = state.mode==="level" ? `LEVEL ${state.level}` : state.players[state.currentPlayer];
  const target = state.mode==="level" ? state.levelTarget : state.target;
  const block = state.mode==="level" ? Math.ceil(state.level/10);
  const blockStart = (block-1)*10+1;
  const levelBar = state.mode==="level" ? `
    <div class="level-track">${Array.from({length:10}, (_,i)=>{
      const lv = blockStart + i;
      const klass = lv < state.level ? "done" : lv===state.level ? "current" : "";
      return `<span class="level-dot ${klass}"></span>`;
    }).join("")}</div>
    <div class="level-rule">Level ${state.level}/100 · Block ${block}/10 · Weiter bei ≤ ${fmt(levelLimit(state.level))} s</div>` : "";
  $("#screen").innerHTML = `
    <section class="game-wrap">
      <div class="game-meta">
        <span class="pill">${escapeHtml(name)}</span>
        ${state.mode==="party"?`<span class="pill">${state.currentPlayer+1} / ${state.playerCount}</span>`:""}
        <span class="pill">${CLOCK_NAMES[state.clockStyle]}</span>
      </div>
      ${levelBar}
      <div class="target-label">TARGET</div>
      <div class="target">${fmt(target)} s</div>
      <div class="timer-box">${timerMarkup()}</div>
      <div class="buzzer-wrap">
        <button id="buzzer" class="buzzer ${state.skin}" aria-label="Start oder Stopp">${buzzerInner()}</button>
      </div>
      <div id="statusLine" class="status-line">Erster Tap startet. Zweiter Tap stoppt.</div>
    </section>
  `;
  $("#buzzer").addEventListener("pointerdown", e=>{
    e.preventDefault();
    state.started ? finishHit() : startHit();
  }, {passive:false});
}
function updateTimer(elapsed){
  const display = fmt(elapsed);
  const timer = $("#timer");
  if(state.clockStyle !== "analog"){
    if(timer) timer.innerHTML = `${display}<small>s</small>`;
  } else {
    const label = $("#analogLabel");
    if(label) label.textContent = `${display} s`;
    const sec = $("#analogSecond");
    const min = $("#analogMinute");
    if(sec) sec.style.transform = `translate(-50%,-92%) rotate(${elapsed*360}deg)`;
    if(min) min.style.transform = `translate(-50%,-92%) rotate(${elapsed*36}deg)`;
  }
}
function startHit(){
  state.started = true;
  state.startTime = performance.now();
  const label = $("#buzzerLabel"); if(label) label.textContent = "HIT!";
  $("#statusLine").textContent = "Jetzt zählt dein Timing.";
  const target = state.mode==="level" ? state.levelTarget : state.target;
  scheduleSoundLoop(target);
  const tick = ()=>{
    if(!state.started) return;
    const elapsed = (performance.now()-state.startTime)/1000;
    updateTimer(elapsed);
    state.raf = requestAnimationFrame(tick);
  };
  state.raf = requestAnimationFrame(tick);
}
function finishHit(){
  const elapsed = (performance.now()-state.startTime)/1000;
  stopTimer();
  const result = Math.round(elapsed*100)/100;
  const target = state.mode==="level" ? state.levelTarget : state.target;
  const diff = Math.round((result-target)*100)/100;
  const absDiff = Math.abs(diff);
  beep(1200,0.06,"triangle",0.045);
  if(state.mode==="level") renderLevelResult(result,diff,absDiff);
  else {
    state.roundResults.push({name:state.players[state.currentPlayer],target,result,diff,absDiff});
    renderPartyResult(result,diff,absDiff);
  }
}
function renderPartyResult(result,diff,absDiff){
  const label = state.currentPlayer+1 < state.playerCount ? "NÄCHSTER →" : "AUSWERTUNG →";
  $("#screen").innerHTML = `
    <section class="panel result-card">
      <div class="target-label">${escapeHtml(state.players[state.currentPlayer])}</div>
      <div class="result-big">${fmt(result)}</div>
      <div class="result-diff">${signed(diff)} s</div>
      <div class="result-comment">${commentFor(absDiff)}</div>
      <div class="result-detail">Ziel: ${fmt(state.target)} s · Abweichung: ${fmt(absDiff)} s</div>
      <div class="result-meter"><span id="meterFill"></span></div>
      <div class="actions" style="justify-content:center"><button id="resultNext" class="primary">${label}</button></div>
    </section>
  `;
  animateMeter(absDiff,1);
  const btn = $("#resultNext");
  lockNextButton(btn, 1500);
  btn.addEventListener("click",()=>{
    state.currentPlayer++;
    state.currentPlayer < state.playerCount ? renderGame() : finishRound();
  });
}
async function finishRound(){
  const ranked = [...state.roundResults].sort((a,b)=>a.absDiff-b.absDiff);
  await HitScores.save(ranked.map(r=>({...r, mode:"party", theme:state.theme, createdAt:new Date().toISOString()})));
  $("#screen").innerHTML = `
    <h1 class="screen-title">RUNDE DURCH.</h1>
    <p class="screen-sub">Zielzeit: ${fmt(state.target)} s</p>
    <section class="panel">
      <div class="ranking">
        ${ranked.map((r,i)=>`
          <div class="rank-row">
            <div class="rank-pos">${i+1}.</div>
            <div class="rank-name">${escapeHtml(r.name)} ${i===0?'<span class="badge">BEST HIT</span>':(i===ranked.length-1&&ranked.length>1?'<span class="badge">LAST</span>':"")}</div>
            <div class="rank-score">${fmt(r.result)} s<br><span class="muted">${signed(r.diff)} s</span></div>
          </div>`).join("")}
      </div>
    </section>
    <section class="panel result-card">
      <div class="result-comment">${escapeHtml(ranked[0].name)} holt die Runde.</div>
      <div class="result-detail">${fmt(ranked[0].absDiff)} s Abweichung.${ranked.length>1?` ${escapeHtml(ranked.at(-1).name)} hat für die Revanche noch Luft.`:""}</div>
    </section>
    <div class="actions">
      <button id="again" class="primary">NOCHMAL</button>
      <button id="menu" class="secondary">HAUPTMENÜ</button>
    </div>
  `;
  $("#again").addEventListener("click",()=>{
    state.currentPlayer=0; state.roundResults=[];
    if(state.targetMode==="random") state.target=randomTarget();
    renderGame();
  });
  $("#menu").addEventListener("click",renderHome);
}
function renderLevelIntro(){
  $("#homeBtn").classList.remove("hidden");
  $("#screen").innerHTML = `
    <h1 class="screen-title">LEVEL RUN</h1>
    <p class="screen-sub">100 Level. Die Zielzeiten wechseln, die Toleranz sinkt. Freischalten dauert jetzt deutlich länger.</p>
    <section class="panel">
      <div class="ranking">
        ${[1,10,20,30,40,50,60,70,80,90,100].map(lv=>`
          <div class="rank-row">
            <div class="rank-pos">${lv}</div>
            <div class="rank-name">Level ${lv}${skins.some(s=>s.unlock===lv)?' <span class="badge">UNLOCK</span>':""}</div>
            <div class="rank-score">${fmt(levelTarget(lv))} s<br><span class="muted">≤ ${fmt(levelLimit(lv))} s</span></div>
          </div>`).join("")}
      </div>
    </section>
    <div class="actions"><button id="startLevel" class="primary">LEVEL 1 STARTEN →</button></div>
  `;
  $("#startLevel").addEventListener("click",()=>{
    state.level = 1;
    state.levelTarget = levelTarget(1);
    renderGame();
  });
}
function renderLevelResult(result,diff,absDiff){
  const limit = levelLimit(state.level);
  const passed = absDiff <= limit + 0.0001;
  let unlockText = "";
  if(passed){
    const before = state.unlockedLevel;
    updateUnlock(state.level);
    if(state.unlockedLevel > before){
      const newly = skins.filter(s=>s.unlock===state.unlockedLevel);
      if(newly.length) unlockText = `Freigeschaltet: ${newly.map(x=>x.name).join(", ")}`;
    }
  }
  const exactGoat = state.level===100 && absDiff===0;
  $("#screen").innerHTML = `
    <section class="panel result-card">
      <div class="target-label">LEVEL ${state.level}</div>
      <div class="result-big">${fmt(result)}</div>
      <div class="result-diff">${signed(diff)} s</div>
      <div class="result-comment">${passed ? (exactGoat ? "0,00 im Finale. GOAT." : commentFor(absDiff)) : "Noch nicht. Dasselbe Level nochmal."}</div>
      <div class="result-detail">Ziel: ${fmt(state.levelTarget)} s · Grenze: ≤ ${fmt(limit)} s · Abweichung: ${fmt(absDiff)} s</div>
      <div class="result-meter"><span id="meterFill"></span></div>
      ${unlockText ? `<div class="unlock-toast">${unlockText}</div>` : ""}
      <div class="actions" style="justify-content:center"><button id="levelNext" class="primary">${passed ? (state.level===100 ? "FINISH →" : "NÄCHSTES LEVEL →") : "NOCHMAL →"}</button></div>
    </section>
  `;
  animateMeter(absDiff, Math.max(.6, limit*2));
  const btn = $("#levelNext");
  lockNextButton(btn, 1600);
  btn.addEventListener("click",()=>{
    if(!passed){ renderGame(); return; }
    if(state.level===100){ renderLevelFinish(exactGoat); return; }
    state.level++;
    state.levelTarget = levelTarget(state.level);
    renderGame();
  });
}
function renderLevelFinish(exact){
  updateUnlock(100);
  $("#screen").innerHTML = `
    <section class="panel result-card">
      <div class="target-label">LEVEL RUN COMPLETE</div>
      <div class="result-big">${exact ? "🐐" : "100/100"}</div>
      <div class="result-comment">${exact ? "Exakt im letzten Level. GOAT." : "Alle 100 Level geschafft."}</div>
      <div class="result-detail">${exact ? "Mehr Präzision geht nicht." : "Für GOAT-Status fehlt nur noch Level 100 mit 0,00."}</div>
      <div class="unlock-toast">GOAT-Button freigeschaltet.</div>
      <div class="actions" style="justify-content:center">
        <button id="runAgain" class="primary">NOCH EIN RUN</button>
        <button id="finishMenu" class="secondary">HAUPTMENÜ</button>
      </div>
    </section>
  `;
  $("#runAgain").addEventListener("click",renderLevelIntro);
  $("#finishMenu").addEventListener("click",renderHome);
}

async function renderScores(filter="all"){
  $("#homeBtn").classList.remove("hidden");
  const allScores = await HitScores.top(120);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday);
  const day = (startOfWeek.getDay()+6)%7;
  startOfWeek.setDate(startOfWeek.getDate()-day);

  const scores = allScores.filter(s=>{
    const d = new Date(s.createdAt);
    if(filter==="today") return d >= startOfToday;
    if(filter==="week") return d >= startOfWeek;
    return true;
  }).slice(0,40);

  const online = HitScores.provider === "firebase";
  $("#screen").innerHTML = `
    <h1 class="screen-title">HIGHSCORES</h1>
    <p class="screen-sub">${online ? "Gemeinsame Online-Bestenliste · nur HIT! ROUND" : "Offline-Modus · aktuell lokaler Fallback"}</p>
    <section class="panel">
      <div class="choice-row" style="margin-bottom:18px">
        <button class="choice ${filter==="all"?"active":""}" data-score-filter="all">ALL TIME</button>
        <button class="choice ${filter==="today"?"active":""}" data-score-filter="today">HEUTE</button>
        <button class="choice ${filter==="week"?"active":""}" data-score-filter="week">DIESE WOCHE</button>
      </div>
      ${scores.length ? `<div class="score-table">${scores.map((s,i)=>{
        const d = new Date(s.createdAt);
        return `<div class="score-row">
          <strong>${i+1}.</strong>
          <div><strong>${escapeHtml(s.name)}</strong><br><span class="muted">Target ${fmt(s.target)} · Hit ${fmt(s.result)}</span></div>
          <strong>${fmt(s.absDiff)} s</strong>
          <span class="score-date muted">${d.toLocaleDateString("de-DE")}</span>
        </div>`;
      }).join("")}</div>` : `<div class="empty">In diesem Zeitraum noch kein Highscore.</div>`}
    </section>
    <section class="panel"><div class="muted">${online ? "ONLINE · Firebase Firestore verbunden" : "OFFLINE · lokaler Fallback aktiv"}</div></section>
  `;
  $$("[data-score-filter]").forEach(btn=>btn.addEventListener("click",()=>renderScores(btn.dataset.scoreFilter)));
}

$("#homeBtn").addEventListener("click",renderHome);
$("#settingsBtn").addEventListener("click",renderSettings);
$("#scoreBtn").addEventListener("click",()=>renderScores("all"));

setTheme(state.theme);
setClockStyle(state.clockStyle);
if(!availableSkin(state.skin)) state.skin = "classic";
renderHome();

if("serviceWorker" in navigator){
  window.addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
}
