# Agent Skills & Operational Standards

This document records specialized skills, behaviors, and procedural standards for the Gemini CLI agent within this project.

## 1. Contextual Awareness & Initialization
- **Skill:** Markdown Context Review.
- **Behavior:** Upon starting a session or beginning a new major phase, the agent must prioritize reading all `.md` files in the project root (e.g., `specification.md`, `GEMINI.md`) to align with the project goals, architecture, and current progress.
- **Goal:** Ensure continuity and adherence to the defined project roadmap.

## 2. Environment Safety & Resource Management
- **Skill:** Port Availability Verification.
- **Behavior:** Before assigning or starting a service on a specific network port (e.g., Express server on 3001), the agent must perform a check using system commands (like `netstat` or `Get-NetTCPConnection` on Windows) to verify if the port is already in use.
- **Logic:**
  1. Identify the target port.
  2. Run a shell command to check for active listeners on that port.
  3. If occupied, inform the user and suggest an alternative or wait for instructions.
- **Goal:** Prevent runtime errors and port conflicts during development.

## 3. Implementation Workflow
- **Skill:** Sprint-Based Execution.
- **Behavior:** Follow the multi-sprint plan defined in `specification.md`, validating each step with the user before proceeding to the next logical block.
- **Goal:** Maintain a structured and verifiable development lifecycle.

## 4. Responsive Design Standards (RWD)
- **Skill:** Mobile-First & Fluid Layouts.
- **Behavior:** Apply strict responsive rules during UI development:
  - **Philosophy:** Design mobile-first using `min-width` media queries. Prioritize progressive enhancement and fluid units (`%`, `vw`, `rem`) over fixed pixels.
  - **Layout Tools:** Use **Flexbox** for 1D alignment and **CSS Grid** for 2D page structures. Prefer **Container Queries** for component-level adaptability.
  - **Standard Breakpoints:** 
    - `sm`: 640px, `md`: 768px, `lg`: 1024px, `xl`: 1280px, `2xl`: 1536px.
  - **Adaptability Rules:**
    1. **Media:** `max-width: 100%` and `height: auto` for images.
    2. **Typography:** Use `clamp()` for fluid text (e.g., `font-size: clamp(1rem, 2vw, 1.5rem)`).
    3. **Overflow:** Ensure `overflow-x: auto` on wide elements (tables) to prevent horizontal scrolling.
    4. **Touch Targets:** Minimum interactive size of `44x44px`.
  - **Validation:** Always verify with browser "Responsive Design" view and ensure zero horizontal scrolling.
- **Goal:** Deliver a seamless user experience across all device categories.
