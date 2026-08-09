const path = require("path");

const root = document.documentElement;

describe("one-theme", () => {
  afterEach(async () => {
    await lumine.packages.deactivatePackage("one-day-ui");
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
    const configPath = uiPaths.find((stylePath) => path.basename(stylePath) === "26-config.css");

    expect(configPath).toContain(path.join("one-theme", "styles", "one-ui"));
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
