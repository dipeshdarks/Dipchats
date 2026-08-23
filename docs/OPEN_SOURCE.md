# Open Source Guidelines

Welcome to the DipChats open source project. This document covers the guidelines,
policies, and processes for contributing to DipChats.

---

## License

DipChats uses the **MIT License** for its simplicity and permissiveness. It
allows anyone to use, modify, distribute, and sublicense with minimal
restrictions, maximizing adoption while keeping legal overhead low.

| Factor | MIT | Apache 2.0 |
|---|---|---|
| Length | Short, easy to read | Longer, more detailed |
| Patent grant | No explicit patent grant | Explicit patent grant |
| Attribution | Minimal | Requires NOTICE file |
| Suitability | Ideal for this project | Better for enterprise |

The full license text lives in the `LICENSE` file at the repository root.

---

## Copyright Notice

All source files should include:

```typescript
// Copyright (c) 2026 DipChats Contributors
// Licensed under the MIT License. See LICENSE file for details.
```

---

## Contributing

### Development Setup

1. Clone and install:

```bash
git clone https://github.com/dipeshdarks/dipchats.git
cd dipchats
npm install
```

2. Configure and start:

```bash
cp .env.example .env
docker compose up -d
npm run dev
```

3. Verify:

```bash
npm test && npm run lint && npm run typecheck
```

### Prerequisites

- Node.js 22+
- npm (latest stable)
- Docker and Docker Compose
- Git

---

## Code Style

### TypeScript

- Strict mode required.
- Prefer `interface` over `type` for object shapes.
- Avoid `any`. Use `unknown` and narrow with type guards.
- Explicit return types on exported functions.

### ESLint and Prettier

```bash
npm run lint      # Check for lint errors
npm run format    # Auto-format with Prettier
```

Do not disable rules without discussion. Do not mix formatting changes with
functional changes in the same commit.

### General Rules

- 2 spaces, single quotes, semicolons.
- Prefer `const` over `let`. Never use `var`.
- Descriptive names. Small, focused functions.
- Handle errors explicitly. Never silently swallow them.

---

## Commit Message Format

We follow [Conventional Commits](https://www.conventionalcommits.org/).

```
<type>(<scope>): <description>

[optional body]
[optional footer]
```

| Type | When to Use |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `style` | Formatting, no logic change |
| `refactor` | Code restructuring |
| `perf` | Performance improvement |
| `test` | Adding or updating tests |
| `chore` | Build, CI, or tooling |
| `revert` | Reverting a commit |

**Rules:** Imperative mood ("add" not "added"), no capital first letter, no
trailing period, subject under 72 characters. Reference issues in the footer.

---

## Pull Request Process

1. Branch from `main`: `git checkout -b feat/your-feature`
2. Make small, focused commits.
3. Ensure checks pass: `npm run lint && npm run typecheck && npm test`
4. Title follows commit format. Description explains what and why.
5. Include tests for new functionality.
6. At least one maintainer review required.
7. Squash and merge is the default strategy.

---

## Issue Guidelines

### Bug Reports

Include environment details, steps to reproduce, expected vs actual behavior,
and logs or screenshots if applicable.

### Feature Requests

Include problem statement, proposed solution, alternatives considered,
and real use cases.

### Labels

| Label | Meaning |
|---|---|
| `bug` | Confirmed bug |
| `enhancement` | New feature or improvement |
| `good first issue` | Suitable for new contributors |
| `help wanted` | Community contribution welcome |
| `security` | Security-related issue |

File issues at: `https://github.com/dipeshdarks/dipchats/issues`

---

## Security Vulnerability Reporting

**Do not open a public issue for security vulnerabilities.**

Report privately: `security@dipchats.dev`

Include: description, reproduction steps, impact assessment, and any
suggested fix.

| Severity | Description | Response |
|---|---|---|
| Critical | Remote code execution, key compromise | 24-48 hours |
| High | Auth bypass, encryption weakness | 3-7 days |
| Medium | Information disclosure, DoS | 1-2 weeks |
| Low | Minor issues | Next release |

We support safe harbor for security researchers who report through private
channels and avoid accessing other users' data.

---

## Release Process

Semantic versioning: `MAJOR.MINOR.PATCH`

- **MAJOR**: Breaking changes.
- **MINOR**: New features, backward compatible.
- **PATCH**: Bug fixes, backward compatible.

### Steps

1. Changes merged to `main`.
2. Release branch: `release/vX.Y.Z`.
3. Update versions in `package.json` and relevant files.
4. Update `CHANGELOG.md` (Keep a Changelog format).
5. CI runs full test suite.
6. Maintainer tags and publishes.
7. Branch merged to `main` and deleted.

---

## Code of Conduct

All contributors must follow our Code of Conduct (`CODE_OF_CONDUCT.md`).

**Summary:** Be respectful, inclusive, and professional. Keep discussions
focused on the project. Harassment, discrimination, personal attacks, and
publishing others' private information without consent are not tolerated.

Maintainers may remove comments, ban contributors, or reject pull requests
that violate the Code of Conduct.

---

## Recognition and Contributors

We value every contribution. Contributors are listed in `CONTRIBUTORS.md`
and significant contributions are highlighted in release notes.

**Ways to contribute:** Code, documentation, testing, community support,
answering questions, triaging issues, and reviewing PRs.

**First-time contributors:** Look for `good first issue` labels. Open a
discussion or comment on an issue if you need help getting started.

---

*Last updated: August 2026*
