const path = require("path");

const packageRoot = path.resolve(__dirname, "..");

function resolvedColor(container, value) {
  const probe = document.createElement("span");
  probe.style.color = value;
  container.appendChild(probe);
  const result = getComputedStyle(probe).color;
  probe.remove();
  return result;
}

describe("One pane item tab content connection", () => {
  let bars;

  beforeEach(async () => {
    jasmine.useRealClock();
    bars = [];
    lumine.config.set("core.destroyEmptyPanes", false);
    jasmine.attachToDOM(lumine.workspace.getElement());
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
    it(`closes only a standard tab whose active item root opts in in ${mode}`, async () => {
      await lumine.packages.activatePackage(`one-${mode}-ui`);
      for (const [location, container] of Object.entries({
        center: lumine.workspace.getCenter(),
        left: lumine.workspace.getLeftDock(),
        right: lumine.workspace.getRightDock(),
        bottom: lumine.workspace.getBottomDock(),
      })) {
        const pane = container.getActivePane();
        const inactiveRoot = document.createElement("div");
        inactiveRoot.className = "tab-content-separated";
        inactiveRoot.canCopy = () => false;
        inactiveRoot.getAllowedLocations = () => [location];
        const activeRoot = document.createElement("div");
        activeRoot.canCopy = () => false;
        activeRoot.getAllowedLocations = () => [location];
        activeRoot.innerHTML = '<div class="tab-content-separated" data-active-pane-item></div>';
        pane.addItem(inactiveRoot);
        pane.addItem(activeRoot);
        pane.activateItem(activeRoot);
        expect(activeRoot.hasAttribute("data-active-pane-item")).toBeTrue();
        expect(inactiveRoot.hasAttribute("data-active-pane-item")).toBeFalse();
        const bar = document.createElement("ul");
        bar.className = "tab-bar";
        bar.setAttribute("location", location);
        pane.getElement().insertBefore(bar, pane.getElement().firstChild);
        bars.push(bar);

        try {
          for (const occupied of [false, true]) {
            bar.classList.toggle("is-fully-occupied", occupied);
            for (const activeIndex of [0, 1, 2, null]) {
              const count = activeIndex === null ? 1 : 3;
              bar.replaceChildren(
                ...Array.from({ length: count }, (_, index) => {
                  const tab = document.createElement("li");
                  tab.className = index === (activeIndex ?? 0) ? "tab active" : "tab";
                  tab.innerHTML = '<span class="title">Panel</span>';
                  return tab;
                }),
              );
              const activeTab = bar.querySelector(".tab.active");
              const context = `${location}, occupied=${occupied}, tab=${activeIndex ?? "only"}`;
              const edge = () => getComputedStyle(activeTab).boxShadow;
              const closedEdge =
                `${resolvedColor(bar, "var(--tab-border-color)")} 0px -1px 0px 0px inset` +
                (activeTab === bar.lastElementChild
                  ? `, ${resolvedColor(bar, "var(--base-border-color)")} 1px 0px 0px 0px`
                  : "");
              const openEdge = edge();
              const geometry = () => {
                const style = getComputedStyle(activeTab);
                return [style.height, style.lineHeight, style.borderBottomWidth, style.marginTop];
              };
              const openGeometry = geometry();
              const marker = getComputedStyle(activeTab, "::before").backgroundColor;
              expect(openEdge).withContext(context).not.toBe(closedEdge);

              activeRoot.classList.add("tab-content-separated");
              expect(edge()).withContext(context).toBe(closedEdge);
              expect(geometry()).withContext(context).toEqual(openGeometry);
              expect(getComputedStyle(activeTab, "::before").backgroundColor)
                .withContext(context)
                .toBe(marker);

              // Only an immediate active item root can opt in.
              activeRoot.removeAttribute("data-active-pane-item");
              expect(edge()).withContext(context).toBe(openEdge);
              activeRoot.setAttribute("data-active-pane-item", "");
              expect(edge()).withContext(context).toBe(closedEdge);
              activeRoot.classList.remove("tab-content-separated");
              expect(edge()).withContext(context).toBe(openEdge);

              bar.classList.add("icons-only");
              const iconEdge = edge();
              activeRoot.classList.add("tab-content-separated");
              expect(edge()).withContext(context).toBe(iconEdge);
              activeRoot.classList.remove("tab-content-separated");
              bar.classList.remove("icons-only");
            }
          }
        } finally {
          bar.remove();
          pane.removeItem(activeRoot);
          pane.removeItem(inactiveRoot);
        }
      }
    });
  }
});
