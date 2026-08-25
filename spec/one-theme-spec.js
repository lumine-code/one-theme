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
  return resolvedColor(`var(${variable})`);
}

function resolvedColor(value) {
  const probe = document.createElement("span");
  probe.style.color = value;
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

function rgbaOf(color) {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, 1, 1);
  context.fillStyle = color;
  context.fillRect(0, 0, 1, 1);
  return Array.from(context.getImageData(0, 0, 1, 1).data, (channel) => channel / 255);
}

function contrastRatio(foreground, background) {
  const luminanceOf = (channels) => {
    const linear = channels.map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    );
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  };

  const foregroundChannels = rgbaOf(foreground);
  const backgroundChannels = rgbaOf(background);
  const compositedForeground = foregroundChannels
    .slice(0, 3)
    .map(
      (channel, index) =>
        channel * foregroundChannels[3] + backgroundChannels[index] * (1 - foregroundChannels[3]),
    );
  const luminances = [luminanceOf(compositedForeground), luminanceOf(backgroundChannels)].sort(
    (a, b) => b - a,
  );
  return (luminances[0] + 0.05) / (luminances[1] + 0.05);
}

describe("one-theme", () => {
  afterEach(async () => {
    lumine.config.unset("one-theme.tabSizing");
    lumine.config.unset("one-theme.tabCloseButton");
    lumine.config.unset("one-theme.hideDockButtons");
    await lumine.packages.deactivatePackage("one-day-ui");
    await lumine.packages.deactivatePackage("one-day-syntax");
    await lumine.packages.deactivatePackage("one-night-ui");
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

  it("limits minimum-sized tabs more tightly inside docks", async () => {
    await lumine.packages.activatePackage("one-theme");
    await lumine.packages.activatePackage("one-day-ui");
    lumine.config.set("one-theme.tabSizing", "Minimum");

    const dock = document.createElement("lumine-dock");
    const tabBar = document.createElement("ul");
    tabBar.className = "tab-bar";
    const tab = document.createElement("li");
    tab.className = "tab";
    tab.style.fontSize = "10px";
    tabBar.appendChild(tab);
    dock.appendChild(tabBar);
    document.body.appendChild(dock);

    expect(getComputedStyle(tab).maxWidth).toBe("140px");
    dock.remove();
  });

  it("takes semantic highlight foregrounds from the UI palette", async () => {
    await lumine.packages.activatePackage("one-theme");
    await lumine.packages.activatePackage("one-day-ui");

    const fixture = document.createElement("div");
    document.body.appendChild(fixture);
    const highlights = [
      ["info", "rgb(1, 2, 3)"],
      ["warning", "rgb(4, 5, 6)"],
      ["error", "rgb(7, 8, 9)"],
      ["success", "rgb(10, 11, 12)"],
    ];

    for (const [kind, color] of highlights) {
      fixture.style.setProperty(`--text-color-on-${kind}`, color);
      const highlight = document.createElement("span");
      highlight.className = `highlight-${kind}`;
      fixture.appendChild(highlight);
      expect(getComputedStyle(highlight).color).toBe(color);
    }

    fixture.remove();
  });

  it("keeps semantic highlight foregrounds readable in both variants", async () => {
    await lumine.packages.activatePackage("one-theme");

    for (const themeName of ["one-day-ui", "one-night-ui"]) {
      await lumine.packages.activatePackage(themeName);
      const fixture = document.createElement("div");
      document.body.appendChild(fixture);

      for (const kind of ["info", "warning", "error", "success"]) {
        const highlight = document.createElement("span");
        highlight.className = `highlight-${kind}`;
        fixture.appendChild(highlight);
        const style = getComputedStyle(highlight);
        expect(contrastRatio(style.color, style.backgroundColor)).toBeGreaterThanOrEqual(4.5);
      }

      fixture.remove();
      await lumine.packages.deactivatePackage(themeName);
    }
  });

  it("keeps accent surfaces, buttons, and inactive tabs readable in both variants", async () => {
    await lumine.packages.activatePackage("one-theme");

    for (const themeName of ["one-day-ui", "one-night-ui"]) {
      await lumine.packages.activatePackage(themeName);

      for (const [foreground, background] of [
        ["--accent-text-color", "--accent-color"],
        ["--accent-bg-text-color", "--accent-bg-color"],
        ["--tooltip-text-color", "--tooltip-background-color"],
      ]) {
        expect(contrastRatio(colorOf(foreground), colorOf(background))).toBeGreaterThanOrEqual(4.5);
      }

      const primary = document.createElement("button");
      primary.className = "btn btn-primary";
      document.body.appendChild(primary);
      const primaryColor = getComputedStyle(primary).color;
      expect(
        contrastRatio(
          primaryColor,
          resolvedColor("hsl(from var(--accent-bg-color) h s calc(l + 2))"),
        ),
      ).toBeGreaterThanOrEqual(4.5);
      primary.remove();

      for (const kind of ["info", "success", "warning", "error"]) {
        const button = document.createElement("button");
        button.className = `btn btn-${kind}`;
        document.body.appendChild(button);
        const foreground = getComputedStyle(button).color;
        const background = `--background-color-${kind}`;
        const hoverShift = themeName === "one-night-ui" && kind === "error" ? -3 : 5;

        for (const expression of [
          `hsl(from var(${background}) h s calc(l + 2))`,
          `hsl(from var(${background}) h s calc(l ${hoverShift < 0 ? "-" : "+"} ${Math.abs(
            hoverShift,
          )}))`,
        ]) {
          expect(contrastRatio(foreground, resolvedColor(expression))).toBeGreaterThanOrEqual(4.5);
        }
        button.remove();
      }

      const tabBar = document.createElement("ul");
      tabBar.className = "tab-bar";
      const tab = document.createElement("li");
      tab.className = "tab";
      tabBar.appendChild(tab);
      document.body.appendChild(tabBar);
      const tabStyle = getComputedStyle(tab);
      expect(contrastRatio(tabStyle.color, tabStyle.backgroundColor)).toBeGreaterThanOrEqual(4.5);
      tabBar.remove();

      await lumine.packages.deactivatePackage(themeName);
    }
  });

  it("uses the same readable selected-button foreground inside and outside groups", async () => {
    await lumine.packages.activatePackage("one-theme");

    for (const themeName of ["one-day-ui", "one-night-ui"]) {
      await lumine.packages.activatePackage(themeName);

      for (const variant of ["default", "primary", "info", "success", "warning", "error"]) {
        const standalone = document.createElement("button");
        standalone.className = `btn btn-${variant} selected`;
        const group = document.createElement("div");
        group.className = "btn-group";
        const grouped = standalone.cloneNode();
        group.appendChild(grouped);
        document.body.append(standalone, group);

        const standaloneStyle = getComputedStyle(standalone);
        const groupedStyle = getComputedStyle(grouped);
        expect(groupedStyle.color).toBe(standaloneStyle.color);
        expect(
          contrastRatio(standaloneStyle.color, standaloneStyle.backgroundColor),
        ).toBeGreaterThanOrEqual(4.5);
        expect(
          contrastRatio(groupedStyle.color, groupedStyle.backgroundColor),
        ).toBeGreaterThanOrEqual(4.5);

        standalone.remove();
        group.remove();
      }

      await lumine.packages.deactivatePackage(themeName);
    }
  });

  it("inherits a dropdown caret's color from its context", async () => {
    await lumine.packages.activatePackage("one-theme");
    await lumine.packages.activatePackage("one-day-ui");

    const button = document.createElement("button");
    button.style.color = "rgb(1, 2, 3)";
    const caret = document.createElement("span");
    caret.className = "caret";
    button.appendChild(caret);
    document.body.appendChild(button);

    expect(getComputedStyle(caret).borderTopColor).toBe("rgb(1, 2, 3)");
    button.remove();
  });

  it("defines complete and symmetric git-status colors", async () => {
    await lumine.packages.activatePackage("one-theme");

    for (const themeName of ["one-day-ui", "one-night-ui"]) {
      await lumine.packages.activatePackage(themeName);
      expect(colorOf("--text-color-conflicted")).toBe(colorOf("--text-color-removed"));
      expect(rgbaOf(colorOf("--tab-inactive-status-conflicted"))[3]).toBeCloseTo(
        rgbaOf(colorOf("--tab-inactive-status-added"))[3],
        2,
      );
      await lumine.packages.deactivatePackage(themeName);
    }
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

  it("gives both syntax themes the same rule sheets", async () => {
    await lumine.packages.activatePackage("one-theme");

    const sharedDir = path.join("one-theme", "styles", "syntax") + path.sep;
    const rulesFor = (themeName) =>
      lumine.packages
        .getLoadedPackage(themeName)
        .getStylesheetPaths()
        .filter((stylePath) => stylePath.includes(sharedDir));

    const dayRules = rulesFor("one-day-syntax");

    expect(dayRules.length).toBeGreaterThan(1);
    expect(dayRules).toEqual(rulesFor("one-night-syntax"));
    // Numbered, because the cascade depends on the order they load in: the
    // current scope vocabulary corrects the legacy one, not the other way round.
    expect(dayRules.map((stylePath) => path.basename(stylePath))).toEqual(
      [...dayRules.map((stylePath) => path.basename(stylePath))].sort(),
    );
  });

  it("scopes the syntax rules to the editor without saying so in a file name", async () => {
    await lumine.packages.activatePackage("one-theme");
    await lumine.packages.activatePackage("one-day-syntax");

    // A syntax theme's stylesheets get the lumine-text-editor context from the
    // theme's own type, so markdown-preview and anything else harvesting that
    // context still finds them. Nothing depends on the *.lumine-text-editor.css
    // spelling here, and no file uses it.
    const harvester = document.createElement("lumine-styles");
    harvester.initialize(lumine.styles);
    harvester.setAttribute("context", "lumine-text-editor");
    document.body.appendChild(harvester);
    const harvested = Array.from(harvester.childNodes)
      .map((styleElement) => styleElement.textContent)
      .join("\n");
    harvester.remove();

    expect(harvested).toContain(".syntax--keyword");
    expect(harvested).toContain("--syntax-symbolic-color");

    const names = lumine.packages
      .getLoadedPackage("one-day-syntax")
      .getStylesheetPaths()
      .map((stylePath) => path.basename(stylePath));
    expect(names.filter((name) => name.includes(".lumine-text-editor."))).toEqual([]);
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

  it("keeps semantic string and comment colors aligned with rendered tokens", async () => {
    await lumine.packages.activatePackage("one-theme");

    for (const themeName of ["one-day-syntax", "one-night-syntax"]) {
      await lumine.packages.activatePackage(themeName);
      expect(colorOfToken(["syntax--string"])).toBe(colorOf("--syntax-color-string"));
      expect(colorOfToken(["syntax--comment"])).toBe(colorOf("--syntax-color-comment"));
      await lumine.packages.deactivatePackage(themeName);
    }
  });

  it("derives readable illegal-token text from the syntax error color", async () => {
    await lumine.packages.activatePackage("one-theme");

    for (const themeName of ["one-day-syntax", "one-night-syntax"]) {
      await lumine.packages.activatePackage(themeName);
      const token = document.createElement("span");
      token.className = "syntax--invalid syntax--illegal";
      document.body.appendChild(token);
      const style = getComputedStyle(token);
      expect(contrastRatio(style.color, style.backgroundColor)).toBeGreaterThanOrEqual(4.5);
      token.remove();
      await lumine.packages.deactivatePackage(themeName);
    }
  });

  it("overlays the cursor tint without replacing decoration backgrounds", async () => {
    await lumine.packages.activatePackage("one-theme");
    const decorationStyles = lumine.styles.addStyleSheet(
      "lumine-text-editor .navigation-marker { background: rgb(12, 34, 56); }",
      { priority: 0 },
    );

    const cursorLineStyle = async (themeName) => {
      await lumine.packages.activatePackage(themeName);
      const editor = document.createElement("lumine-text-editor");
      const line = document.createElement("div");
      line.className = "line cursor-line navigation-marker";
      editor.appendChild(line);
      document.body.appendChild(editor);
      const style = getComputedStyle(line);
      const result = {
        backgroundColor: style.backgroundColor,
        boxShadow: style.boxShadow,
      };
      editor.remove();
      await lumine.packages.deactivatePackage(themeName);
      return result;
    };

    try {
      // The shadow is semi-transparent in both, so line decorations and highlight
      // layers remain visible underneath it. A relative color computes to
      // color(srgb r g b / a) rather than rgba().
      for (const themeName of ["one-day-syntax", "one-night-syntax"]) {
        const { backgroundColor, boxShadow } = await cursorLineStyle(themeName);
        const shadowColor = boxShadow.slice(0, boxShadow.indexOf(")") + 1);
        const alpha = /[,/]\s*([\d.]+)\s*\)$/.exec(shadowColor);
        expect(backgroundColor).toBe("rgb(12, 34, 56)");
        expect(alpha).not.toBeNull();
        expect(Number(alpha[1])).toBeLessThan(0.2);
      }
    } finally {
      decorationStyles.dispose();
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

  // A tile is the element a bar stamps its own class on. `.inline-block` is a
  // layout utility packages also use *inside* a tile for a row of labels, so
  // styling that instead gives the nesting the tile's padding and a second
  // hover rectangle inset within the tile's own.
  it("styles a bar's tile and never a block nested inside one", async () => {
    await lumine.packages.activatePackage("one-theme");
    await lumine.packages.activatePackage("one-day-ui");

    const statusBar = document.createElement("div");
    statusBar.className = "status-bar";
    const panel = document.createElement("div");
    panel.className = "status-bar-left";
    const tile = document.createElement("div");
    tile.className = "status-bar-item";
    const nested = document.createElement("a");
    nested.className = "inline-block";
    tile.appendChild(nested);
    panel.appendChild(tile);
    statusBar.appendChild(panel);
    document.body.appendChild(statusBar);

    expect(getComputedStyle(tile).paddingLeft).toBe("9px");
    expect(getComputedStyle(tile).paddingRight).toBe("9px");
    expect(getComputedStyle(nested).paddingLeft).toBe("0px");
    expect(getComputedStyle(nested).paddingRight).toBe("0px");

    // The panel owns the space between tiles, so a tile carries no margin and
    // the utility's own is not wanted anywhere in a one-line strip.
    expect(getComputedStyle(panel).gap).toBe("0px");
    expect(getComputedStyle(nested).marginRight).toBe("0px");
    statusBar.remove();

    const titleBar = document.createElement("div");
    titleBar.className = "title-bar";
    const controlTiles = document.createElement("div");
    controlTiles.className = "control-tiles";
    const controlTile = document.createElement("button");
    controlTile.className = "title-bar-item";
    const controlNested = document.createElement("span");
    controlNested.className = "inline-block";
    controlTile.appendChild(controlNested);
    controlTiles.appendChild(controlTile);
    titleBar.appendChild(controlTiles);
    document.body.appendChild(titleBar);

    // The package supplies the control tile's box; the theme supplies its
    // colour. Pin the variable it reads rather than a palette value.
    titleBar.style.setProperty("--text-color-subtle", "rgb(1, 2, 3)");
    expect(getComputedStyle(controlTile).color).toBe("rgb(1, 2, 3)");
    titleBar.remove();
  });
});
