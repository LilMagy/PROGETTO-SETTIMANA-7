// Gestione dei preferiti in localStorage (collezione di oggetti squadra)
const KEY = "favoriteTeams";

// Solo i campi usati dall'app, con i nomi esatti dell'API
function pick(t) {
  const { idTeam, strTeam, strBadge, strLeague, strCountry, strSport } = t;
  return { idTeam, strTeam, strBadge, strLeague, strCountry, strSport };
}

export function getFavorites() {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}


// Preferiti salvati in un unico JSON nel localStorage
function save(list) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function isFavorite(id) {
  return getFavorites().some((t) => t.idTeam === id);
}

// Aggiunge o rimuove; ritorna true se ora è nei preferiti
export function toggleFavorite(team) {
  const list = getFavorites();
  const exists = list.some((t) => t.idTeam === team.idTeam);
  save(
    exists
      ? list.filter((t) => t.idTeam !== team.idTeam)
      : [...list, pick(team)],
  );
  return !exists;
}

// Sostituisce i dati salvati con quelli aggiornati dall'API
export function updateFavorites(freshTeams) {
  const map = new Map(freshTeams.map((t) => [t.idTeam, pick(t)]));
  save(getFavorites().map((t) => map.get(t.idTeam) ?? t));
}
