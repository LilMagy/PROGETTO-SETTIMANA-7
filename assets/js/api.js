// Accesso all'API di TheSportsDB 
const BASE_URL = "https://www.thesportsdb.com/api/v1/json/123";

async function getJson(path, signal) {
  const res = await fetch(`${BASE_URL}/${path}`, { signal });
  if (!res.ok) throw new Error(`Errore HTTP ${res.status}`);
  return res.json();
}

// Ricerca squadre per nome. L'API restituisce { teams: null } se non trova nulla.
export async function searchTeams(name, signal) {
  const data = await getJson(`searchteams.php?t=${name}`, signal);
  return data.teams ?? [];
}

// Dettaglio di una squadra tramite id (usato per aggiornare i preferiti all'avvio)
export async function lookupTeam(id) {
  const data = await getJson(`lookupteam.php?id=${id}`);
  return data.teams?.[0] ?? null;  //se l'oggetto teams è null, previene l'errore e lo imposta indefinito, poi lo reimposta a null; se non è null, ma è un'array vuoto (e quindi teams[0] ritorna undefined) lo imposta comunque a null 
}

// Prossimi eventi: { events: [...] } oppure null
export async function eventsNext(id) {
  const data = await getJson(`eventsnext.php?id=${id}`);
  return data.events ?? [];
}

// Ultimi eventi: { results: [...] } oppure null
export async function eventsLast(id) {
  const data = await getJson(`eventslast.php?id=${id}`);
  return data.results ?? [];
}
