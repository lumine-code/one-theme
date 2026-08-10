const path = require("path");

const root = document.documentElement;

// The handful of tokens the day palette keeps monochrome and the night palette
// tints. They are the only reason the two syntax themes ever needed separate
// rule sheets, and they now resolve through --syntax-symbolic-color.
const SYMBOLIC_TOKENS = [
  ["syntax--keyword", "syntax--symbolic"],
  ["syntax--punctuation", "syntax--accessor", "syntax--member"],
  ["syntax--punctuation", "syntax--accessor", "syntax--scope"],
  ["syntax--punctuation", "syntax--embedded"],
  ["syntax--string", "syntax--interpolation"],
];

// Resolve a custom property to the same rgb() string getComputedStyle reports
// for a color, so an expectation never hard-codes a palette value.
function colorOf(variable) {
  const probe = document.createElement("span");
  probe.style.color = `var(${variable})`;
  document.body.appendChild(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color;
}

function colorOfToken(classNames) {
  const token = document.createElement("span");
  token.className = classNames.join(" ");
  document.body.appendChild(token);
  const color = getComputedStyle(token).color;
  token.remove();
  return color;
}

describe("one-theme", () => {
  afterEach(async () => {
    await lumine.packages.deactivatePackage("one-day-ui");
    await lumine.packages.deactivatePackage("one-day-syntax");
    await lumine.packages.deactivatePackage("one-night-syntax");
    await lumine.packages.deactivatePackage("one-theme");
  });

  it("applies its appearance settings as root attributes", async () => {
    await lumine.packages.activatePackage("one-theme");

    // Defaults.
    expect(root.getAttribute("ui-tabsizing")).toBe("even");
    expect(root.hasAttribute("ui-tab-close-button")).toBe(false);
    expect(root.hasAttribute("ui-dock-buttons")).toBe(false);

    // Changing a setting updates the matching attribute.
    lumine.config.set("one-theme.tabSizing", "Maximum");
    expect(root.getAttribute("ui-tabsizing")).toBe("maximum");

    lumine.config.set("one-theme.tabCloseButton", "Left");
    expect(root.getAttribute("ui-tab-close-button")).toBe("left");

    lumine.config.set("one-theme.hideDockButtons", true);
    expect(root.getAttribute("ui-dock-buttons")).toBe("hidden");
  });

  it("removes the attributes when deactivated", async () => {
    await lumine.packages.activatePackage("one-theme");
    lumine.config.set("one-theme.hideDockButtons", true);
    expect(root.getAttribute("ui-dock-buttons")).toBe("hidden");

    await lumine.packages.deactivatePackage("one-theme");
    expect(root.hasAttribute("ui-tabsizing")).toBe(false);
    expect(root.hasAttribute("ui-dock-buttons")).toBe(false);
  });

  it("registers its light and dark themes as a pack", async () => {
    await lumine.packages.activatePackage("one-theme");

    const themePack = lumine.themes.getThemePacks().find(({ name }) => name === "One");

    expect(themePack.light).toEqual(["one-day-ui", "one-day-syntax"]);
    expect(themePack.dark).toEqual(["one-night-ui", "one-night-syntax"]);
  });

  it("keeps its package-specific config stylesheet out of the shared UI directory", async () => {
    await lumine.packages.activatePackage("one-theme");

    const uiPaths = lumine.packages.getLoadedPackage("one-day-ui").getStylesheetPaths();
    const configPath = uiPaths.find((stylePath) => path.basename(stylePath) === "config.css");

    expect(configPath).toContain(path.join("one-theme", "styles", "one-ui"));
  });

  it("gives both syntax themes the same rule sheet", async () => {
    await lumine.packages.activatePackage("one-theme");

    const sheetFor = (themeName) =>
      lumine.packages
        .getLoadedPackage(themeName)
        .getStylesheetPaths()
        .filter((stylePath) => path.basename(stylePath) === "syntax.lumine-text-editor.css");

    const dayRules = sheetFor("one-day-syntax");
    const nightRules = sheetFor("one-night-syntax");

    expect(dayRules.length).toBe(1);
    expect(dayRules).toEqual(nightRules);
    expect(dayRules[0]).toContain(path.join("one-theme", "styles", "syntax"));
  });

  it("keeps symbolic tokens monochrome by day and tinted by night", async () => {
    await lumine.packages.activatePackage("one-theme");

    await lumine.packages.activatePackage("one-day-syntax");
    const dayMono = colorOf("--mono-1");
    for (const classNames of SYMBOLIC_TOKENS) {
      expect(colorOfToken(classNames)).toBe(dayMono);
    }
    await lumine.packages.deactivatePackage("one-day-syntax");

    await lumine.packages.activatePackage("one-night-syntax");
    const nightAccent = colorOf("--hue-3");
    for (const classNames of SYMBOLIC_TOKENS) {
      expect(colorOfToken(classNames)).toBe(nightAccent);
    }
  });

  it("tints the cursor line from the palette in both variants", async () => {
    await lumine.packages.activatePackage("one-theme");

    const cursorLineColor = async (themeName) => {
      await lumine.packages.activatePackage(themeName);
      const editor = document.createElement("lumine-text-editor");
      const line = document.createElement("div");
      line.className = "line cursor-line";
      editor.appendChild(line);
      document.body.appendChild(editor);
      const color = getComputedStyle(line).backgroundColor;
      editor.remove();
      await lumine.packages.deactivatePackage(themeName);
      return color;
    };

    // Semi-transparent in both, so search-result markers still show through.
    // A relative color computes to color(srgb r g b / a) rather than rgba().
    for (const themeName of ["one-day-syntax", "one-night-syntax"]) {
      const color = await cursorLineColor(themeName);
      const alpha = /[,/]\s*([\d.]+)\s*\)$/.exec(color);
      expect(alpha).not.toBeNull();
      expect(Number(alpha[1])).toBeLessThan(0.2);
    }
  });

  it("runs the modal-list scrollbar track the full height of the list", async () => {
    await lumine.packages.activatePackage("one-theme");
    await lumine.packages.activatePackage("one-day-ui");

    const modal = document.createElement("lumine-panel");
    modal.className = "modal";
    const selectList = document.createElement("div");
    selectList.className = "select-list";
    const list = document.createElement("ol");
    list.className = "list-group";
    selectList.appendChild(list);
    modal.appendChild(selectList);
    document.body.appendChild(modal);

    // Anything that stops the track short of the scrollbar's ends — a margin,
    // or a radius large enough to round them off — uncovers `::-webkit-scrollbar`
    // itself, and nothing paints that, so the list background shows through as a
    // pale stub at each end instead of the track colour.
    const trackStyle = getComputedStyle(list, "::-webkit-scrollbar-track");
    const cornerStyle = getComputedStyle(list, "::-webkit-scrollbar-corner");
    expect(trackStyle.marginTop).toBe("0px");
    expect(trackStyle.marginBottom).toBe("0px");
    expect(trackStyle.borderRadius).toBe("0px");
    expect(cornerStyle.backgroundColor).toBe("rgba(0, 0, 0, 0)");

    modal.remove();
  });
});
