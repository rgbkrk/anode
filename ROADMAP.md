# Anode Roadmap

This document outlines the current status, known issues, and development priorities for Anode.

## Current Status (January 2025)

### Working Features
- ✅ Basic notebook interface (create, edit, delete cells)
- ✅ Python code execution via Pyodide
- ✅ Real-time collaboration via LiveStore
- ✅ Execution queue system with fault tolerance
- ✅ Multiple kernel support with load balancing
- ✅ Markdown cells with live preview
- ✅ Event-sourcing architecture
- ✅ Development tooling (monitoring, cleanup)

### Experimental/Incomplete
- 🚧 SQL cells (UI exists, backend integration needed)
- 🚧 AI assistant cells (UI mockup only)
- 🚧 Authentication (hardcoded tokens only)
- 🚧 Production deployment
- 🚧 Performance optimization
- 🚧 Error handling and recovery

## Known Issues

### High Priority (Blocking Production)
- **Authentication System**: Currently uses hardcoded tokens
- **Error Recovery**: Poor handling of network disconnections
- **Memory Leaks**: Long-running kernels consume increasing memory
- **Data Persistence**: No guarantee against data loss during development
- **Concurrency Issues**: Cell execution order not guaranteed under load

### Medium Priority (UX/Performance)
- **Mobile Support**: UI not responsive on mobile devices
- **Large Notebooks**: Performance degrades with many cells
- **Package Management**: Limited Python package ecosystem via Pyodide
- **Sync Conflicts**: Rapid editing can cause state conflicts
- **Undo/Redo**: No operation history or undo functionality

### Low Priority (Nice to Have)
- **Multi-notebook**: Single notebook focus limits workflows
- **Rich Outputs**: Limited visualization and media support
- **Keyboard Shortcuts**: Missing common notebook shortcuts
- **Export/Import**: No standard format support (ipynb, etc.)
- **Version Control**: No integration with Git or similar

## Development Priorities

### Q1 2025 (Current)
1. **Stabilize Execution Queue**
   - Fix memory leaks in kernel processes
   - Improve error handling and recovery
   - Add execution cancellation support
   - Better timeout and retry logic

2. **Authentication Foundation**
   - JWT-based authentication system
   - Basic user management
   - Session handling
   - API security

3. **SQL Cell Implementation**
   - Database connection management
   - Query execution engine
   - Result formatting and display
   - Error handling for SQL errors

### Q2 2025 (Planned)
1. **AI Assistant Integration**
   - OpenAI/Anthropic API integration
   - Context-aware conversations
   - Code generation and explanation
   - Local model support (optional)

2. **Production Readiness**
   - Deployment documentation
   - Environment configuration
   - Monitoring and logging
   - Backup and recovery procedures

3. **Performance Optimization**
   - Large notebook handling
   - Memory usage optimization
   - Network efficiency improvements
   - Caching strategies

### Q3 2025 (Future)
1. **Advanced Collaboration**
   - User presence indicators
   - Commenting and annotations
   - Real-time cursors
   - Conflict resolution UI

2. **Rich Content Support**
   - Enhanced visualizations
   - Media embedding
   - Interactive widgets
   - Custom output renderers

3. **Ecosystem Integration**
   - Jupyter notebook import/export
   - Git integration
   - Package manager integration
   - Plugin architecture

## Technical Debt

### Architecture
- **Multi-store Support**: Current single-notebook limitation
- **Event Schema Evolution**: Need versioning strategy
- **State Management**: Complex state synchronization logic
- **Error Boundaries**: Insufficient error isolation

### Code Quality
- **Test Coverage**: Limited automated testing
- **Documentation**: Many features undocumented
- **Type Safety**: Some any types need proper typing
- **Performance Profiling**: No systematic performance measurement

### Infrastructure
- **Build Process**: Complex workspace dependencies
- **Development Setup**: Multi-terminal development experience
- **Deployment**: No automated deployment pipeline
- **Monitoring**: Limited production monitoring capabilities

## Research Areas

### Immediate Investigation
- **Memory Management**: Pyodide memory leak patterns
- **Sync Optimization**: LiveStore performance under load
- **Execution Isolation**: Sandboxing for code execution
- **State Recovery**: Handling corrupted state scenarios

### Future Research
- **Conflict-Free Replicated Data Types (CRDTs)**: For text editing
- **Operational Transformation**: Alternative to event sourcing for some use cases
- **WebAssembly**: Alternative to Pyodide for other languages
- **Edge Computing**: Distributed execution across edge nodes

## Non-Goals

### Explicitly Out of Scope
- **Desktop Application**: Web-first approach only
- **Traditional Jupyter Compatibility**: Different architecture and goals
- **Enterprise Features**: Focus on core functionality first
- **Multi-Language Kernels**: Python-first approach for now
- **Real-time Video/Audio**: Text-based collaboration only

### Deferred Indefinitely
- **Offline-first Mobile App**: Web browser sufficient
- **Self-hosted Email/Chat**: External tools preferred
- **Advanced Analytics**: Core notebook functionality priority
- **Marketplace/Plugins**: Simple architecture preferred

## Success Metrics

### Technical Metrics
- **Uptime**: 99%+ availability for core services
- **Performance**: <100ms cell execution queue latency
- **Memory**: Stable memory usage over 24+ hour sessions
- **Sync**: <1s collaboration update propagation

### User Experience Metrics
- **Setup Time**: <5 minutes from clone to running
- **Learning Curve**: Basic usage without documentation
- **Error Recovery**: Graceful handling of common failures
- **Data Safety**: Zero unexpected data loss incidents

## Contributing Guidelines

### Current Priorities
1. **Bug Fixes**: Address known issues list
2. **Documentation**: Improve setup and usage docs
3. **Testing**: Add automated tests for core functionality
4. **Performance**: Profile and optimize critical paths

### How to Help
- **Try the System**: Use Anode for real work and report issues
- **Fix Known Issues**: Pick items from the issues list
- **Improve Documentation**: Update docs as you learn the system
- **Performance Testing**: Help identify bottlenecks and memory leaks

### What We're Not Ready For
- **Major Features**: Core functionality needs stabilization first
- **Architecture Changes**: Current design needs validation
- **Production Deployments**: Not production-ready yet
- **Breaking Changes**: API stability not guaranteed

## Timeline Disclaimers

### Realistic Expectations
- **Dates are estimates**: Priorities may shift based on findings
- **Volunteer Project**: Development speed depends on contributor availability
- **Research Required**: Some items need investigation before implementation
- **Dependencies**: External factors (LiveStore updates, etc.) may impact timeline

### Communication
- **Monthly Updates**: Progress reports on major milestones
- **Issue Tracking**: GitHub Issues for detailed status
- **Community Input**: Roadmap adjustments based on user feedback
- **Transparency**: Open about challenges and blockers

---

**Last Updated**: January 2025
**Next Review**: February 2025
**Status**: Living document - subject to change based on learnings and priorities