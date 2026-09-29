// @vitest-environment jsdom

import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SidebarProvider, useSidebar } from "./SidebarContext";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

let capturedValue: ReturnType<typeof useSidebar> | null = null;

function Capture() {
  capturedValue = useSidebar();
  return null;
}

function act(callback: () => void) {
  flushSync(callback);
}

function renderProvider(): { root: Root; host: HTMLDivElement } {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  act(() => {
    root.render(
      <SidebarProvider>
        <Capture />
      </SidebarProvider>,
    );
  });
  return { root, host };
}

describe("SidebarContext", () => {
  let active: { root: Root; host: HTMLDivElement } | null = null;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("paperclip.sidebar.collapsed", "1");
    capturedValue = null;
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      writable: true,
      value: 1280,
    });
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    if (active) {
      act(() => active!.root.unmount());
      active.host.remove();
      active = null;
    }
    localStorage.clear();
  });

  it("migrates legacy collapsed state and persists the Auro navigation preference", () => {
    active = renderProvider();

    expect(capturedValue?.collapsed).toBe(true);
    expect(capturedValue?.collapseLocked).toBe(false);
    expect(capturedValue?.peeking).toBe(false);
    expect(localStorage.getItem("auro.sidebar.collapsed")).toBe("1");
    expect(localStorage.getItem("paperclip.sidebar.collapsed")).toBeNull();

    act(() => capturedValue?.toggleCollapsed());
    expect(capturedValue?.collapsed).toBe(false);
    expect(localStorage.getItem("auro.sidebar.collapsed")).toBe("0");
  });

  it("combines the saved collapse preference with route and contextual requests", () => {
    active = renderProvider();

    act(() => capturedValue?.setCollapsed(false));
    expect(capturedValue?.collapsed).toBe(false);

    act(() => capturedValue?.setRouteRequestsCollapsed(true));
    expect(capturedValue?.collapsed).toBe(true);

    act(() => capturedValue?.setRouteRequestsCollapsed(false));
    act(() => capturedValue?.setForceCollapsed(true));
    expect(capturedValue?.collapsed).toBe(true);

    act(() => capturedValue?.setForceCollapsed(false));
    act(() => capturedValue?.setPeeking(true));
    expect(capturedValue?.peeking).toBe(true);

    expect(capturedValue?.collapsed).toBe(false);
    expect(capturedValue?.collapseLocked).toBe(false);
    expect(capturedValue?.routeRequestsCollapsed).toBe(false);
  });

  it("retains sidebarOpen and toggleSidebar for the mobile drawer", () => {
    active = renderProvider();
    const initial = capturedValue?.sidebarOpen;

    act(() => capturedValue?.toggleSidebar());

    expect(capturedValue?.sidebarOpen).toBe(!initial);
  });
});
