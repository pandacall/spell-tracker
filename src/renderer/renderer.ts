// Plain browser script (no imports), loaded by index.html.
interface RendererSpell { id: string; name: string }
interface RendererRow { champion: { id: string; name: string }; spells: RendererSpell[] }
interface RendererPayload { state: { visible: boolean; rows: RendererRow[] }; iconVersion: string }

declare const overlayApi: { onState(listener: (payload: RendererPayload) => void): void };

const CDN = "https://ddragon.leagueoflegends.com/cdn";

function icon(url: string, alt: string, className?: string): HTMLImageElement {
  const image = document.createElement("img");
  image.src = url;
  image.alt = alt;
  if (className) image.className = className;
  return image;
}

overlayApi.onState(({ state, iconVersion }) => {
  const container = document.getElementById("rows")!;
  container.replaceChildren(
    ...state.rows.map((row) => {
      const element = document.createElement("div");
      element.className = "row";
      element.append(
        icon(`${CDN}/${iconVersion}/img/champion/${row.champion.id}.png`, row.champion.name, "champion"),
        ...row.spells.map((spell) => icon(`${CDN}/${iconVersion}/img/spell/${spell.id}.png`, spell.name)),
      );
      return element;
    }),
  );
});
