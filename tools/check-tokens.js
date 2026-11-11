// Fails if any var(--alt-*) used in the extension isn't defined in the
// palette. An undefined custom property makes the whole declaration invalid,
// so the element silently falls back to an inherited or initial colour.
//
// Usage: node tools/check-tokens.js

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const files = ["src/styles/theme.css", "src/styles/home.css", "src/content/main-world.js", "src/content/theme.js", "src/content/home.js"];
const defined = new Set(
  [...fs.readFileSync(path.join(root, "src/styles/theme.css"), "utf8").matchAll(/(--alt-[\w-]+)\s*:/g)].map((m) => m[1])
);

let missing = 0;
for (const file of files) {
  const lines = fs.readFileSync(path.join(root, file), "utf8").split("\n");
  lines.forEach((line, i) => {
    for (const [, token] of line.matchAll(/var\((--alt-[\w-]+)/g)) {
      if (!defined.has(token)) {
        missing++;
        console.log(`${file}:${i + 1}  ${token} is not defined in theme.css`);
      }
    }
  });
}
console.log(missing ? `\n${missing} undefined token use(s)` : `All --alt-* tokens defined (${defined.size} in the palette)`);
process.exit(missing ? 1 : 0);
