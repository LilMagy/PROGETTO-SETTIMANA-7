import { searchTeams, lookupTeam, eventsNext, eventsLast } from "./api.js";
import { getFavorites, isFavorite, toggleFavorite, updateFavorites } from "./favorites.js";
import {
  $, el, toggle, showAlert, clearAlert, renderTeams, renderEvents, sortByDate, fillEventModal,
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
}

function renderAll() {
  renderFavorites();
  renderResults();
}

function updateSportFilter() {
  const previous = sportFilter.value;
  const sports = [...new Set(state.results.map((t) => t.strSport).filter(Boolean))].sort();
  sportFilter.replaceChildren(
    el("option", { text: "Tutti gli sport", attrs: { value: "" } }),
    ...sports.map((s) => el("option", { text: s, attrs: { value: s } })));
  sportFilter.value = sports.includes(previous) ? previous : "";
  sportFilter.disabled = sports.length < 2;
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
    updateSportFilter();
    renderResults();
    toggle($("#spinner"), false);
    return;
  }

  const controller = new AbortController();
  state.controller = controller;
  toggle($("#spinner"), true);

  try {
    state.results = await searchTeams(query, controller.signal);
    updateSportFilter();
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
