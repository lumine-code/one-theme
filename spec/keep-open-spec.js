function appearance(panel) {
  const frame = getComputedStyle(panel);
  const card = getComputedStyle(panel, "::before");
  const list = getComputedStyle(panel.querySelector("ol.list-group"));
  return {
    border: ["Top", "Right", "Bottom", "Left"].map((side) => frame[`border${side}`]),
    cardRadius: card.borderRadius,
    listRadius: list.borderRadius,
    shadow: card.boxShadow,
  };
}

function resolvedShadow(panel, value) {
  const probe = document.createElement("div");
  probe.style.boxShadow = value;
  panel.appendChild(probe);
  try {
    return getComputedStyle(probe).boxShadow;
  } finally {
    probe.remove();
  }
}

async function toggleKeepOpen(model, panel, command) {
  const previous = appearance(panel).shadow;
  let transition;
  const subscription = model.onDidChangeKeepOpen(() => {
    transition = panel
      .getAnimations({ subtree: true })
      .find(
        (animation) =>
          animation.transitionProperty === "box-shadow" &&
          animation.effect.pseudoElement === "::before",
      );
    transition?.pause();
  });
  try {
    await model.runAction(command);
  } finally {
    subscription.dispose();
  }

  const card = getComputedStyle(panel, "::before");
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
    expect(transition).toBeUndefined();
    expect(card.transitionDuration).toBe("0s");
    return;
  }
  expect(transition).toBeDefined();
  expect(card.transitionProperty).toBe("box-shadow");
  if (!transition) return;
  const duration = transition.effect.getTiming().duration;
  expect(duration).toBeGreaterThan(0);
  transition.currentTime = duration / 2;
  const intermediate = appearance(panel).shadow;
  expect(intermediate).not.toBe(previous);
  transition.finish();
  await transition.finished;
  expect(intermediate).not.toBe(appearance(panel).shadow);
}

describe("one-theme keep-open modal shadow", () => {
  for (const theme of ["one-day-ui", "one-night-ui"]) {
    it(`tints and restores the existing shadow without changing borders or radii in ${theme}`, async () => {
      jasmine.useRealClock();
      jasmine.attachToDOM(lumine.workspace.getElement());
      await lumine.packages.activatePackage("one-theme");
      await lumine.packages.activatePackage(theme);
      const host = lumine.workspace.addSelectList({
        items: [{ id: "choice", name: "Choice" }],
        getItemId: (item) => item.id,
        search: { getFilterText: (item) => item.name },
        renderItem: (item) => ({ primary: item.name }),
      });
      try {
        await host.show();
        const model = host.getModel();
        const panel = host.getPanel().getElement();
        const normal = appearance(panel);
        expect(normal.cardRadius).toBe("9px");
        expect(normal.listRadius).toBe("6px");
        expect(normal.shadow).toBe(
          resolvedShadow(
            panel,
            "inset 0 0 0 1px var(--overlay-border-color), 0 4px 12px -4px rgba(0, 0, 0, 0.35), 0 20px 48px -12px rgba(0, 0, 0, 0.55)",
          ),
        );
        const action = model
          .getAvailableActions()
          .find(({ command }) => command === "select-list:toggle-keep-open");
        expect(action.context).toBe("dialog");
        expect(action.keystrokes).toEqual(["f12"]);

        await toggleKeepOpen(model, panel, action.command);
        const retained = appearance(panel);
        expect(model.isKeepOpen()).toBe(true);
        expect(host.isVisible()).toBe(true);
        expect(panel.hasAttribute("keep-open")).toBe(true);
        expect(getComputedStyle(panel).outlineStyle).toBe("none");
        expect(retained.border).toEqual(normal.border);
        expect(retained.cardRadius).toBe(normal.cardRadius);
        expect(retained.listRadius).toBe(normal.listRadius);
        expect(retained.shadow).not.toBe(normal.shadow);
        expect(retained.shadow).toBe(
          resolvedShadow(
            panel,
            "inset 0 0 0 1px var(--overlay-border-color), 0 4px 12px -4px color-mix(in srgb, var(--accent-indicator-color) 55%, transparent), 0 20px 48px -12px color-mix(in srgb, var(--accent-indicator-color) 45%, transparent)",
          ),
        );

        await toggleKeepOpen(model, panel, action.command);
        expect(model.isKeepOpen()).toBe(false);
        expect(panel.hasAttribute("keep-open")).toBe(false);
        expect(appearance(panel)).toEqual(normal);
      } finally {
        await host.destroy();
        await lumine.packages.deactivatePackage(theme);
        await lumine.packages.deactivatePackage("one-theme");
      }
    });
  }
});
