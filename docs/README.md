# Anode Documentation

This directory contains documentation for the Anode project - a real-time
collaborative notebook system with AI integration.

## Quick Navigation

### 📖 Core Documentation

- **[UI Design](./ui-design.md)** - Design principles and interface guidelines
- **[UI Enhancements Demo](./ui-enhancements-demo.md)** - UI improvement
  showcase
- **[AI Context Visibility](./ai-context-visibility.md)** - Context control
  implementation
- **[Testing](./TESTING.md)** - Testing strategy and current gaps
- **[Technologies](./technologies/README.md)** - Introduction to the various technologies used

### 📋 Proposals

- **[AI Context Controls](./proposals/ai-context-controls.md)** - User controls
  for AI context inclusion/exclusion ✅ **Implemented**
- **[Updateable Outputs](./proposals/updateable-outputs.md)** -
  Jupyter-compatible display updates and stream merging

### 🏗️ Architecture Overview

Anode is a simplified single-application notebook system that provides:

- **Web Client**: React-based notebook interface with real-time collaboration
- **Sync Worker**: Cloudflare Worker handling LiveStore synchronization
- **Python Runtime**: Handled by separate `@runt` packages for execution and AI
  features

**Key Technologies:**

- **LiveStore**: Event-sourcing based local-first data synchronization
- **React**: Modern web interface with real-time collaborative editing
- **Vite**: Build system and development server
- **Cloudflare**: Pages (web client) + Workers (sync backend) deployment

### 🚀 Current Status: Production System Working

Core collaborative editing and notebook interface deployed:

✅ **Working Features:**

- Real-time collaborative notebook editing via LiveStore
- Cell management (create, edit, move, delete) with keyboard navigation
- Production deployment on Cloudflare Pages + Workers with authentication
- Mobile responsive design with optimized keyboard handling
- Context visibility controls - users can hide cells from AI context
- Event-sourced architecture with offline capability
- Clean single-application structure (no workspace complexity)

🚧 **Python Runtime & AI Features:**

- Now handled by separate `@runt` packages
- See https://github.com/runtimed/runt for Python execution and AI integration

### 🎯 Current Focus

**Simplified Architecture:**

- ✅ Single application structure (no monorepo complexity)
- ✅ Root-level Vite + Wrangler setup
- ✅ Standard TypeScript project layout
- ✅ All tests passing (36/36)

**UI & Collaboration:**

- Real-time collaborative editing without conflicts
- Clean, minimal interface design
- Context controls for AI integration
- Mobile-responsive notebook interface

### 📚 Documentation Structure

```
docs/
├── README.md                      # This file - documentation index
├── ui-design.md                   # Interface design guidelines
├── ui-enhancements-demo.md        # UI improvement showcase
├── ai-context-visibility.md       # Context visibility feature
├── TESTING.md                     # Testing strategy
└── proposals/
    ├── ai-context-controls.md     # User controls for AI context ✅ Implemented
    └── updateable-outputs.md      # Jupyter-compatible output updates
```

### 🔧 For Developers

**Getting Started:**

1. Read [ui-design.md](./ui-design.md) for interface design patterns
2. Check [ai-context-visibility.md](./ai-context-visibility.md) for context
   control features
3. See [TESTING.md](./TESTING.md) for testing approach
4. Review [proposals/](./proposals/) for planned features

**Key Files:**

- `src/components/notebook/` - Notebook interface components
- `src/sync/sync.ts` - Cloudflare Worker for LiveStore sync
- `src/components/ui/` - Reusable UI components
- `schema.ts` - LiveStore event definitions
- `@runt/schema` - Runtime schema (JSR package)

**Development Commands:**

```bash
# Start development
pnpm dev          # Web client at http://localhost:5173
pnpm dev:sync     # Sync worker at ws://localhost:8787

# Testing & Validation
pnpm test         # Run test suite (36 tests)
pnpm build        # Build web client
pnpm type-check   # TypeScript validation

# Python Runtime (separate setup)
# See https://github.com/runtimed/runt
```

### 🧠 Design Philosophy

**Local-First**: Work offline, sync when connected **Event-Sourced**: All
changes flow through LiveStore events **Collaborative**: Real-time multi-user
editing without conflicts **Simple**: Single application, standard project
structure **Type-Safe**: End-to-end TypeScript **Modular**: Clean separation
between UI and runtime concerns

### 🤝 Contributing

When working on the UI:

1. **Follow design system** - Use established patterns from ui-design.md
2. **Test thoroughly** - Add tests for new features (see TESTING.md)
3. **Consider collaboration** - How will features work with multiple users?
4. **Think mobile-first** - Ensure responsive design
5. **Maintain accessibility** - Follow ARIA guidelines

### 📈 Current Architecture

**Phase 1: Simplified Structure** ✅ **COMPLETED**

- Single application (no monorepo complexity)
- Standard Vite + React + TypeScript setup
- Cloudflare Pages + Workers deployment
- All tests passing with good coverage

**Phase 2: UI & Collaboration Focus** 🎯 **CURRENT**

- Real-time collaborative editing
- Clean, minimal interface design
- Context controls and user experience
- Mobile-responsive design

**Python Runtime & AI Features:**

- Moved to separate `@runt` packages
- Allows anode to focus on UI and collaboration
- See https://github.com/runtimed/runt for execution and AI integration

---

For project-wide context and current work status, see:

- [AGENTS.md](../AGENTS.md) - AI agent development context and current status
- [ROADMAP.md](../ROADMAP.md) - Long-term vision and milestones
- [README.md](../README.md) - Project overview and quick start
