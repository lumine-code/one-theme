const path = require("path");
const { ipcRenderer } = require("electron");
const { name } = require("../package.json");

const family = name.replace(/-theme$/, "");
const paint = ["color", "backgroundColor", "backgroundImage", "boxShadow", "filter"];
const geometry = [
  "height",
  "lineHeight",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "borderRadius",
  "borderTopWidth",
  "fontSize",
];

async function settle() {
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

async function mouse(type, element) {
  const rect = element.getBoundingClientRect();
  await ipcRenderer.invoke("lumine:window", "sendInputEvent", {
    type,
    x: Math.round(rect.left + rect.width / 2),
    y: Math.round(rect.top + rect.height / 2),
    button: "left",
    clickCount: 1,
  });
  await settle();
}

function snapshot(element, properties) {
  const style = getComputedStyle(element);
  return Object.fromEntries(properties.map((property) => [property, style[property]]));
}

describe(`${name} accent controls`, () => {
  afterEach(async () => {
    for (const mode of ["day", "night"])
      await lumine.packages.deactivatePackage(`${family}-${mode}-ui`);
    await lumine.packages.deactivatePackage(name);
    await lumine.packages.deactivatePackage("status-bar");
  });

  for (const mode of ["day", "night"]) {
    it(`shares primary button paint and preserves status tile geometry in ${mode}`, async () => {
      jasmine.useRealClock();
      await lumine.packages.activatePackage(path.resolve(__dirname, ".."));
      await lumine.packages.activatePackage(`${family}-${mode}-ui`);
      await lumine.packages.activatePackage("status-bar");
      const fixture = document.createElement("div");
      fixture.style.cssText =
        "position:fixed;left:20px;top:40px;width:600px;padding:20px;z-index:100000;background:var(--base-background-color)";
      fixture.innerHTML =
        '<button>Previous</button><button class="btn btn-primary">Action</button><status-bar class="status-bar"><div class="flexbox-repaint-hack"><div class="status-bar-left"><status-bar-tile class="status-bar-item accent-control" tabindex="0" role="button">Action</status-bar-tile><status-bar-tile class="status-bar-item">Action</status-bar-tile></div></div></status-bar>';
      document.body.appendChild(fixture);
      const previous = fixture.querySelector("button");
      const button = fixture.querySelector(".btn-primary");
      const tile = fixture.querySelector(".accent-control");
      const normal = fixture.querySelector(".status-bar-item:not(.accent-control)");
      const expectedGeometry = snapshot(normal, geometry);
      const compare = (state) => {
        expect(snapshot(tile, paint)).withContext(state).toEqual(snapshot(button, paint));
        expect(snapshot(tile, geometry)).withContext(state).toEqual(expectedGeometry);
      };
      try {
        await mouse("mouseMove", previous);
        compare("resting");
        const states = {};
        for (const [label, element] of [
          ["button", button],
          ["tile", tile],
        ]) {
          await mouse("mouseMove", element);
          expect(element.matches(":hover")).withContext(label).toBe(true);
          states[`${label}Hover`] = snapshot(element, paint);
          await mouse("mouseDown", element);
          expect(element.matches(":active")).withContext(label).toBe(true);
          states[`${label}Active`] = snapshot(element, paint);
          await mouse("mouseMove", previous);
          await mouse("mouseUp", previous);
          element.blur();
        }
        expect(states.tileHover).withContext("hover").toEqual(states.buttonHover);
        expect(states.tileActive).withContext("active").toEqual(states.buttonActive);
        previous.focus();
        for (const element of [button, tile]) {
          for (const type of ["keyDown", "keyUp"])
            await ipcRenderer.invoke("lumine:window", "sendInputEvent", {
              type,
              keyCode: "Tab",
            });
          await settle();
          expect(document.activeElement).toBe(element);
          expect(element.matches(":focus-visible")).toBe(true);
        }
        const focusPaint = paint.filter((property) => property !== "boxShadow");
        const tileFocus = snapshot(tile, focusPaint);
        const ring = getComputedStyle(tile);
        expect(ring.outlineStyle).toBe("solid");
        expect(ring.outlineWidth).toBe("1px");
        expect(ring.outlineOffset).toBe("-1px");
        expect(ring.outlineColor).toBe(ring.color);
        expect(ring.outlineColor).not.toBe(ring.backgroundColor);
        button.focus();
        await settle();
        expect(tileFocus).withContext("keyboard focus").toEqual(snapshot(button, focusPaint));
        expect(snapshot(tile, geometry)).withContext("focused geometry").toEqual(expectedGeometry);
      } finally {
        fixture.remove();
      }
    }, 30000);
  }
});
