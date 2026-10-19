// Plain browser script (no imports), loaded by index.html.
interface RendererSpell { id: string; name: string; countdown?: number }
interface RendererRow { champion: { id: string; name: string }; spells: RendererSpell[] }
interface RendererPayload { state: { visible: boolean; rows: RendererRow[] }; iconVersion: string }

declare const overlayApi: {
  onState(listener: (payload: RendererPayload) => void): void;
  onReset(listener: () => void): void;
  onAppearance(listener: (appearance: { size: number; opacity: number }) => void): void;
  setInteractive(interactive: boolean): void;
  mark(championId: string, spellId: string): void;
  clear(championId: string, spellId: string): void;
  dragStart(): void;
  dragEnd(): void;
};

const CDN = "https://ddragon.leagueoflegends.com/cdn";

function icon(url: string, alt: string, className?: string): HTMLImageElement {
  const image = document.createElement("img");
  image.src = url;
  image.alt = alt;
  image.draggable = false;
  if (className) image.className = className;
  return image;
}

/** Seconds as m:ss, e.g. 300 -> "5:00". */
function formatCountdown(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function spellElement(championId: string, spell: RendererSpell, iconVersion: string): HTMLElement {
  const element = document.createElement("div");
  element.className = "spell";
  element.dataset.interactive = "";
  element.dataset.champion = championId;
  element.dataset.spell = spell.id;
  element.append(icon(`${CDN}/${iconVersion}/img/spell/${spell.id}.png`, spell.name));
  if (spell.countdown !== undefined) {
    element.classList.add("down");
    const label = document.createElement("span");
    label.className = "countdown";
    label.textContent = formatCountdown(spell.countdown);
    element.append(label);
  }
  return element;
}

overlayApi.onState(({ state, iconVersion }) => {
  const container = document.getElementById("rows")!;
  container.replaceChildren(
    ...state.rows.map((row) => {
      const element = document.createElement("div");
      element.className = "row";
      element.append(
        icon(`${CDN}/${iconVersion}/img/champion/${row.champion.id}.png`, row.champion.name, "champion"),
        ...row.spells.map((spell) => spellElement(row.champion.id, spell, iconVersion)),
      );
      return element;
    }),
  );
});

// CSS zoom rather than the page's zoom factor, which Chromium shares across
// every window on the same origin and would resize the settings window too.
overlayApi.onAppearance(({ size, opacity }) => {
  document.body.style.zoom = String(size / 100);
  document.documentElement.style.setProperty("--overlay-opacity", String(opacity / 100));
});

// The window ignores the mouse so clicks reach the game; it asks for them back
// only while the pointer is over a spell icon or the drag handle.
let interactive = false;
let dragging = false;
const setInteractive = (value: boolean) => {
  if (value === interactive) return;
  interactive = value;
  overlayApi.setInteractive(value);
};

document.addEventListener("mousemove", (event) => {
  // Mid-drag the pointer may outrun the window; letting clicks through then would lose the mouse-up.
  if (dragging) return;
  setInteractive((event.target as Element).closest("[data-interactive]") !== null);
});
document.documentElement.addEventListener("mouseleave", () => {
  if (!dragging) setInteractive(false);
});

// Main hid the window, which ended any drag and made it click-through again.
overlayApi.onReset(() => {
  interactive = false;
  dragging = false;
});

function endDrag() {
  if (!dragging) return;
  dragging = false;
  overlayApi.dragEnd();
}
window.addEventListener("mouseup", endDrag);
window.addEventListener("blur", endDrag);

// Marks act on mouse-down rather than click: the icons are rebuilt every time a
// Countdown ticks, which could otherwise land between the press and the release.
document.addEventListener("mousedown", (event) => {
  const target = event.target as Element;
  if (target.closest("#handle")) {
    if (event.button !== 0) return;
    dragging = true;
    overlayApi.dragStart();
    return;
  }
  const spell = target.closest<HTMLElement>(".spell");
  if (!spell) return;
  const { champion, spell: spellId } = spell.dataset;
  if (champion === undefined || spellId === undefined) return;
  if (event.button === 0) overlayApi.mark(champion, spellId);
  else if (event.button === 2) overlayApi.clear(champion, spellId);
});
document.addEventListener("contextmenu", (event) => event.preventDefault());
