# **Modern Agentic Spec-Driven Development Frameworks**

Spec-driven development (SDD) has emerged as the architectural counterweight to "vibe coding"—the non-deterministic drift and architectural decay that occur when large language models (LLMs) generate software from ungrounded natural language prompts1. In modern agentic software engineering, formal specifications are not static documentation; they serve as executable, machine-readable contracts that strictly constrain autonomous coding agents2. By decoupling stable requirements ("what") from ephemeral implementation designs ("how"), SDD ensures that stochastic model outputs converge predictably on verified system behavior2.

For engineers utilizing terminal-based coding harnesses such as Claude Code CLI, Cursor, and Codex CLI, the modern SDD ecosystem comprises three distinct operational architectures: sequential phase-gated pipelines (exemplified by GitHub Spec Kit), brownfield living delta contracts (exemplified by OpenSpec), and context-engineered subagent orchestrators (such as Superpowers, BMAD Method, GSD Core, Spec Kitty, and Tessl)3. Each framework enforces a structured boundary between planning and code emission, minimizing token waste and preventing multi-file hallucinations2.

The leading open-source frameworks demonstrate substantial community adoption, evidenced by GitHub metrics ranging from tens of thousands to hundreds of thousands of stars, enterprise technical literature, and deep ecosystem integrations across agent plugin marketplaces6. These tools integrate directly with Claude Code CLI via native slash commands, Agent Skills (SKILL.md), and Model Context Protocol (MCP) servers, executing multi-turn feature implementations while maintaining project context over extended development sessions3.

## **Comparative Technical Landscape**

The following matrix compares the primary agentic spec-driven development frameworks, evaluating their open-source repositories, verified adoption metrics, Claude Code integration mechanisms, and operational niches.

&nbsp;

| Framework & Repository | Primary Architecture & SDD Tier | Popularity & Adoption Evidence | Claude Code Integration Interface | Optimal Operational Context |
| :---- | :---- | :---- | :---- | :---- |
| **Superpowers** [github.com/obra/superpowers](https://github.com/obra/superpowers) \[cite: \] | Composable Agentic Skills & Autonomous TDD Loop (Spec-First to Spec-Anchored) | • 214k–286.5k GitHub stars • Ranked \#12 globally on Star History • Official Claude Code marketplace distribution | Native Claude Code plugin (/plugin install superpowers@claude-plugins-official) | Autonomous multi-hour feature development enforcing strict Test-Driven Development (TDD) and subagent isolation. |
| **GitHub Spec Kit** [github.com/github/spec-kit](https://github.com/github/spec-kit) \[cite: \] | Sequential Phase-Gated Lifecycle via Constitution (Spec-First)2 | • 90k–120k+ GitHub stars1 • 8,000+ GitHub forks6 • Featured in official GitHub and Microsoft technical curricula | Slash commands via specify-cli (/speckit.specify, /speckit.plan, /speckit.tasks)1 | Greenfield projects (0-to-1) and ground-up microservice builds requiring strict, gated approval stages3. |
| **OpenSpec** [github.com/Fission-AI/OpenSpec](https://github.com/Fission-AI/OpenSpec) \[cite: 3\] | Dual-Folder Delta Specs with Living Source of Truth (Spec-Anchored)3 | • 68.4k+ GitHub stars • 4,700+ GitHub forks • Cross-tool ecosystem spanning 21+ coding agents | Slash commands configured via openspec init (/opsx:explore, /opsx:propose, /opsx:apply, /opsx:verify)3 | Brownfield applications, iterative legacy maintenance, and complex cross-spec modifications in existing repositories3. |
| **BMAD Method** [github.com/bmad-code-org/BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD) \[cite: \] | Multi-Agent Agile Role Specialization (Spec-First to Spec-Anchored)4 | • 52k–53.1k GitHub stars • 6,000+ forks2 • Published Packt textbook & 250k+ masterclass views | Plugin marketplace command (/plugin marketplace add bmad-code-org/bmad-plugins) or NPX Skills CLI2 | Enterprise agile environments requiring separation of concerns across Analyst, Architect, Scrum Master, and Dev personas4. |
| **GSD Core** [github.com/open-gsd/gsd-core](https://github.com/open-gsd/gsd-core) \[cite: 5\] | Context Engineering & Wave Subagent Dispatch (Spec-Anchored)5 | • 473 points on Hacker News • Widespread organic adoption among Claude Code power users9 • Multi-runtime CLI distribution | Slash commands via npx @opengsd/gsd-core (/gsd:new-project, /gsd:plan-phase, /gsd:execute-phase)5 | High-velocity Claude Code development requiring prevention of context degradation across deep sessions6. |
| **Spec Kitty** [github.com/Priivacy-ai/spec-kitty](https://github.com/Priivacy-ai/spec-kitty) \[cite: \] | Work Package Kanban with Native Git Worktree Sandboxing (Spec-Anchored)4 | • 1,500–1,600+ GitHub stars • Official PyPI package (spec-kitty-cli) • Dedicated multi-agent orchestrator daemon | Claude Code skill commands (spec-kitty dispatch, /spec-kitty commands) | Team-based workflows requiring Git worktree concurrency, visual kanban tracking, and human-in-the-loop decision checkpoints11. |
| **Tessl SDD Tile** [github.com/tesslio/spec-driven-development-tile](https://github.com/tesslio/spec-driven-development-tile) \[cite: \] | Contract-Driven "Spec-as-Source" with Test Anchors (Spec-as-Source)4 | • Backed by Tessl ($125M funding) • Detailed in Martin Fowler's comparative SDD evaluation • Published Agent Skill Registry | Tessl CLI and MCP server integration (npx @tessl/cli install tessl-labs/spec-driven-development) | API and component generation where code files are locked build artifacts generated directly from .spec.md. |

## **Architectural Profiles and Execution Mechanics**

### **Superpowers: Composable Skills and Autonomous Test-Driven Development**

Superpowers, authored by Jesse Vincent and maintained by Prime Radiant, provides an agentic development methodology packaged as composable skills for Claude Code and related harnesses. With a GitHub footprint exceeding 214,000 to 286,500 stars, it is among the highest-ranked developer utilities on GitHub, ranking \#12 globally on Star History. Superpowers functions not as an external wrapper, but as an in-process instruction set that triggers Claude Code skills automatically during the software delivery lifecycle.

* Official Repository: [github.com/obra/superpowers](https://github.com/obra/superpowers)  
  \[cite: \]  
* Popularity & Ecosystem Metrics: Over 286k GitHub stars; official inclusion in Anthropic’s Claude Code plugin marketplace (claude-plugins-official); widespread ecosystem ports to Cursor, OpenCode, and Codex.  
* Mechanics & Workflow: Superpowers structures work into seven successive phases: brainstorming, worktree allocation, plan creation, subagent dispatch, red-green-refactor TDD, code review, and branch finalization1. Upon receiving a feature request, the harness triggers /skill:brainstorming to interrogate technical trade-offs, explore architectural alternatives, and draft a durable design document. Once the engineer approves the design, /skill:writing-plans translates the architecture into granular, test-gated milestones. The framework then isolates execution within dedicated Git worktrees and dispatches subagents to write failing unit tests first, implement minimal production code to satisfy assertions, and verify system integrity prior to merging.

### **GitHub Spec Kit: Phased Gating and Repository Constitutions**

Developed as an open-source reference standard by GitHub, Spec Kit brings structural discipline to coding agents like Claude Code, Copilot CLI, and Gemini CLI. With over 90,000 to 120,000 GitHub stars and 8,000 forks, Spec Kit is distributed as the specify command-line utility (installable via uvx) and formalizes the principle that application code serves as an implementation detail of versioned specifications1.

* Official Repository: [github.com/github/spec-kit](https://github.com/github/spec-kit)  
  \[cite: \]  
* Popularity & Ecosystem Metrics: 90k–120k+ GitHub stars; 8,000+ forks; authoritative coverage across the GitHub Engineering Blog, Microsoft Learn training courses, and third-party developer publications1.  
* Mechanics & Workflow: Spec Kit enforces a four-stage sequential pipeline managed through slash commands:  
  1. /speckit.constitution: Establishes constitution.md to define immutable project invariants, architectural guardrails, and coding conventions1.  
  2. /speckit.specify: Compiles requirements into a technology-agnostic functional specification (spec.md) focusing strictly on user outcomes rather than implementation details1. Supplemental commands /speckit.clarify and /speckit.checklist interview the engineer to resolve edge-case ambiguities.  
  3. /speckit.plan: Produces plan.md, establishing concrete technical choices (frameworks, schema migrations, API schemas) satisfying the functional spec. The /speckit.analyze command executes static consistency checks between the plan and the specification.  
  4. /speckit.tasks & /speckit.implement: Decomposes the plan into granular work units in tasks.md, which the agent sequentially implements and verifies against acceptance criteria.

Spec Kit is optimized for greenfield architectures and full subsystem refactors, providing strict human review gates between planning and execution.

### **OpenSpec: Living Source of Truth and Delta Specifications**

Maintained by Fission AI, OpenSpec is engineered specifically for mature, brownfield systems where traditional waterfall documentation structures break down. Accumulating over 68,000 GitHub stars and 4,700 forks, OpenSpec operates as a lightweight CLI that configures native slash commands and skill instructions across 21 coding environments, including Claude Code, Cursor, and Windsurf3.

* Official Repository: [github.com/Fission-AI/OpenSpec](https://github.com/Fission-AI/OpenSpec)  
  \[cite: \]  
* Popularity & Ecosystem Metrics: 68,400+ GitHub stars; 4,700 forks; production adoption across multi-repo environments; companion ecosystem including openspec-for-copilot, terminal TUIs, and web kanban interfaces.  
* Mechanics & Workflow: OpenSpec eliminates monolithic document diffs through a dual-folder model that strictly delineates established capabilities from pending modifications:  
  * openspec/specs/: Holds living, authoritative system specifications reflecting the current state of production code.  
  * openspec/changes/: Contains isolated directories for active features, housing proposals (proposal.md), design notes (design.md), task lists (tasks.md), and delta specs (spec.md)3.

During the planning stage (/opsx:propose), OpenSpec generates delta specifications that classify requirements using explicit ADDED, MODIFIED, and REMOVED sections4. Claude Code implements these changes via /opsx:apply and verifies functional behavior with /opsx:verify. Once complete, running /opsx:archive merges the delta updates directly into the living contracts under openspec/specs/ and archives the change directory, maintaining an auditable lineage without manual documentation overhead.

### **BMAD Method: Multi-Agent Agile Role Specialization**

The Breakthrough Method for Agile AI-Driven Development (BMAD Method) is an enterprise-scale agentic engineering framework with over 53,000 GitHub stars and 6,000 forks2. While lightweight frameworks use a single LLM loop for planning and coding, BMAD introduces a simulated agile engineering team composed of specialized autonomous personas8.

* Official Repository: [github.com/bmad-code-org/BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD)  
  \[cite: 2\]  
* Popularity & Ecosystem Metrics: 53,000+ GitHub stars; 6,000 forks; over 250,000 views on educational masterclasses; formal instructional books published by Packt Publishing.  
* Mechanics & Workflow: BMAD divides the delivery lifecycle into distinct operational roles8:  
  * Analyst Persona (bmad-deep-recon): Conducts competitive analysis, domain discovery, and feasibility spikes prior to architectural design8.  
  * Product Manager Persona: Compiles discovery data into a formal Product Requirements Document (PRD).  
  * Architect Persona: Analyzes interface boundaries, technical risk, and Architectural Decision Records (ADRs)8.  
  * Scrum Master Persona: Deconstructs PRD and architecture artifacts into isolated, context-bounded user stories8.  
  * Developer & Test Architect (TEA) Personas: Implement code vertically against user stories, enforcing automated testing criteria and coverage thresholds before closing tasks8.

BMAD integrates with Claude Code via its plugin marketplace (bmad-plugins)2. The framework enforces execution boundaries using YAML frontmatter in step definition files, barring downstream agents from executing until upstream quality checkpoints receive explicit human verification.

### **GSD Core: Context Engineering and Subagent Context-Rot Mitigation**

GSD Core (formerly "Get Shit Done") is a specialized context-engineering framework created to resolve "context rot"—the progressive degradation in reasoning and instruction adherence that occurs as an agent's context window accumulates noise6. Originating from TÂCHES and transitioning to the Open GSD project, GSD Core has seen widespread adoption across the Claude Code community, earning 473 points on Hacker News5.

* Official Repository: [github.com/open-gsd/gsd-core](https://github.com/open-gsd/gsd-core)  
  \[cite: \]  
* Popularity & Ecosystem Metrics: 473 Hacker News points; viral community discussions; multi-runtime installer distribution supporting Claude Code, OpenCode, Codex, and Gemini CLI5.  
* Mechanics & Workflow: GSD Core structures work into a disciplined five-step loop executed on a per-phase basis: Discuss, Plan, Execute, Verify, and Ship. It solves context window bloat by decoupling orchestration from execution:  
  * Ephemeral Subagents: Rather than performing research, planning, and task execution within a single persistent session, GSD's lightweight orchestrator delegates work packages to ephemeral subagents initialized with clean 200,000-token context windows5. The primary orchestrator's context utilization rarely exceeds 30% to 40%10.  
  * Persistent State Artifacts: Project memory is externalized into machine-readable files, including STATE.md, CONTEXT.md, and ROADMAP.md5.  
  * Parallel Wave Execution: Implementation tasks run in parallel dependency waves via /gsd:execute-phase, committing changes atomically per task6. Post-execution, /gsd:verify-work initiates automated diagnostics and user-acceptance verification before merging5.

### **Spec Kitty: Sandboxed Git Worktrees and Governed Work Packages**

Developed by Priivacy-ai, Spec Kitty provides a team-oriented spec-driven development system built upon GitHub Spec Kit concepts, adding multi-agent orchestration, Git worktree isolation, and real-time kanban tracking. Tracking over 1,500 GitHub stars and distributed via PyPI (spec-kitty-cli), it operates alongside Claude Code, Cursor, and Codex.

* Official Repository: [github.com/Priivacy-ai/spec-kitty](https://github.com/Priivacy-ai/spec-kitty)  
  \[cite: \]  
* Popularity & Ecosystem Metrics: 1,500–1,600+ GitHub stars; 150+ forks; official PyPI distribution; standalone spec-kitty-orchestrator process for autonomous multi-agent coordination.  
* Mechanics & Workflow: Spec Kitty manages features as "missions" partitioned into granular Work Packages (WPs) displayed on an embedded, real-time web dashboard12:  
  * Native Git Worktree Sandboxing: Spec Kitty isolates every active mission into an independent Git worktree4. Multiple agents can implement tasks simultaneously without colliding in the primary directory or checking out conflicting branches.  
  * Human Decision Moments: When an agent encounters ambiguous requirements during planning, it halts execution and triggers a "Decision Moment"11. The agent logs an Architectural Decision Record (ADR) under kitty-specs/ and alerts the developer, ensuring the system never resolves ambiguities via uncontrolled model hallucinations11.

### **Tessl SDD Tile: Spec-as-Source and Bidirectional Test Linking**

Tessl, founded by Guy Podjarny and supported by $125 million in funding, champions the "Spec-as-Source" paradigm. Under this model, specifications serve as the definitive editable source artifact, while code is treated as an ephemeral output generated entirely by AI models. Documented in Martin Fowler’s research on modern SDD patterns, the Tessl Framework distributes methodology tiles through the Tessl Registry and an MCP server.

* Official Repository: [github.com/tesslio/spec-driven-development-tile](https://github.com/tesslio/spec-driven-development-tile)  
  \[cite: \]  
* Popularity & Ecosystem Metrics: Supported by a $125M commercial platform; prominent case study in Martin Fowler’s SDD technical series; integrated across public agent skill registries.  
* Mechanics & Workflow: The SDD Tile configures Claude Code with a disciplined interview protocol and contract grammar:  
  * Strict Interview Protocol (one-question-at-a-time): When tasked with feature creation, the agent is barred from writing code until it interviews the developer, resolving one requirement ambiguity at a time.  
  * Structured .spec.md Contracts: Requirements are recorded in markdown specifications containing YAML frontmatter that maps target files directly (e.g., targets: \[../src/auth/\*.py\]).  
  * Explicit Test Anchors (\[@test\]): Specifications link functional requirements directly to test suites using inline test citations. Claude Code validates that generated code satisfies linked assertions, marking source files with read-only headers (e.g., // GENERATED FROM SPEC \- DO NOT EDIT).

## **Execution Pipelines and Claude Code CLI Runtime Lifecycle**

Integrating spec-driven development into Claude Code CLI relies on native extension mechanisms: custom slash commands (.claude/commands/), Agent Skills (SKILL.md), and Model Context Protocol (MCP) integrations3. These interfaces convert linear terminal interactions into structured state transitions.

The operational lifecycle of a spec-driven agent session proceeds through six discrete stages:

&nbsp;

| Lifecycle Stage | Trigger & Input Artifacts | Agent Execution Mechanism | Resulting State & Safety Invariants |
| :---- | :---- | :---- | :---- |
| **1\. Governance & Boundary Loading** | Command initialization (specify init, openspec init, or /gsd:new-project)3 | Claude Code ingests root governance files (constitution.md, STATE.md, or OpenSpec profile configurations)1. | Core system constraints, framework choices, and architecture rules are bound to the agent session before reasoning begins1. |
| **2\. Requirements Interview & Extraction** | Initial prompt or slash trigger (/speckit.specify, /opsx:explore, or /skill:brainstorming)3 | The agent executes an interview loop, interrogating architectural trade-offs, constraints, and edge cases. | Generates structured requirement documents (spec.md or delta specs) without modifying production source code6. |
| **3\. Technical Planning & Static Verification** | Gated command (/speckit.plan, /opsx:propose, or /gsd:plan-phase)3 | The harness decomposes specifications into technical architectures, database schemas, and vertical tasks1. | Validates cross-artifact consistency (e.g., /speckit.analyze), ensuring all user stories trace to concrete implementation tasks. |
| **4\. Sandboxed Task Dispatch** | Implementation trigger (/speckit.tasks, /opsx:apply, or /gsd:execute-phase) | The framework provisions isolated Git worktrees and dispatches clean-context subagents (200k tokens) per task wave4. | Prevents context rot and protects the developer's primary working tree from colliding changes or dirty branch state. |
| **5\. Test-Driven Verification Gate** | Task execution loop (/opsx:verify, /gsd:verify-work, or Superpowers TDD skill)3 | Claude Code writes failing unit/integration tests (Red), implements minimal source code (Green), and executes verification commands. | Tasks fail closed; code cannot be marked completed if test assertions fail or diverge from specification criteria13. |
| **6\. Spec Reconciliation & State Archival** | Lifecycle finalization (/opsx:archive, /gsd:ship, or spec-kitty merge)3 | Delta specifications are reconciled back into the long-lived source of truth specifications under specs/. | Ephemeral worktrees are purged, active change directories are archived, and an auditable Git history is committed3. |

During runtime, this pipeline prevents common failure modes associated with terminal-based coding agents. By forcing Claude Code to read the project constitution and specification files before inspecting source trees, token consumption is minimized and semantic hallucination is curtailed13.

Furthermore, offloading execution into Git worktrees allows the agent to fail without contaminating local work4. When combined with automated verification gates—such as the requirement in Superpowers and Tessl that code changes map directly to passing unit test assertions—the agent loop shifts from probabilistic guessing to verifiable, contract-driven implementation.

## **Composable and Hybrid SDD Architectures**

In practical production environments, engineering teams rarely implement a single SDD framework end-to-end4. Rigid, monolithic adoption frequently creates friction because different frameworks optimize for conflicting operational priorities4. High-performing teams treat SDD as a modular stack, unbundling governance, requirement specification, and task execution across complementary tools4.

### **Core Trade-Offs Driving Hybridization**

> 1. **Greenfield Scaffolding vs. Brownfield Evolution**: GitHub Spec Kit’s sequential phase-gating (constitution → specify → plan → tasks → implement) excels at 0-to-1 repository creation, but creates excessive procedural overhead for routine bug fixes or localized feature tweaks4. Conversely, OpenSpec’s delta folders (openspec/changes/) optimize specifically for ongoing changes in established codebases with minimal ceremony3.  
> 2. **Organizational Ceremony vs. Execution Velocity**: Enterprise methodologies like the BMAD Method orchestrate full teams of specialized agents (Analyst, PM, Architect, Scrum Master, Developer, Test Architect)4. While valuable for complex systems requiring Architectural Decision Records (ADRs) and formal PRDs, solo developers or rapid-prototyping teams experience severe latency unless using lighter workflows4.  
> 3. **Context Window Rot vs. Monolithic Prompts**: As coding sessions deepen, single-session context bloat degrades reasoning5. Frameworks such as GSD Core address this by using an orchestrator that delegates tasks to clean 200,000-token ephemeral subagents, an execution model that can be hybridized with specification tools5.

### **Proven Hybrid Composition Patterns**

* **Governance \+ Delta Spec Hybrid (Spec Kit \+ OpenSpec)**: Leveraging Spec Kit's immutable constitution.md to define non-negotiable coding conventions and system boundaries, while delegating day-to-day feature planning and delta updates to OpenSpec's lighter /opsx:propose and /opsx:apply loops1. This retains enterprise compliance rules without incurring multi-step ceremony for simple changes14.  
* **Structured Specification \+ Autonomous TDD (OpenSpec \+ Superpowers)**: Specifying feature requirements using OpenSpec's structured delta contracts, and binding execution to Superpowers' automated red-green-refactor TDD skills3. Every generated line of production code is justified by failing unit test assertions prior to merge, eliminating hallucinated implementations13.  
* **Specification Layer \+ Subagent Context Engineering (Spec Kit / OpenSpec \+ GSD Core)**: Drafting specifications and technical plans via Spec Kit or OpenSpec, then executing implementation tasks through GSD Core’s subagent dispatching mechanism1. GSD Core executes each task in an isolated, fresh 200,000-token context window with atomic Git commits, keeping the main orchestrator lean5.  
* **Mission Governance \+ Git Worktree Isolation (Spec Kitty \+ Claude Code Skills)**: Employing Spec Kitty’s native worktree management and Decision Moments to coordinate parallel human-in-the-loop workflows across teams, while executing within isolated sandboxes using specialized Claude Code skills11. Multiple agents run concurrently without branch collision while progress updates to a centralized dashboard11.

### **The Four-Layer Decoupled SDD Stack**

&nbsp;

| Architectural Layer | Core System Responsibility | Recommended Tooling / Components |
| :---- | :---- | :---- |
| **1\. Global Governance** | Enforcing architectural invariants, security rules, and coding standards | GitHub Spec Kit (constitution.md), BMAD (\_bmad/ policies)1 |
| **2\. Specification & Delta Tracking** | Defining behavioral requirements, acceptance criteria, and brownfield modifications | OpenSpec (dual-folder delta specs), Tessl (.spec.md with test links)3 |
| **3\. Execution Sandboxing** | Isolating agent file edits, branch management, and concurrent task streams | Spec Kitty (native Git worktrees), Superpowers (worktree skills)4 |
| **4\. Task Execution & Verification** | Preventing context window degradation and enforcing test-first verification | GSD Core (fresh subagent waves), Superpowers (red-green TDD), OpenSpec Plus5 |

## **Iterative Development and Requirement Scoping Control**

A major operational challenge in agentic software engineering is the "waterfall trap"—frameworks that mandate big-design-up-front (BDUF) batching, making incremental requirement scoping and mid-stream course correction difficult4. Production development requires the ability to scope a subset of requirements for immediate implementation while holding remaining items in reserve, as well as the agility to modify requirements mid-stream without breaking the framework's execution state14.

### **Framework Comparison on Scoping and Mid-Flight Correction**

* **GitHub Spec Kit (Batch Phase-Gated)**: Standard Spec Kit workflows generate large specifications (typically 3–4 user stories with 40–50 functional requirements) and process them as a batch through /speckit.plan and /speckit.tasks16. Subsetting requires manual intervention or pruning within tasks.md, and mid-stream requirement adjustments often necessitate regenerating downstream artifacts6.  
* **OpenSpec (Incremental Delta-Based)**: Requirement scoping is inherently modular through isolated change directories (openspec/changes/\<change-name\>/) and delta specs using explicit ADDED, MODIFIED, and REMOVED sections3. Changes can be edited at any point mid-flight and resumed with /opsx:apply without phase-gate lockouts3.  
* **Spec Kitty (Work Package Kanban)**: Missions are broken into discrete Work Packages (WPs) displayed on a live board, allowing teams to explicitly dispatch individual work packages while holding subsequent requirements in backlog11. Furthermore, its "Decision Moments" pause execution when requirements encounter ambiguity, logging an ADR rather than allowing the agent to guess11.  
* **BMAD Method (User Story Sharding)**: The Scrum Master persona explicitly shards monolithic PRDs into context-isolated user stories, enabling sequential or subset execution8. While offering high scoping control, full-lifecycle execution carries substantial process overhead unless operated in Quick Flow mode8.  
* **GSD Core (Dependency Waves)**: Project goals are partitioned across phases and milestones within ROADMAP.md5. Implementation tasks run in parallel dependency waves via /gsd:execute-phase, committing changes atomically per task and verifying work before advancing5.

### **Risks of Monolithic Execution Failure Modes**

When an agentic SDD does not allow granular requirement slicing, terminal agents encounter three failure modes:

> 1. **Context Window Exhaustion & Quality Decay**: Attempting to implement dozens of requirements in a single prompt cycle generates thousands of tokens of diffs, compiler checks, and reasoning logs, accelerating context rot and causing forgotten constraints5.  
> 2. **Cascading Hallucinations**: If an early architectural requirement contains an unvalidated assumption or schema flaw, batch execution builds subsequent requirements on top of that defect before human review can intervene2.  
> 3. **Loss of Verification Checkpoints**: Without incremental gates, the engineer cannot run, observe, or test intermediate software states before downstream implementation proceeds1.

To mitigate these risks, teams implement **vertical slicing** (decomposing specifications into thin vertical slices delivering verifiable value per slice) and **decoupled delta changes** (maintaining long-lived specifications as the system source of truth while exposing only active delta changes or work packages to the coding agent per execution turn)3.

The transition from unstructured prompting to modern agentic spec-driven development marks a fundamental evolution in software engineering. Unconstrained chat prompts inevitably produce architectural fragmentation, hidden technical debt, and context degradation over sustained projects2. By anchoring terminal coding agents to formal specifications—whether through the phased discipline of GitHub Spec Kit, the brownfield delta management of OpenSpec, the subagent hygiene of GSD Core, the worktree sandboxing of Spec Kitty, or the autonomous TDD workflows of Superpowers—engineering teams establish version-controlled specifications as the authoritative medium of programming, enabling autonomous agents to deliver maintainable, production-ready software predictably at scale3.

#### **Works cited**

> 1. GitHub Spec Kit Workflow: A Practical Guide \- Shiplight AI, [https://www.shiplight.ai/blog/spec-driven-development-with-spec-kit](https://www.shiplight.ai/blog/spec-driven-development-with-spec-kit)

## **Appendix: Team Diagnostic & SDD Model Selection Decision System**

### **1\. Executive Summary & Architectural Overview**

To operationalize spec-driven development across diverse engineering teams, organizations cannot mandate a single, monolithic SDD framework. Different delivery profiles require distinct trade-offs across ceremony, brownfield compatibility, governance, and autonomous execution.

This decision system operationalizes the *Finance Tech Team & Project Diagnostic Questionnaire* by evaluating a team's operational profile across the **Four-Layer Decoupled SDD Stack**:

* **Global Governance:** Compliance, architectural invariants, and change gates.  
* **Specification & Delta Tracking:** Living system contracts versus active changes.  
* **Execution Sandboxing:** Branch isolation, Git worktrees, and concurrency.  
* **Task Execution & Verification:** Subagent context management and automated TDD loops.

The engine uses a **Two-Tier Composite Decision Architecture**:

* **Tier 1 (Base Lifecycle Engine):** Recommends the primary daily CLI workflow framework (e.g., OpenSpec, GitHub Spec Kit, BMAD Method, or GSD Core).  
* **Tier 2 (Modular Practice Overlays):** Evaluates boolean condition triggers to adopt specific cross-framework techniques addressing specialized regulatory, architectural, or quality constraints.

### **2\. Diagnostic Mapping Matrix**

The diagnostic questionnaire maps operational signals to core SDD dimensions:

| Diagnostic Section & Indicators | Evaluated SDD Dimension | Target Model Candidates & Practices |
| :---- | :---- | :---- |
| **Section 1: Team Composition & Operational Structure** • Dedicated Product Owner, Scrum Master, and QA (Q2) • Geographic distribution and time-zone overlap (Q3) • Financial domain familiarity (Q4) | **Organizational Topology & Role Separation** • Need for specialized agent personas versus lean, developer-driven workflows. | • **BMAD Method** (multi-agent role division) • **Spec Kitty** (worktree concurrency for distributed teams) • **Superpowers** (brainstorming for domain gaps) |
| **Section 2: Project Workload & Requirement Characteristics** • Work breakdown: planned features vs. maintenance vs. debt (Q5) • Requirement volatility (Q6) • Specification granularity and clarity (Q7) | **Planning Rigor & Lifecycle Scope** • Brownfield delta management versus greenfield phased gating. | • **OpenSpec** (brownfield delta specs) • **GitHub Spec Kit** (greenfield phase-gating) • **BMAD Recon** (requirements discovery spikes) |
| **Section 3: Regulatory, Compliance, and Audit Constraints** • SOX Tier 1 vs. standard internal governance (Q8) • Precision requirements: zero-tolerance ledger vs. analytics (Q9) | **Compliance Invariants & Verification Depth** • Enforced repository guardrails and test-first gates. | • **GitHub Spec Kit** (immutable constitution.md) • **Superpowers** (autonomous red-green TDD) • **Tessl** (test-anchored contracts) |
| **Section 4: Technical Architecture & Pipeline Maturity** • Architecture: cloud microservices, batch data, monolith (Q10) • Deployment cadence and lead time (Q11) • Test automation coverage and quality gates (Q12) | **Execution Safety & Context Hygiene** • Subagent sandboxing, automated test verification, and context degradation control. | • **GSD Core** (fresh subagent context waves) • **Superpowers** (automated unit/contract gates) • **OpenSpec** (atomic task execution) |
| **Section 5: Dependencies & External Blockers** • Release autonomy vs. coupled releases (Q14) • Governance approval gates: automated vs. CAB (Q15) | **Coordination & Decision Management** • Synchronous approval gates and decision tracking. | • **Spec Kitty** (Decision Moments & ADR logging) • **GitHub Spec Kit** (phase-gated review gates) |
| **Section 6: Bottlenecks & Delivery Friction** • Top ranked blockers (e.g., CI/CD, test fear, shifting specs) (Q16) | **Targeted Pain Point Remediation** • Overlaying specific practices to eliminate acute friction. | • Targeted practice triggers mapped to specific team pain points. |

### **3\. Base Framework Selection Logic**

The primary framework is selected deterministically based on dominant workload characteristics:

> 1. **Brownfield / Legacy / High Operational Churn (OpenSpec Base)**  
   1. *Trigger Rule:* Work breakdown (Q5) has ≥40% allocated to maintenance, operational triage, or tech debt; OR Primary Architecture (Q10) is a Monolith, Hybrid, or Batch Data Pipeline.  
   2. *Rationale:* OpenSpec prevents monolithic document diffs by using isolated delta directories (*openspec/changes/\<change-name\>/*) and living contracts (*openspec/specs/*), allowing fast, low-ceremony evolution without breaking existing systems.  
> 2. **Greenfield / Strategic 0-to-1 Subsystem Builds (GitHub Spec Kit Base)**  
   1. *Trigger Rule:* Work breakdown (Q5) has ≥60% strategic roadmap initiatives AND Architecture (Q10) is Cloud-Native Microservices AND Requirements (Q7) are structured.  
   2. *Rationale:* Spec Kit's sequential phase-gated pipeline (*specify* → *plan* → *tasks* → *implement*) enforces disciplined human checkpoints before any code is generated.  
> 3. **Multi-Role Enterprise Delivery Teams (BMAD Method Base)**  
   1. *Trigger Rule:* Team (Q2) includes dedicated Product Owners, Scrum Masters, and QA/SDETs, AND requirements (Q7) arrive as high-level or vague business goals.  
   2. *Rationale:* BMAD provides separation of concerns across specialized agent personas (Analyst, PM, Architect, Scrum Master, Developer, Test Architect), preventing autonomous coding agents from making premature architectural or scope assumptions.  
> 4. **Autonomous High-Velocity Engineering (GSD Core / Superpowers Base)**  
   1. *Trigger Rule:* Team is compact (\<5 engineers), deployment frequency (Q11) is continuous/weekly, and releases are autonomous (Q14).  
   2. *Rationale:* Focuses on execution velocity and context engineering, utilizing ephemeral subagents and clean context windows to minimize token waste and context rot.

### **4\. Modular Practice Overlay Rules**

Regardless of the Base Model, the decision engine applies modular practice overlays based on specific organizational constraints:

* **Overlay A: Formal Regulatory Constitution (Spec Kit Layer)**  
  * *Trigger:* Question 8 \= "SOX-Critical / Tier 1" OR Question 15 requires CAB/formal governance sign-offs.  
  * *Adopted Practice:* Implement GitHub Spec Kit's *constitution.md* at the repository root.  
  * *Mechanism:* Binds immutable security invariants, audit trail requirements, and segregation-of-duties rules directly into the agent session before reasoning or task execution begins.  
* **Overlay B: Autonomous Test-Driven Verification (Superpowers / Tessl Layer)**  
  * *Trigger:* Question 9 \= "Zero-tolerance for error" OR Question 16 ranks "Lack of test automation / fear of breaking financial calculations" as a top-2 bottleneck.  
  * *Adopted Practice:* Superpowers autonomous Red-Green-Refactor TDD loops and Tessl *\[@test\]* contract anchors.  
  * *Mechanism:* Agents are strictly barred from generating production code until failing unit/reconciliation tests are written and committed. Tasks fail closed if test assertions fail.  
* **Overlay C: Git Worktree Sandboxing & Decision Moments (Spec Kitty Layer)**  
  * *Trigger:* Question 14 \= "Coupled Releases" / "Heavy Upstream/Downstream Dependencies" OR Question 3 \= "Highly distributed across global time zones".  
  * *Adopted Practice:* Spec Kitty native Git worktrees and explicit Human Decision Moments.  
  * *Mechanism:* Isolates concurrent agent implementations in sandboxed worktrees to prevent workspace collisions. Ambiguities trigger an explicit pause that logs an Architectural Decision Record (ADR) rather than guessing.  
* **Overlay D: Deep Domain Reconnaissance & Discovery (BMAD / Superpowers Layer)**  
  * *Trigger:* Question 4 \= "Low domain familiarity" OR Question 7 \= "Vague business goals" OR Question 16 ranks "Ambiguous requirements" as \#1 bottleneck.  
  * *Adopted Practice:* Pre-planning discovery spikes using BMAD's *bmad-deep-recon* or Superpowers' */skill:brainstorming*.  
  * *Mechanism:* Requires the agent to explore architectural alternatives, interrogate domain constraints, and interview engineers prior to locking functional specifications.  
* **Overlay E: Ephemeral Subagent Wave Dispatch (GSD Core Layer)**  
  * *Trigger:* Question 10 \= "Monolithic or legacy application" OR complex multi-file features spanning broad historical files.  
  * *Adopted Practice:* GSD Core orchestrator-subagent decoupling.  
  * *Mechanism:* Decomposes implementation into dependency waves, executing each wave inside an isolated 200,000-token context window with atomic Git commits to eliminate context rot.

### **5\. Implementation Blueprint & Team Deliverable**

The decision engine can be deployed as a lightweight evaluation service:

1. **Input Schema:** Standardized JSON/YAML mapping responses from the 16 diagnostic questions.  
2. **Evaluation Logic:** Deterministic scoring logic for the base model, combined with rule evaluation for practice overlays.  
3. **Generated Team Profile:** The system outputs a personalized, actionable engineering guide containing:  
   * **Recommended Base Framework:** Primary CLI harness, installation commands, and repository initialization steps.  
   * **Active Practice Overlays:** List of cross-adopted practices, artifacts (e.g., *constitution.md*, test suites), and slash commands.  
   * **Tailored Directory Layout:** Suggested repository structure harmonizing the selected tools (e.g., *.claude/commands/*, *openspec/changes/*, *constitution.md*).  
   * **Bottleneck Resolution Matrix:** Direct mapping detailing how the composite SDD stack resolves the team's self-reported delivery bottlenecks.  
> 2. GitHub's Spec Kit Puts the Spec Back in Software Development, [https://devops.com/githubs-spec-kit-puts-the-spec-back-in-software-development/](https://devops.com/githubs-spec-kit-puts-the-spec-back-in-software-development/)  
> 3. spec-compare/docs/tools/openspec.md at main \- GitHub, [https://github.com/cameronsjo/spec-compare/blob/main/docs/tools/openspec.md](https://github.com/cameronsjo/spec-compare/blob/main/docs/tools/openspec.md)  
> 4. Spec-Driven Development Tools Comparison \- GitHub, [https://github.com/cameronsjo/spec-compare](https://github.com/cameronsjo/spec-compare)  
> 5. open-gsd/gsd-core: Git. Ship. Done \- Core \- GitHub, [https://github.com/open-gsd/gsd-core](https://github.com/open-gsd/gsd-core)  
> 6. Meet GitHub Spec-Kit: An Open Source Toolkit for Spec-Driven, [https://www.marktechpost.com/2026/05/08/meet-github-spec-kit-an-open-source-toolkit-for-spec-driven-development-with-ai-coding-agents/](https://www.marktechpost.com/2026/05/08/meet-github-spec-kit-an-open-source-toolkit-for-spec-driven-development-with-ai-coding-agents/)  
> 7. OpenSpec | Spec-Driven Development, [https://intent-driven.dev/knowledge/openspec/](https://intent-driven.dev/knowledge/openspec/)  
> 8. GitHub Spec Kit vs BMAD-Method: A Comprehensive Comparison, [https://medium.com/@visrow/github-spec-kit-vs-bmad-method-a-comprehensive-comparison-part-1-996956a9c653](https://medium.com/@visrow/github-spec-kit-vs-bmad-method-a-comprehensive-comparison-part-1-996956a9c653)  
> 9. Get Shit Done: A meta-prompting, context engineering and spec, [https://news.ycombinator.com/item?id=47417804](https://news.ycombinator.com/item?id=47417804)  
> 10. Get Shit Done, [https://gsd-build-get-shit-done.mintlify.app/](https://gsd-build-get-shit-done.mintlify.app/)  
> 11. Spec Kitty vs GitHub Spec Kit vs AWS Kiro vs GSD: AI Development, [https://spec-kitty.ai/blog/spec-driven-ai-development-for-teams](https://spec-kitty.ai/blog/spec-driven-ai-development-for-teams)  
> 12. Features & Benefits | Spec Kitty, [https://www.spec-kitty.ai/features](https://www.spec-kitty.ai/features)  
> 13. GitHub \- sudokar/openspec-plus: OpenSpec Plus — Agentic skills, [https://github.com/sudokar/openspec-plus](https://github.com/sudokar/openspec-plus)  
> 14. OpenSpec vs Spec Kit: Spec-Driven AI Development Guide, [https://www.bighatgroup.com/blog/openspec-vs-speckit-spec-driven-ai-development/](https://www.bighatgroup.com/blog/openspec-vs-speckit-spec-driven-ai-development/)  
> 15. I Tested Three Spec-Driven AI Tools. Here's My Honest Take., [https://ranthebuilder.cloud/blog/i-tested-three-spec-driven-ai-tools-here-s-my-honest-take/](https://ranthebuilder.cloud/blog/i-tested-three-spec-driven-ai-tools-here-s-my-honest-take/)  
> 16. How to use spec-driven development for brownfield code exploration?, [https://www.epam.com/insights/ai/blogs/using-spec-kit-for-brownfield-codebase](https://www.epam.com/insights/ai/blogs/using-spec-kit-for-brownfield-codebase)