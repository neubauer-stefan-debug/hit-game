
window.HitScores = (() => {
  const LOCAL_KEY = "hit_scores_v3";
  const cfg = window.HIT_FIREBASE_CONFIG;

  let provider = "local";
  let firebaseReady = false;
  let firestore = null;
  let firebaseFns = null;

  function normalize(entry){
    return {
      name: String(entry.name || "Player").slice(0, 20),
      target: Number(entry.target),
      result: Number(entry.result),
      diff: Number(entry.diff),
      absDiff: Math.abs(Number(entry.absDiff ?? entry.diff)),
      mode: entry.mode || "party",
      theme: entry.theme || "boy",
      createdAt: entry.createdAt || new Date().toISOString()
    };
  }

  function getLocal(){
    try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]"); }
    catch { return []; }
  }

  function setLocal(entries){
    localStorage.setItem(LOCAL_KEY, JSON.stringify(
      entries.sort((a,b)=>a.absDiff-b.absDiff || new Date(a.createdAt)-new Date(b.createdAt)).slice(0,150)
    ));
  }

  async function initFirebase(){
    if (!cfg) return false;
    try {
      const [{ initializeApp }, { getAuth, signInAnonymously }, { getFirestore, collection, addDoc, getDocs, query, orderBy, limit }] = await Promise.all([
        import("https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js"),
        import("https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js"),
        import("https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js")
      ]);

      const app = initializeApp(cfg);
      const auth = getAuth(app);
      await signInAnonymously(auth);
      firestore = getFirestore(app);
      firebaseFns = { collection, addDoc, getDocs, query, orderBy, limit };
      firebaseReady = true;
      provider = "firebase";
      return true;
    } catch (err) {
      console.warn("Firebase nicht verfügbar – lokaler Fallback aktiv.", err);
      firebaseReady = false;
      provider = "local";
      return false;
    }
  }

  const ready = initFirebase();

  async function save(entries){
    const normalized = entries.map(normalize);
    setLocal([...getLocal(), ...normalized]);

    await ready;
    if (!firebaseReady) return getLocal();

    try {
      const col = firebaseFns.collection(firestore, "highscores");
      await Promise.all(normalized.map(entry => firebaseFns.addDoc(col, entry)));
      provider = "firebase";
      return normalized;
    } catch (err) {
      console.warn("Online-Speichern fehlgeschlagen.", err);
      provider = "local";
      return getLocal();
    }
  }

  async function top(limitCount = 100){
    await ready;
    if (firebaseReady) {
      try {
        const q = firebaseFns.query(
          firebaseFns.collection(firestore, "highscores"),
          firebaseFns.orderBy("absDiff", "asc"),
          firebaseFns.limit(limitCount)
        );
        const snap = await firebaseFns.getDocs(q);
        provider = "firebase";
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
      } catch (err) {
        console.warn("Online-Lesen fehlgeschlagen.", err);
        provider = "local";
      }
    }
    return getLocal().sort((a,b)=>a.absDiff-b.absDiff || new Date(a.createdAt)-new Date(b.createdAt)).slice(0,limitCount);
  }

  async function clearLocal(){
    localStorage.removeItem(LOCAL_KEY);
  }

  return {
    get provider(){ return provider; },
    ready,
    save,
    top,
    clearLocal
  };
})();
