/* =====================================================================
   APP SQUADRE SPORTIVE -
   =====================================================================

   FLUSSO GENERALE DELL'APP:

     [1] La pagina si carica -> questo file registra l'ascolto dell'evento "submit"
         del form. Non parte nessuna chiamata all'API: l'app è vuota.

     [2] L'utente scrive un nome 
           -> parte il gestore del submit 
           -> chiama searchTeams()    scarica le squadre dall'API
           -> chiama renderTeams()    crea una card per squadra

     [3] L'utente clicca una card
           -> parte loadEvents()      scarica ultimo e prossimo evento
           -> usa formatEvent()       costruisce gli elementi di un evento

   ===================================================================== */

// Indirizzo base dell'API. "123" è la chiave gratuita pubblica di TheSportsDB:

const BASE_URL = "https://www.thesportsdb.com/api/v1/json/123";

// --- Elementi della parte "ricerca" ---
const form = document.getElementById("search-form"); // il <form> con input e pulsante
const input = document.getElementById("search-input"); // la casella di testo
const alertArea = document.getElementById("alert-area"); // dove appaiono i messaggi della ricerca
const spinner = document.getElementById("spinner"); // rotellina di caricamento della ricerca
const resultsList = document.getElementById("results-list"); // contenitore delle card delle squadre

// --- Elementi della parte "eventi" (la sezione che appare dopo il click su una card) ---
const eventsSection = document.getElementById("events-section"); // intera sezione eventi
const eventsTitle = document.getElementById("events-title"); // titolo "Eventi di <squadra>"
const eventsSpinner = document.getElementById("events-spinner"); // rotellina di caricamento degli eventi
const eventsAlert = document.getElementById("events-alert"); // messaggi di errore degli eventi
const eventLast = document.getElementById("event-last"); // riquadro "Ultimo evento"
const eventNext = document.getElementById("event-next"); // riquadro "Prossimo evento"

const DEBOUNCE_MS = 400;

// ELEMENT BUILDER
function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent += text; // "!= null" esclude null e undefined, ma accetta "" e 0
  return node;
}

function showAlert(container, message, type = "danger") {
  const alert = el("div", `alert alert-${type}`, message);
  alert.setAttribute("role", "alert");
  container.replaceChildren(alert); // toglie il vecchio contenuto e inserisce l'alert
}

function clearAlert(container) {
  container.replaceChildren();
}

async function getJson(path) {
  const response = await fetch(`${BASE_URL}/${path}`); // 1) invio e attesa
  if (!response.ok) {
    // 2) controllo dello stato HTTP
    throw new Error(`Errore HTTP ${response.status}`);
  }
  return response.json(); // 3) conversione in oggetto JS
}

//SEARCH FUNCTION
async function searchTeams(name) {
  const data = await getJson(`searchteams.php?t=${encodeURIComponent(name)}`);
  return data.teams ?? [];
}

// RENDER TEAMS
function renderTeams(teams) {
  resultsList.replaceChildren(); // 1) pulizia

  teams.forEach((team) => {
    // 2) costruzione degli elementi, dall'esterno verso l'interno
    const col = el("div", "col");

    const card = el("div", "card h-100");
    card.tabIndex = 0; // permette di raggiungerla con il tasto Tab

    const head = el("div", "card-head");
    const body = el("div", "card-body");

    card.style.cursor = "pointer"; // il puntatore diventa una manina: la card è cliccabile
    card.setAttribute("role", "button"); // accessibilità: dichiara che si comporta da pulsante
    // Il logo viene aggiunto solo se la squadra ne ha uno
    if (team.strBadge) {
      const logo = el("img", "mb-2");
      logo.src = `${team.strBadge}/small`;
      logo.alt = `Logo ${team.strTeam}`;
      logo.width = 96;
      logo.height = 96;
      logo.style.objectFit = "contain"; // l'immagine non viene deformata
      logo.loading = "lazy"; // si scarica solo quando sta per diventare visibile
      head.appendChild(logo);
    }

    const starBtn = document.createElement("button");
    starBtn.classList.add("btn");
    starBtn.appendChild(el("i", "bi bi-star"));

    head.appendChild(starBtn);

    body.append(
      el("h3", "h5 card-title", team.strTeam),
      el("p", "mb-2 text-body-secondary", team.strCountry),
      el("span", "badge text-bg-primary", team.strSport),
      " ",
      el("span", "badge text-bg-secondary me-1", team.strLeague),
    );

    card.appendChild(head);
    card.appendChild(body);
    col.appendChild(card);

    // 3) click sulla card -> carica gli eventi di questa squadra
    body.addEventListener("click", () => loadEvents(team));
    starBtn.addEventListener("click", () => console.log("star"));
    // 4) inserimento nella pagina
    resultsList.appendChild(col);
  });
}

// SEARCH INPUT QUERY
form.addEventListener("input", async (event) => {
  event.preventDefault(); // 1) niente ricaricamento pagina

  const query = input.value.trim(); // 2) testo digitato, senza spazi ai bordi

  clearAlert(alertArea); // 3) pulizia dello stato precedente
  resultsList.replaceChildren();
  eventsSection.classList.add("d-none"); //    "d-none" = nascosto (classe Bootstrap)

  if (query === "") {
    // 4) validazione: campo vuoto
    showAlert(alertArea, "Scrivi il nome di una squadra.", "warning");
    return;
  }

  spinner.classList.remove("d-none"); // 5) mostra la rotellina
  try {
    const teams = await searchTeams(query); //    attende la risposta dell'API
    if (teams.length === 0) {
      showAlert(alertArea, `Nessuna squadra trovata per "${query}".`, "info");
    } else {
      renderTeams(teams); //    mostra le card
    }
  } catch (error) {
    // Arriviamo qui se fetch fallisce (es. niente rete) o getJson lancia un Error
    showAlert(alertArea, `Impossibile completare la ricerca: ${error.message}`);
  } finally {
    spinner.classList.add("d-none"); // 6) nasconde la rotellina in ogni caso
  }
});

//EVENTS RENDER
function formatEvent(e) {
  const fragment = document.createDocumentFragment();

  // Nessun evento: messaggio e fine
  if (!e) {
    fragment.append(
      el("p", "text-body-secondary mb-0", "Nessun evento disponibile."),
    );
    return fragment;
  }

  // Riga della data, con l'ora tra parentesi solo se l'API la fornisce
  const dateText =
    (e.dateEvent ?? "") +
    (e.strTime ? ` · ${e.strTime.slice(0, 5)} (UTC)` : "");

  fragment.append(
    el("p", "fw-bold mb-1", e.strEvent),
    el("p", "mb-1", dateText),
  );

  // Riga del risultato: solo per gli eventi già giocati
  const hasScore = e.intHomeScore != null && e.intAwayScore != null;
  if (hasScore) {
    const scoreLine = el("p", "mb-1", "Risultato: "); // testo normale...
    scoreLine.append(
      el("strong", null, `${e.intHomeScore} - ${e.intAwayScore}`),
    ); // ...e punteggio in grassetto
    fragment.append(scoreLine);
  }

  fragment.append(el("p", "small text-body-secondary mb-0", e.strLeague));
  return fragment;
}

// LOAD EVENTS
async function loadEvents(team) {
  // 1) preparazione dell'interfaccia
  eventsSection.classList.remove("d-none");
  eventsTitle.textContent = `Eventi di ${team.strTeam}`;
  eventLast.replaceChildren();
  eventNext.replaceChildren();
  clearAlert(eventsAlert);
  eventsSpinner.classList.remove("d-none");
  eventsSection.scrollIntoView({ behavior: "smooth" });

  try {
    // 2) due chiamate contemporanee all'API
    const [lastData, nextData] = await Promise.all([
      getJson(`eventslast.php?id=${team.idTeam}`),
      getJson(`eventsnext.php?id=${team.idTeam}`),
    ]);

    // 3) estrazione e ordinamento per data
    const lastEvents = (lastData.results ?? []).sort((a, b) =>
      b.dateEvent.localeCompare(a.dateEvent),
    );
    const nextEvents = (nextData.events ?? []).sort((a, b) =>
      a.dateEvent.localeCompare(b.dateEvent),
    );

    // 4) visualizzazione del primo evento di ciascuna lista
    eventLast.replaceChildren(formatEvent(lastEvents[0]));
    eventNext.replaceChildren(formatEvent(nextEvents[0]));
  } catch (error) {
    // 5) errore di rete o HTTP
    showAlert(eventsAlert, `Impossibile caricare gli eventi: ${error.message}`);
  } finally {
    // 6) lo spinner sparisce sempre
    eventsSpinner.classList.add("d-none");
  }
}

function debouncedSearch(team) {
  clearTimeout(state.timer);
  state.timer = setTimeout(searchTeams(team), DEBOUNCE_MS);
}
