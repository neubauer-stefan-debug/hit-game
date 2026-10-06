
/*
  Zentrale Highscore-Schicht.
  Die App spricht ausschließlich mit window.HitScores.
  Aktuell: localStorage.
  Später: Firebase/Firestore kann hier ergänzt werden, ohne die Spiellogik in app.js umzubauen.
*/
window.HitScores = (() => {
  const LOCAL_KEY = "hit_scores_v2";

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

  async function save(entries){
    const old = JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]");
    const add = entries.map(normalize);
    const merged = [...old, ...add]
      .sort((a,b) => a.absDiff - b.absDiff || new Date(a.createdAt) - new Date(b.createdAt))
      .slice(0, 100);
    localStorage.setItem(LOCAL_KEY, JSON.stringify(merged));
    return merged;
  }

  async function top(limit = 30){
    const all = JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]");
    return all.sort((a,b) => a.absDiff - b.absDiff).slice(0, limit);
  }

  async function clearLocal(){
    localStorage.removeItem(LOCAL_KEY);
  }

  return {
    provider: "local",
    save,
    top,
    clearLocal
  };
})();
