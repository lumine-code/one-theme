const path = require("path");

const packageRoot = path.resolve(__dirname, "..");

function resolvedColor(container, value) {
  const probe = document.createElement("span");
  probe.style.color = value;
  container.appendChild(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color;
}

function paneItem(title, location) {
  const element = document.createElement("div");
  element.tabIndex = -1;
  const firstInput = document.createElement("input");
  const secondInput = document.createElement("input");
  firstInput.setAttribute("aria-label", `${title} first input`);
  secondInput.setAttribute("aria-label", `${title} second input`);
  element.append(firstInput, secondInput);
  return {
    element,
    firstInput,
    secondInput,
    canCopy: () => false,
    getAllowedLocations: () => [location],
    getTitle: () => title,
  };
}

describe("One focused dock icon colors", () => {
  let bars;

  beforeEach(async () => {
    jasmine.useRealClock();
    bars = [];
    jasmine.attachToDOM(lumine.workspace.getElement());
    lumine.config.set("theme.accentSource", "theme");
    await lumine.packages.activatePackage(packageRoot);
  });

  afterEach(async () => {
    for (const bar of bars) bar.remove();
    for (const mode of ["day", "night"]) {
      await lumine.packages.deactivatePackage(`one-${mode}-ui`);
    }
    await lumine.packages.deactivatePackage("one-theme");
  });

  for (const mode of ["day", "night"]) {
    it(`accents only the selected icon while its pane contains focus in ${mode}`, async () => {
      await lumine.packages.activatePackage(`one-${mode}-ui`);
      const centerPane = lumine.workspace.getCenter().getActivePane();
      const centerItem = paneItem("Center document", "center");
      centerPane.addItem(centerItem);
      for (const [location, dock] of Object.entries({
        left: lumine.workspace.getLeftDock(),
        right: lumine.workspace.getRightDock(),
        bottom: lumine.workspace.getBottomDock(),
      })) {
        const pane = dock.getActivePane();
        const item = paneItem("Selected panel", location);
        pane.addItem(item);
        pane.activateItem(item);
        dock.show();
        const bar = document.createElement("ul");
        bar.className = "tab-bar icons-only";
        bar.setAttribute("location", location);
        bar.innerHTML =
          '<li class="tab"><span class="title icon icon-tools"></span></li><li class="tab active"><span class="title icon icon-tools"></span></li>';
        pane.getElement().insertBefore(bar, pane.getElement().firstChild);
        bars.push(bar);
        const inactive = bar.querySelector(".tab:not(.active) .title");
        const selected = bar.querySelector(".tab.active .title");
        const accent = resolvedColor(bar, "var(--accent-indicator-color)");
        const neutralSelected = resolvedColor(bar, "var(--tab-text-color-active)");
        const neutralInactive = resolvedColor(bar, "var(--tab-text-color)");

        centerPane.activateItem(centerItem, { activatePane: true });
        centerItem.firstInput.focus();
        expect(pane.getElement().matches(":focus-within")).withContext(location).toBeFalse();
        expect(getComputedStyle(selected).color).withContext(location).toBe(neutralSelected);
        expect(getComputedStyle(selected).color).withContext(location).not.toBe(accent);
        expect(getComputedStyle(inactive).color).withContext(location).toBe(neutralInactive);

        item.firstInput.focus();
        expect(pane.getElement().matches(":focus-within")).withContext(location).toBeTrue();
        expect(getComputedStyle(selected).color).withContext(location).toBe(accent);
        expect(getComputedStyle(inactive).color).withContext(location).toBe(neutralInactive);
        expect(pane.getActiveItem()).withContext(location).toBe(item);

        item.secondInput.focus();
        expect(document.activeElement).withContext(location).toBe(item.secondInput);
        expect(getComputedStyle(selected).color).withContext(location).toBe(accent);

        centerItem.firstInput.focus();
        expect(pane.getActiveItem()).withContext(location).toBe(item);
        expect(getComputedStyle(selected).color).withContext(location).toBe(neutralSelected);
        expect(getComputedStyle(inactive).color).withContext(location).toBe(neutralInactive);

        bar.classList.remove("icons-only");
        const titleColor = getComputedStyle(selected).color;
        expect(titleColor).withContext(location).toBe(neutralSelected);
        item.firstInput.focus();
        expect(getComputedStyle(selected).color).withContext(location).toBe(titleColor);
        centerItem.firstInput.focus();
        expect(getComputedStyle(selected).color).withContext(location).toBe(titleColor);
      }
    });
  }
});
