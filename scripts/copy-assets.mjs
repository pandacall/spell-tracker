import { cpSync } from "node:fs";

for (const file of ["index.html", "overlay.css"]) {
  cpSync(`src/renderer/${file}`, `dist/renderer/${file}`);
}
