// @vitest-environment jsdom

import React from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GovernancePromptEditor } from "./GovernancePromptEditor";
import { governanceApi } from "@/api/governance";

vi.mock("@/api/governance", () => ({
  governanceApi: {
    getPrompts: vi.fn(),
    updatePrompt: vi.fn(),
  },
}));

function setNativeValue(element: HTMLElement, value: string) {
  const valueSetter = Object.getOwnPropertyDescriptor(element, "value")?.set;
  const prototype = Object.getPrototypeOf(element);
  const prototypeValueSetter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (prototypeValueSetter && valueSetter !== prototypeValueSetter) {
    prototypeValueSetter.call(element, value);
  } else if (valueSetter) {
    valueSetter.call(element, value);
  } else {
    (element as any).value = value;
  }
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("GovernancePromptEditor Component", () => {
  let container: HTMLDivElement | null = null;
  let root: ReturnType<typeof createRoot> | null = null;

  const mockPrompts = {
    ceo: { role: "ceo", title: "Chief Executive Officer", content: "# CEO System Prompt\nStrategic decomposition" },
    cto: { role: "cto", title: "Chief Technology Officer", content: "# CTO System Prompt\nArchitecture design" },
    pm: { role: "pm", title: "Product Manager", content: "# PM System Prompt\nPRD and user stories" },
    qa: { role: "qa", title: "Quality Assurance Lead", content: "# QA System Prompt\nTest plan" },
    devops: { role: "devops", title: "DevOps Engineer", content: "# DevOps System Prompt\nInfra spec" },
    security: { role: "security", title: "Security Officer", content: "# Security System Prompt\nThreat model" },
  };

  beforeEach(() => {
    vi.clearAllMocks();
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

  it("loads and displays the default CEO prompt", async () => {
    vi.mocked(governanceApi.getPrompts).mockResolvedValue(mockPrompts);

    flushSync(() => {
      root!.render(<GovernancePromptEditor />);
    });

    await vi.waitFor(() => {
      expect(governanceApi.getPrompts).toHaveBeenCalled();
      const textarea = container!.querySelector("textarea");
      expect(textarea?.value).toContain("# CEO System Prompt");
    });

    expect(container!.textContent).toContain("Governance System Prompts Editor");
    expect(container!.textContent).toContain("prompts/governance/ceo.md");
  });

  it("switches tabs to view CTO prompt", async () => {
    vi.mocked(governanceApi.getPrompts).mockResolvedValue(mockPrompts);

    flushSync(() => {
      root!.render(<GovernancePromptEditor />);
    });

    await vi.waitFor(() => {
      expect(governanceApi.getPrompts).toHaveBeenCalled();
      const textarea = container!.querySelector("textarea");
      expect(textarea?.value).toContain("# CEO System Prompt");
    });

    const ctoButton = Array.from(container!.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("CTO"),
    );
    expect(ctoButton).toBeDefined();

    flushSync(() => {
      ctoButton!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await vi.waitFor(() => {
      const textarea = container!.querySelector("textarea");
      expect(textarea?.value).toContain("# CTO System Prompt");
    });

    expect(container!.textContent).toContain("prompts/governance/cto.md");
  });

  it("saves prompt edits via updatePrompt API", async () => {
    vi.mocked(governanceApi.getPrompts).mockResolvedValue(mockPrompts);
    vi.mocked(governanceApi.updatePrompt).mockResolvedValue({
      success: true,
      role: "ceo",
      content: "# Updated CEO Prompt",
    });

    flushSync(() => {
      root!.render(<GovernancePromptEditor />);
    });

    await vi.waitFor(() => {
      expect(governanceApi.getPrompts).toHaveBeenCalled();
    });

    const textarea = container!.querySelector("textarea");
    flushSync(() => {
      setNativeValue(textarea!, "# Updated CEO Prompt");
    });

    const saveButton = Array.from(container!.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Save Prompt"),
    );
    expect(saveButton).toBeDefined();

    flushSync(() => {
      saveButton!.click();
    });

    await vi.waitFor(() => {
      expect(governanceApi.updatePrompt).toHaveBeenCalledWith("ceo", "# Updated CEO Prompt");
    });
  });
});
