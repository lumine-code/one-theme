const path = require("path");

function resolvedColor(container, value) {
  const probe = document.createElement("span");
  probe.style.color = value;
  container.appendChild(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color;
}

jasmine.describeWithDocumentFocus("One pane presentation focus markers", () => {
  let presentation, bar;

  beforeEach(async () => {
    jasmine.useRealClock();
    lumine.config.set("core.destroyEmptyPanes", false);
    lumine.config.set("theme.accentSource", "theme");
    const workspace = lumine.workspace.getElement();
    workspace.style.width = "800px";
    workspace.style.height = "500px";
    jasmine.attachToDOM(workspace);
    await lumine.packages.activatePackage(path.resolve(__dirname, ".."));
  });

  afterEach(async () => {
    presentation?.dispose();
    presentation = null;
    bar?.remove();
    for (const mode of ["day", "night"]) await lumine.packages.deactivatePackage(`one-${mode}-ui`);
    await lumine.packages.deactivatePackage("one-theme");
  });

  for (const mode of ["day", "night"]) {
    for (const split of [false, true]) {
      it(`keeps the ${split ? "split" : "root"} pane marker through presentation in ${mode}`, async () => {
        await lumine.packages.activatePackage(`one-${mode}-ui`);
        const container = lumine.workspace.getMainWindow().getEditorContainer();
        const pane = container.getActivePane();
        if (split) pane.splitRight({ activate: false });
        const input = document.createElement("input");
        input.canCopy = () => false;
        input.getAllowedLocations = () => ["center"];
        input.value = "Editable";
        pane.activateItem(input, { activatePane: true });
        bar = document.createElement("ul");
        bar.className = "tab-bar";
        bar.setAttribute("location", "center");
        bar.innerHTML = '<li class="tab active"><span class="title">Document</span></li>';
        pane.getElement().insertBefore(bar, pane.getElement().firstChild);
        const tab = bar.querySelector(".tab.active");
        const accent = resolvedColor(bar, "var(--accent-indicator-color)");
        const neutral = resolvedColor(
          bar,
          "color-mix(in srgb, var(--text-color) 33%, var(--tab-background-color-editor))",
        );
        const assertMarker = () => {
          const marker = getComputedStyle(tab, "::before");
          expect(marker.content).toBe('""');
          expect(marker.width).toBe("2px");
          expect(marker.backgroundColor).toBe(accent);
          expect(pane.getElement().classList.contains("active")).toBeTrue();
        };

        input.focus();
        assertMarker();
        presentation = container.presentPane(pane);
        expect(pane.getElement().parentElement).toBe(presentation.slot);
        expect(document.activeElement).toBe(input);
        assertMarker();
        const wasBlurred = document.body.classList.contains("is-blurred");
        document.body.classList.add("is-blurred");
        try {
          expect(document.activeElement).toBe(input);
          expect(pane.getElement().classList.contains("active")).toBeTrue();
          expect(getComputedStyle(tab, "::before").backgroundColor).toBe(neutral);
        } finally {
          document.body.classList.toggle("is-blurred", wasBlurred);
        }
        assertMarker();
        input.setSelectionRange(input.value.length, input.value.length);
        input.setRangeText(" document", input.selectionStart, input.selectionEnd, "end");
        expect(input.value).toBe("Editable document");
        expect(document.activeElement).toBe(input);
        assertMarker();

        const outside = document.createElement("button");
        jasmine.attachToDOM(outside);
        outside.focus();
        expect(getComputedStyle(tab, "::before").content).toBe('""');
        expect(getComputedStyle(tab, "::before").backgroundColor).toBe(neutral);
        input.focus();
        assertMarker();

        presentation.dispose();
        assertMarker();
        outside.remove();
      });
    }
  }
});
