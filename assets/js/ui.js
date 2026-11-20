// Funzioni di rendering (DOM). Si usa textContent per evitare iniezioni di HTML dall'API.
export const $ = (selector) => document.querySelector(selector);

export function el(tag, { class: cls, text, attrs = {}, on = {} } = {}, ...children) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text != null) node.textContent = text;
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  for (const [k, v] of Object.entries(on)) node.addEventListener(k, v);
  node.append(...children.filter(Boolean));
  return node;
}

export function toggle(node, visible) {
  node.classList.toggle("d-none", !visible);
}

export function showAlert(container, message, type = "danger") {
  container.replaceChildren(
    el("div", { class: `alert alert-${type} alert-dismissible fade show`, attrs: { role: "alert" } },
      document.createTextNode(message),
      el("button", { class: "btn-close", attrs: { type: "button", "data-bs-dismiss": "alert", "aria-label": "Chiudi" } }))
  );
}

export function clearAlert(container) {
  container.replaceChildren();
}

// ---------- Card squadra ----------
export function teamCard(team, { fav, selected, onSelect, onToggleFav }) {
  const star = el("button", {
    class: "btn btn-link fav-btn p-0",
    text: fav ? "★" : "☆",
    attrs: {
      type: "button",
      "aria-pressed": String(fav),
      "aria-label": fav ? `Rimuovi ${team.strTeam} dai preferiti` : `Aggiungi ${team.strTeam} ai preferiti`,
      title: fav ? "Rimuovi dai preferiti" : "Aggiungi ai preferiti",
    },
    on: { click: (e) => { e.stopPropagation(); onToggleFav(team); } },
  });

  const badge = team.strBadge
    ? el("img", { class: "team-badge", attrs: { src: `${team.strBadge}/small`, alt: `Logo ${team.strTeam}`, loading: "lazy" } })
    : el("div", { class: "badge-placeholder", text: "🏅" });

  const card = el("div", {
    class: `card h-100 team-card${selected ? " selected" : ""}`,
    attrs: { tabindex: "0", role: "button", "aria-label": `Mostra eventi di ${team.strTeam}` },
    on: {
      click: () => onSelect(team),
      keydown: (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(team); } },
    },
  },
    el("div", { class: "card-body" },
      el("div", { class: "d-flex justify-content-between align-items-start mb-2" }, badge, star),
      el("h3", { class: "h5 card-title mb-1", text: team.strTeam }),
      el("p", { class: "text-body-secondary mb-2", text: team.strCountry || "—" }),
      el("div", { class: "d-flex flex-wrap gap-1" },
        team.strSport ? el("span", { class: "badge text-bg-primary", text: team.strSport }) : null,
        team.strLeague ? el("span", { class: "badge text-bg-secondary", text: team.strLeague }) : null)));

  return el("div", { class: "col" }, card);
}

export function renderTeams(container, teams, options) {
  container.replaceChildren(...teams.map((t) => teamCard(t, options(t))));
}

// ---------- Eventi ----------
const SCORE = (e) =>
  e.intHomeScore != null && e.intAwayScore != null ? `${e.intHomeScore} - ${e.intAwayScore}` : null;

export function eventDate(e) {
  if (!e.dateEvent) return null;
  const time = e.strTime && e.strTime !== "00:00:00" ? e.strTime : null;
  const d = new Date(`${e.dateEvent}T${time ?? "00:00:00"}Z`); // l'API fornisce orari UTC
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

export function formatDate(e) {
  const d = eventDate(e);
  if (!d) return "Data da definire";
  const hasTime = e.strTime && e.strTime !== "00:00:00";
  return d.toLocaleString("it-IT", hasTime
    ? { dateStyle: "medium", timeStyle: "short" }
    : { dateStyle: "medium", timeZone: "UTC" });
}

export function renderEvents(container, events, onOpen) {
  if (!events.length) {
    container.replaceChildren(el("div", { class: "list-group-item text-body-secondary", text: "Nessun evento disponibile" }));
    return;
  }
  container.replaceChildren(...events.map((e) => {
    const score = SCORE(e);
    return el("button", {
      class: "list-group-item list-group-item-action",
      attrs: { type: "button" },
      on: { click: () => onOpen(e) },
    },
      el("div", { class: "d-flex justify-content-between gap-2" },
        el("strong", { text: e.strEvent || `${e.strHomeTeam} vs ${e.strAwayTeam}` }),
        score ? el("span", { class: "badge text-bg-dark", text: score }) : null),
      el("div", { class: "small text-body-secondary", text: `${formatDate(e)}${e.strLeague ? " · " + e.strLeague : ""}` }));
  }));
}

// Ordina per data: i prossimi in ordine crescente, gli ultimi dal più recente
export function sortByDate(events, direction = "asc") {
  const ts = (e) => eventDate(e)?.getTime() ?? 0;
  return [...events].sort((a, b) => (direction === "asc" ? ts(a) - ts(b) : ts(b) - ts(a)));
}

// ---------- Modale evento ----------
export function fillEventModal(e) {
  $("#event-modal-title").textContent = e.strEvent || "Evento";
  const rows = [
    ["Data", formatDate(e)],
    ["Competizione", e.strLeague],
    ["Stagione", e.strSeason],
    ["Giornata", e.intRound],
    ["Stadio", e.strVenue],
    ["Stato", e.strStatus],
  ].filter(([, v]) => v);

  const score = SCORE(e);
  const body = [
    e.strThumb ? el("img", { class: "event-thumb mb-3", attrs: { src: `${e.strThumb}/medium`, alt: e.strEvent || "Evento", loading: "lazy" } }) : null,
    el("p", { class: "h4 text-center mb-3", text: `${e.strHomeTeam ?? "?"}${score ? "  " + score + "  " : " vs "}${e.strAwayTeam ?? "?"}` }),
    el("dl", { class: "row mb-0" }, ...rows.flatMap(([k, v]) => [
      el("dt", { class: "col-5", text: k }),
      el("dd", { class: "col-7", text: String(v) }),
    ])),
  ];
  $("#event-modal-body").replaceChildren(...body);
}
