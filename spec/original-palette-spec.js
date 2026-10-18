const reference = require("./fixtures/original-palette.json");
const family = require("../package.json").name.replace("-theme", "");

// Values were evaluated from the upstream LESS sources, not from this theme.
// Muted labels and accents intentionally retain the original palette instead
// of being darkened to meet a blanket contrast threshold for every UI role.
describe(`${family} original One palette`, () => {
  afterEach(async () => {
    for (const mode of ["day", "night"]) {
      for (const kind of ["ui", "syntax"]) {
        await lumine.packages.deactivatePackage(`${family}-${mode}-${kind}`);
      }
    }
    await lumine.packages.deactivatePackage(`${family}-theme`);
  });

  for (const kind of ["ui", "syntax"]) {
    if (!reference[kind]) continue;
    for (const mode of ["day", "night"]) {
      it(`matches the original ${mode} ${kind} colors`, async () => {
        await lumine.packages.activatePackage(`${family}-theme`);
        await lumine.packages.activatePackage(`${family}-${mode}-${kind}`);
        const probe = document.createElement("span");
        document.body.appendChild(probe);
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 1;
        const context = canvas.getContext("2d");
        const rgba = (value) => {
          probe.style.color = value;
          context.clearRect(0, 0, 1, 1);
          context.fillStyle = getComputedStyle(probe).color;
          context.fillRect(0, 0, 1, 1);
          return Array.from(context.getImageData(0, 0, 1, 1).data);
        };
        try {
          for (const [name, color] of Object.entries(reference[kind][mode])) {
            const actual = rgba(`var(--${name})`);
            const expected = rgba(color);
            for (let channel = 0; channel < 4; channel++) {
              expect(Math.abs(actual[channel] - expected[channel]))
                .withContext(`${name}, channel ${channel}`)
                .toBeLessThanOrEqual(1);
            }
          }
        } finally {
          probe.remove();
        }
      });
    }
  }
});
