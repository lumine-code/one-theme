const { CompositeDisposable } = require("lumine");

let subscriptions = null;
let workspace = null;

module.exports = {
  activate() {
    // These settings govern tabs and docks, all of which belong to the
    // workspace. Keeping their attributes there avoids leaking theme state
    // onto the document root and into UI mounted outside the workspace.
    workspace = lumine.views.getView(lumine.workspace);
    subscriptions = new CompositeDisposable(
      lumine.config.observe("one-theme.tabSizing", (tabSizing) => {
        workspace.setAttribute("ui-tabsizing", tabSizing.toLowerCase());
      }),
      lumine.config.observe("one-theme.tabCloseButton", (tabCloseButton) => {
        if (tabCloseButton === "Left") {
          workspace.setAttribute("ui-tab-close-button", "left");
        } else {
          workspace.removeAttribute("ui-tab-close-button");
        }
      }),
      lumine.config.observe("one-theme.hideDockButtons", (hideDockButtons) => {
        if (hideDockButtons) {
          workspace.setAttribute("ui-dock-buttons", "hidden");
        } else {
          workspace.removeAttribute("ui-dock-buttons");
        }
      }),
    );
  },

  deactivate() {
    subscriptions?.dispose();
    subscriptions = null;
    workspace?.removeAttribute("ui-tabsizing");
    workspace?.removeAttribute("ui-tab-close-button");
    workspace?.removeAttribute("ui-dock-buttons");
    workspace = null;
  },
};
