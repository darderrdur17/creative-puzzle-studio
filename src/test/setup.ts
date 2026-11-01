import "@testing-library/jest-dom";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

/**
 * jsdom has no layout engine, so it does not implement scrolling. Framer
 * Motion calls `scrollTo` while measuring `popLayout` children in the game
 * tray, which floods the test output with "Not implemented" noise that is not
 * a failure and hides real ones. Nothing in the app scrolls programmatically,
 * so a no-op is faithful here.
 */
Object.defineProperty(window, "scrollTo", { writable: true, value: () => {} });
