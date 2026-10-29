const { ipcRenderer } = require("electron");

const classes = [
  "btn",
  "btn btn-default",
  "btn btn-primary",
  "btn btn-info",
  "btn btn-success",
  "btn btn-warning",
  "btn btn-error",
  "btn selected",
  "btn active",
  "btn focus",
];

async function settle() {
  for (let i = 0; i < 2; i++) {
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
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
}

async function tab(backwards = false) {
  for (const type of ["keyDown", "keyUp"]) {
    await ipcRenderer.invoke("lumine:window", "sendInputEvent", {
      type,
      keyCode: "Tab",
      modifiers: backwards ? ["shift"] : [],
    });
  }
  await settle();
}

describe("one-theme button focus indication", () => {
  afterEach(async () => {
    for (const mode of ["day", "night"]) {
      await lumine.packages.deactivatePackage(`one-${mode}-ui`);
    }
    await lumine.packages.deactivatePackage("one-theme");
  });

  for (const mode of ["day", "night"]) {
    it(`preserves pointer focus and reserves button rings for keyboard navigation in ${mode}`, async () => {
      jasmine.useRealClock();
      await lumine.packages.activatePackage("one-theme");
      await lumine.packages.activatePackage(`one-${mode}-ui`);
      const fixture = document.createElement("div");
      fixture.style.cssText =
        "position:fixed;left:20px;top:40px;width:400px;padding:20px;z-index:100000;background:var(--base-background-color)";
      const previous = document.createElement("button");
      previous.textContent = "Previous";
      const container = document.createElement("div");
      fixture.append(previous, container);
      document.body.appendChild(fixture);
      try {
        for (const context of ["", "btn-group", "panel-heading"]) {
          container.className = context;
          for (const className of classes) {
            const button = document.createElement("button");
            button.className = className;
            button.textContent = "Action";
            container.appendChild(button);
            const resting = getComputedStyle(button);
            const restingShadow = resting.boxShadow;
            const restingBorder = resting.borderTopColor;
            await mouse("mouseMove", button);
            await mouse("mouseDown", button);
            await mouse("mouseUp", button);
            await mouse("mouseMove", previous);
            await settle();
            const label = `${context || "standalone"} ${className}`;
            expect(document.activeElement).withContext(label).toBe(button);
            expect(button.matches(":focus-visible")).withContext(label).toBe(false);
            const pointer = getComputedStyle(button);
            expect(pointer.outlineStyle).withContext(label).toBe("none");
            expect(pointer.boxShadow).withContext(label).toBe(restingShadow);
            expect(pointer.borderTopColor).withContext(label).toBe(restingBorder);
            await tab(true);
            expect(document.activeElement).withContext(label).toBe(previous);
            await tab();
            expect(document.activeElement).withContext(label).toBe(button);
            expect(button.matches(":focus-visible")).withContext(label).toBe(true);
            const keyboard = getComputedStyle(button);
            expect(keyboard.boxShadow !== restingShadow || keyboard.outlineStyle !== "none")
              .withContext(label)
              .toBe(true);
            expect(button.classList.contains("selected"))
              .withContext(label)
              .toBe(className.includes("selected"));
            button.remove();
          }
        }
      } finally {
        fixture.remove();
      }
    }, 30000);
  }
});
