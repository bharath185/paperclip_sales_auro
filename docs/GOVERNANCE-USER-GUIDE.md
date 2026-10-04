# User Guide: Project Governance Organization

The **Project Governance Organization** coordinates a specialized C-Suite team of autonomous AI agents to transform strategic goals into an aligned, production-ready engineering document pack.

---

## 1. The Governance Agent Team

| Role | Default Model | Primary Responsibility | Key Deliverables |
| :--- | :--- | :--- | :--- |
| **CEO** | `deepseek/deepseek-v4-pro` | Strategic vision, business objectives, governance guidelines | `CHARTER.md`, `VISION.md` |
| **Product Manager (PM)** | `deepseek/deepseek-v4-pro` | Product requirements, user personas, sprint milestones | `PRD.md`, `ROADMAP.md`, `SPRINT-PLAN.md` |
| **Chief Technology Officer (CTO)** | `deepseek/deepseek-v4-pro` | Architecture design, system data flows, tech stack choices | `ARCHITECTURE.md`, `DATA-MODEL.md` |
| **Security Engineer** | `kimi/k2.7-code` | STRIDE threat modeling, authentication & authorization policies | `SECURITY-REVIEW.md`, `COMPLIANCE.md` |
| **QA Lead** | `deepseek/deepseek-v4-pro` | Test strategies, test automation plans, quality acceptance gates | `TEST-PLAN.md` |
| **DevOps Engineer** | `deepseek/deepseek-v4-pro` | CI/CD pipelines, container specifications, observability | `DEPLOYMENT-GUIDE.md`, `OBSERVABILITY.md` |

---

## 2. Using the Project Kickoff Wizard

1. Navigate to the **Governance** tab in the sidebar navigation.
2. Click **Start Project Kickoff**.
3. Fill in the strategic parameters:
   - **Project Name**: e.g., *Autonomous Supply Chain Analytics Engine*
   - **Strategic Vision**: High-level problem statement and expected market impact.
   - **Target Audience & Market**: Enterprise supply chain directors, factory managers.
   - **Key Constraints & Tech Stack**: TypeScript, PostgreSQL, Docker, AWS.
4. Click **Initialize Governance Agents & Generate Documents**.
5. The orchestration engine automatically provisions the 6 agents, assigns their respective system prompts, and triggers collaborative document synthesis.

---

## 3. Document Center & Interactive Editor

Once generated, all 12 project documents appear in the **Document Center**:

- **Real-Time Markdown & Mermaid Rendering**: View diagrams (architecture flows, state machines, entity relationships) dynamically rendered using token-compliant styling.
- **In-Browser Markdown Editor**: Edit any document directly with full syntax highlighting. Changes are automatically validated against XSS and stored with audit log timestamps.
- **Export Options**:
  - **Export Markdown Bundle**: Downloads a `.zip` archive containing all 12 markdown documents.
  - **Export Jira Sprint Backlog**: Exports tasks and user stories formatted for Jira bulk import.
  - **Export CSV**: Spreadsheet-compatible export with sanitized cells preventing formula injection (`=`, `@`, `+`, `-`).

---

## 4. Prompt Customization

To tailor agent behavior to your organization:
1. Navigate to **Governance > Prompt Editor**.
2. Select any agent prompt (e.g., `prompts/governance/cto.md`).
3. Modify role guidelines, architectural preferences, or security rules.
4. Click **Save & Version Prompt**. New document generation runs will immediately utilize the updated system prompt.
