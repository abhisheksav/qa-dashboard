import '@testing-library/jest-dom/vitest'

// Seed an authenticated session before the app modules load, so the persisted
// auth store rehydrates as signed-in and route smoke tests reach the pages.
localStorage.setItem(
  'qa-dashboard-auth',
  JSON.stringify({
    state: { user: { email: 'abhishek@sav.money', name: 'Abhishek' } },
    version: 0,
  }),
)

if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia
}

if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}
