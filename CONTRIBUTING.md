# Contributing to DevOps AI Dashboard

Thank you for your interest in contributing to DevOps AI Dashboard! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for everyone.

## Getting Started

### Prerequisites

Before contributing, ensure you have the following installed:

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 22+ | JavaScript runtime |
| pnpm | 9+ | Package manager |
| Docker | 24+ | Container runtime (optional) |
| Git | 2.40+ | Version control |

### Development Setup

```bash
# Fork and clone the repository
git clone https://github.com/YOUR_USERNAME/devops-ai-dashboard.git
cd devops-ai-dashboard

# Install dependencies
pnpm install

# Copy environment file
cp .env.example .env

# Start development server
pnpm dev
```

## Development Workflow

### Branch Naming

Use descriptive branch names following this convention:

| Type | Pattern | Example |
|------|---------|---------|
| Feature | `feature/description` | `feature/add-helm-support` |
| Bug Fix | `fix/description` | `fix/container-restart-loop` |
| Documentation | `docs/description` | `docs/update-api-reference` |
| Refactor | `refactor/description` | `refactor/optimize-queries` |

### Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(kubernetes): add support for StatefulSets
fix(docker): resolve container stats memory leak
docs(readme): update installation instructions
```

## Code Standards

### TypeScript

The project uses TypeScript with strict mode enabled. Follow these guidelines:

1. **Type Safety**: Avoid using `any` type. Define proper interfaces and types.
2. **Null Checks**: Handle null/undefined cases explicitly.
3. **Error Handling**: Use try-catch blocks and proper error types.

```typescript
// Good
interface ContainerStats {
  cpu: number;
  memory: number;
  network: NetworkStats;
}

// Avoid
const stats: any = getStats();
```

### React Components

1. **Functional Components**: Use functional components with hooks.
2. **Props Interface**: Define props interfaces for all components.
3. **Error Boundaries**: Implement error boundaries for critical sections.

```typescript
interface DashboardCardProps {
  title: string;
  value: number;
  trend?: 'up' | 'down' | 'stable';
}

export function DashboardCard({ title, value, trend }: DashboardCardProps) {
  // Component implementation
}
```

### tRPC Procedures

1. **Input Validation**: Use Zod schemas for all inputs.
2. **Error Handling**: Throw TRPCError with appropriate codes.
3. **Authorization**: Use appropriate procedure types (public/protected/admin).

```typescript
export const myRouter = router({
  getData: protectedProcedure
    .input(z.object({
      id: z.string().uuid(),
    }))
    .query(async ({ ctx, input }) => {
      // Implementation
    }),
});
```

## Testing

### Running Tests

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test server/auth.logout.test.ts

# Run tests in watch mode
pnpm test:watch

# Generate coverage report
pnpm test:coverage
```

### Writing Tests

1. **Test File Location**: Place tests next to the code they test with `.test.ts` suffix.
2. **Test Structure**: Use descriptive test names and organize with `describe` blocks.
3. **Mocking**: Mock external dependencies appropriately.

```typescript
import { describe, it, expect, vi } from 'vitest';

describe('ContainerService', () => {
  describe('listContainers', () => {
    it('returns all running containers', async () => {
      // Test implementation
    });

    it('handles Docker API errors gracefully', async () => {
      // Test implementation
    });
  });
});
```

## Pull Request Process

### Before Submitting

1. **Run Tests**: Ensure all tests pass with `pnpm test`
2. **Type Check**: Run `pnpm tsc --noEmit` with no errors
3. **Lint**: Fix any linting issues
4. **Update Docs**: Update documentation if needed

### PR Template

When creating a pull request, include:

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
Describe how you tested the changes

## Checklist
- [ ] Tests pass locally
- [ ] Code follows style guidelines
- [ ] Documentation updated
- [ ] No breaking changes (or documented)
```

### Review Process

1. At least one maintainer must approve the PR
2. All CI checks must pass
3. No merge conflicts with main branch
4. Squash commits before merging (if multiple commits)

## Project Structure

```
devops-ai-dashboard/
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── pages/         # Page components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── contexts/      # React contexts
│   │   └── lib/           # Utilities and helpers
├── server/                 # Backend Express + tRPC
│   ├── routers/           # tRPC routers
│   ├── services/          # Business logic services
│   ├── middleware/        # Express middleware
│   └── _core/             # Core framework (do not modify)
├── drizzle/               # Database schema and migrations
├── shared/                # Shared types and constants
├── pull-agent/            # GitOps deployment agent
├── scripts/               # Utility scripts
└── docker-compose.yml     # Docker configuration
```

## Getting Help

If you need help or have questions:

1. **GitHub Issues**: For bugs and feature requests
2. **GitHub Discussions**: For questions and ideas
3. **Documentation**: Check the README and docs

## Recognition

Contributors will be recognized in:
- The project README
- Release notes for significant contributions
- GitHub contributors page

Thank you for contributing to DevOps AI Dashboard!
