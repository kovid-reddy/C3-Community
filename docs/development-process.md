# Development Rules & Stage Exit Criteria

## 15 Development Rules

1. **No circular dependencies.**
2. **No direct infrastructure access from UI.**
3. **No infrastructure implementation details in contracts.**
4. **No module may import another module's internal files.**
5. **Modules communicate through public APIs/contracts.**
6. **Infrastructure implementations must be replaceable.**
7. **External services must have mock adapters for testing.**
8. **Do not create giant cross-module service files.**
9. **Do not mix UI logic with infrastructure logic.**
10. **Every stage must be independently testable.**
11. **Do not proceed to the next stage if the current stage fails its exit criteria.**
12. **Architectural changes require documentation before implementation.**
13. **Do not silently introduce dependencies between modules.**
14. **Secrets must never be committed.**
15. **Do not implement future-stage functionality prematurely.**

---

## Stage 0 Exit Criteria

- [x] Repository structure exists
- [x] TypeScript configuration exists
- [x] npm workspace configuration exists
- [x] Electron/React/Vite foundation is structurally configured
- [x] Contracts package exists
- [x] Core service interfaces are defined
- [x] State machines are documented
- [x] Error model is documented
- [x] IPC architecture is documented
- [x] Configuration architecture is documented
- [x] Security boundaries are documented
- [x] Testing architecture is documented
- [x] Dependency rules are documented
- [x] No circular module dependencies exist
- [x] No feature implementation has been added
- [x] No real credentials exist
- [x] Project builds successfully
- [x] TypeScript validation passes
- [x] Foundation-level tests pass
