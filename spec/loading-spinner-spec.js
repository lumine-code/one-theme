describe("loading spinners", () => {
  for (const theme of ["one-day-ui", "one-night-ui"]) {
    it(`keeps animated rings inside every spinner size in ${theme}`, async () => {
      await lumine.packages.activatePackage("one-theme");
      await lumine.packages.activatePackage(theme);
      const fixture = document.createElement("div");
      document.body.appendChild(fixture);
      try {
        for (const [size, pixels] of [
          ["tiny", 16],
          ["small", 32],
          ["medium", 48],
          ["large", 64],
        ]) {
          // An exact-size scroll container catches transform overflow even
          // when surrounding content would otherwise hide the scrollbar.
          fixture.style.cssText = `position:fixed;top:0;left:0;width:${pixels}px;height:${pixels}px;overflow:auto`;
          const spinner = document.createElement("span");
          spinner.className = `loading-spinner-${size}`;
          fixture.replaceChildren(spinner);
          const bounds = spinner.getBoundingClientRect().toJSON();
          expect(bounds.width).toBe(pixels);
          expect(bounds.height).toBe(pixels);
          const animations = spinner.getAnimations({ subtree: true });
          expect(animations.length).toBe(2);
          for (const animation of animations) animation.pause();

          for (let time = 0; time <= 1200; time += 75) {
            for (const animation of animations) animation.currentTime = time;
            expect(fixture.scrollWidth).toBe(pixels);
            expect(fixture.scrollHeight).toBe(pixels);
            expect(fixture.clientWidth).toBe(pixels);
            expect(fixture.clientHeight).toBe(pixels);
            expect(spinner.getBoundingClientRect().toJSON()).toEqual(bounds);
          }
        }
      } finally {
        fixture.remove();
        await lumine.packages.deactivatePackage(theme);
        await lumine.packages.deactivatePackage("one-theme");
      }
    });
  }
});
