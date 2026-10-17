const manifest = require("../package.json");
const family = manifest.name.replace("-theme", "");

function contrast(foreground, background) {
  const probe = document.createElement("span");
  document.body.appendChild(probe);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const context = canvas.getContext("2d");
  const channels = (values) => {
    context.clearRect(0, 0, 1, 1);
    for (const value of values) {
      probe.style.color = `var(${value})`;
      context.fillStyle = getComputedStyle(probe).color;
      context.fillRect(0, 0, 1, 1);
    }
    return Array.from(context.getImageData(0, 0, 1, 1).data).slice(0, 3);
  };
  const luminance = (rgb) =>
    rgb
      .map((channel) => channel / 255)
      .map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4))
      .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
  try {
    const a = luminance(channels([background, foreground]));
    const b = luminance(channels([background]));
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  } finally {
    probe.remove();
  }
}

describe(`${manifest.name} readable UI roles`, () => {
  afterEach(async () => {
    for (const mode of ["day", "night"]) {
      await lumine.packages.deactivatePackage(`${family}-${mode}-ui`);
    }
    await lumine.packages.deactivatePackage(manifest.name);
  });

  for (const mode of ["day", "night"]) {
    it(`keeps secondary labels and status text readable in ${mode} mode`, async () => {
      await lumine.packages.activatePackage(manifest.name);
      await lumine.packages.activatePackage(`${family}-${mode}-ui`);
      const pairs = [
        ["--text-color-subtle", "--app-background-color"],
        ["--text-color-subtle", "--base-background-color"],
        ["--text-color-subtle", "--inset-panel-background-color"],
        ["--text-color-hint", "--input-background-color"],
        ["--tab-text-color", "--tab-bar-background-color"],
        ["--accent-foreground-color", "--accent-background-color"],
        ["--tooltip-text-color", "--tooltip-background-color"],
        ...["info", "success", "warning", "error"].map((kind) => [
          `--text-color-${kind}`,
          "--base-background-color",
        ]),
      ];
      for (const [foreground, background] of pairs) {
        expect(contrast(foreground, background))
          .withContext(`${foreground} on ${background}`)
          .toBeGreaterThanOrEqual(4.5);
      }
    });
  }
});
