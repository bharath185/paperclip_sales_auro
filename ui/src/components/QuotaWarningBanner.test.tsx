// @vitest-environment jsdom

import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { QuotaWarningBanner } from "./QuotaWarningBanner";
import React from "react";

describe("QuotaWarningBanner", () => {
  let container: HTMLDivElement | null = null;
  let root: ReturnType<typeof createRoot> | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    if (root) {
      flushSync(() => {
        root!.unmount();
      });
    }
    container?.remove();
    container = null;
    root = null;
  });

  it("renders nothing when usage is below threshold (<80%)", () => {
    flushSync(() => {
      root!.render(<QuotaWarningBanner percentUsed={75} threshold={80} />);
    });
    expect(container!.querySelector('[data-testid="quota-warning-banner"]')).toBeNull();
  });

  it("renders warning banner when usage reaches 80%", () => {
    flushSync(() => {
      root!.render(<QuotaWarningBanner percentUsed={80} threshold={80} provider="OpenCode" />);
    });
    const banner = container!.querySelector('[data-testid="quota-warning-banner"]');
    expect(banner).not.toBeNull();
    expect(banner!.textContent).toContain("Quota Warning (80% Used)");
    expect(banner!.textContent).toContain("OpenCode usage has reached 80% of quota limit");
  });

  it("renders credentialLast4 suffix when provided", () => {
    flushSync(() => {
      root!.render(
        <QuotaWarningBanner
          percentUsed={85}
          threshold={80}
          provider="OpenCode"
          credentialLast4="9a4b"
        />,
      );
    });
    expect(container!.textContent).toContain("Key: ••••9a4b");
  });

  it("renders critical alert when usage exceeds 95%", () => {
    flushSync(() => {
      root!.render(<QuotaWarningBanner percentUsed={96} threshold={80} provider="Anthropic" />);
    });
    expect(container!.textContent).toContain("Critical Quota Alert (96% Used)");
  });
});
