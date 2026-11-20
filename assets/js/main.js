import { searchTeams, lookupTeam, eventsNext, eventsLast } from "./api.js";
import { getFavorites, isFavorite, toggleFavorite, updateFavorites } from "./favorites.js";
import {
  $, toggle, showAlert, clearAlert, renderTeams, renderEvents, sortByDate, fillEventModal,
} from "./ui.js";

const DEBOUNCE_MS = 400;
const MIN_CHARS = 2;

const state = {
  results: [],
  selectedId: null,
  controller: null, 
  timer: null,
};

const input = $("#search-input");
const sportFilter = $("#sport-filter");

// ---------- Tema ----------
function initTheme() {
  let theme = null;
  try { theme = localStorage.getItem("theme"); } catch { /* ignora */ }
  theme ??= matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  document.documentElement.dataset.bsTheme = theme;
  $("#theme-toggle").addEventListener("click", () => {
    const next = document.documentElement.dataset.bsTheme === "dark" ? "light" : "dark";
    document.documentElement.dataset.bsTheme = next;
    try { localStorage.setItem("theme", next); } catch { /* ignora */ }
  });
}

// ---------- Rendering ----------
function cardOptions(team) {
  return {
    fav: isFavorite(team.idTeam),
    selected: team.idTeam === state.selectedId,
    onSelect: selectTeam,
    onToggleFav: onToggleFav,
  };
}

function renderFavorites() {
  const favs = getFavorites();
  toggle($("#favorites-section"), favs.length > 0);
  renderTeams($("#favorites-list"), favs, cardOptions);
}

function visibleResults() {
  const sport = sportFilter.value;
  return sport ? state.results.filter((t) => t.strSport === sport) : state.results;
}

function renderResults() {
  const list = visibleResults();
  toggle($("#results-title"), state.results.length > 0);
  renderTeams($("#results-list"), list, cardOptions);

  // Se la ricerca ha trovato squadre ma il filtro le nasconde tutte, lo si spiega
  // (altrimenti la lista sembrerebbe vuota senza motivo)
  if (state.results.length > 0) {
    const alertArea = $("#alert-area");
    if (list.length === 0) {
      showAlert(alertArea, 'Nessuna squadra trovata per lo sport selezionato. Prova con "Tutti gli sport".', "info");
    } else {
      clearAlert(alertArea);
    }
  }
}

function renderAll() {
  renderFavorites();
  renderResults();
}

// ---------- Ricerca ----------
async function runSearch() {
  clearTimeout(state.timer);
  const query = input.value.trim();
  const alertArea = $("#alert-area");
  clearAlert(alertArea);

  // Annulla la richiesta precedente ancora in corso
  state.controller?.abort();

  if (query.length < MIN_CHARS) {
    state.results = [];
    renderResults();
    toggle($("#spinner"), false);
    return;
  }

  const controller = new AbortController();
  state.controller = controller;
  toggle($("#spinner"), true);

  try {
    state.results = await searchTeams(query, controller.signal);
    renderResults();
    if (!state.results.length) showAlert(alertArea, `Nessuna squadra trovata per "${query}".`, "info");
  } catch (err) {
    if (err.name === "AbortError") return; // sostituita da una ricerca più recente
    showAlert(alertArea, `Impossibile completare la ricerca: ${err.message}`);
  } finally {
    if (state.controller === controller) toggle($("#spinner"), false);
  }
}

function debouncedSearch() {
  clearTimeout(state.timer);
  state.timer = setTimeout(runSearch, DEBOUNCE_MS);
}

// ---------- Preferiti ----------
function onToggleFav(team) {
  toggleFavorite(team);
  renderAll();
}

async function refreshFavorites() {
  const favs = getFavorites();
  if (!favs.length) return;
  const settled = await Promise.allSettled(favs.map((t) => lookupTeam(t.idTeam)));
  const fresh = settled.filter((r) => r.status === "fulfilled" && r.value).map((r) => r.value);
  if (fresh.length) {
    updateFavorites(fresh);
    renderFavorites();
  }
}

// ---------- Eventi ----------
function openEvent(event) {
  fillEventModal(event);
  bootstrap.Modal.getOrCreateInstance($("#event-modal")).show();
}

async function selectTeam(team) {
  state.selectedId = team.idTeam;
  renderAll();

  const section = $("#events-section");
  const alertArea = $("#events-alert");
  toggle(section, true);
  $("#events-title").textContent = `Eventi di ${team.strTeam}`;
  clearAlert(alertArea);
  $("#events-last").replaceChildren();
  $("#events-next").replaceChildren();
  toggle($("#events-spinner"), true);
  section.scrollIntoView({ behavior: "smooth", block: "start" });

  try {
    // Le due chiamate partono in parallelo
    const [last, next] = await Promise.all([eventsLast(team.idTeam), eventsNext(team.idTeam)]);
    if (state.selectedId !== team.idTeam) return; // nel frattempo è stata scelta un'altra squadra
    renderEvents($("#events-last"), sortByDate(last, "desc"), openEvent);
    renderEvents($("#events-next"), sortByDate(next, "asc"), openEvent);
  } catch (err) {
    if (state.selectedId === team.idTeam) {
      showAlert(alertArea, `Impossibile caricare gli eventi: ${err.message}`);
    }
  } finally {
    if (state.selectedId === team.idTeam) toggle($("#events-spinner"), false);
  }
}

// ---------- Avvio ----------
initTheme();
input.addEventListener("input", debouncedSearch);
$("#search-form").addEventListener("submit", (e) => { e.preventDefault(); runSearch(); });
sportFilter.addEventListener("change", renderResults);

renderFavorites();
refreshFavorites();
