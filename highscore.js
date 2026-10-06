window.HitScores = (() => {
  const LOCAL_KEY = "hit_scores_v32";
  const cfg = window.HIT_FIREBASE_CONFIG;
  let provider = "connecting";
  let firebaseReady = false;
  let firestore = null;
  let f = null;

  const normalize = entry => ({
    name:String(entry.name || "Player").slice(0,20),
    target:Number(entry.target),result:Number(entry.result),diff:Number(entry.diff),
    absDiff:Math.abs(Number(entry.absDiff ?? entry.diff)),mode:"party",
    theme:entry.theme || "boy",createdAt:entry.createdAt || new Date().toISOString()
  });
  const local = () => { try{return JSON.parse(localStorage.getItem(LOCAL_KEY)||"[]")}catch{return[]} };
  const writeLocal = arr => localStorage.setItem(LOCAL_KEY,JSON.stringify(arr.sort((a,b)=>a.absDiff-b.absDiff).slice(0,150)));

  async function init(){
    if(!cfg){provider="local";return false;}
    try{
      const [{initializeApp},{getAuth,signInAnonymously},{getFirestore,collection,addDoc,getDocs,query,orderBy,limit}] = await Promise.all([
        import("https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js"),
        import("https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js"),
        import("https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js")
      ]);
      const app=initializeApp(cfg); const auth=getAuth(app); await signInAnonymously(auth);
      firestore=getFirestore(app); f={collection,addDoc,getDocs,query,orderBy,limit}; firebaseReady=true; provider="firebase"; return true;
    }catch(err){ console.warn("HIT Firebase fallback",err); provider="local"; firebaseReady=false; return false; }
  }
  const ready=init();

  async function save(entries){
    const rows=entries.map(normalize); writeLocal([...local(),...rows]); await ready;
    if(!firebaseReady) return rows;
    try{const col=f.collection(firestore,"highscores"); await Promise.all(rows.map(r=>f.addDoc(col,r))); provider="firebase";}
    catch(err){console.warn("Highscore write fallback",err);provider="local";}
    return rows;
  }
  async function top(n=120){
    await ready;
    if(firebaseReady){
      try{const q=f.query(f.collection(firestore,"highscores"),f.orderBy("absDiff","asc"),f.limit(n));const snap=await f.getDocs(q);provider="firebase";return snap.docs.map(d=>({id:d.id,...d.data()}));}
      catch(err){console.warn("Highscore read fallback",err);provider="local";}
    }
    return local().sort((a,b)=>a.absDiff-b.absDiff).slice(0,n);
  }
  return {get provider(){return provider},ready,save,top};
})();