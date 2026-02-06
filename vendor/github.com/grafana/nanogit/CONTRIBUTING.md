# Contributing to NanoGit

Thank you for your interest in contributing to NanoGit! This document provides guidelines and instructions for contributing to the project.

## Code of Conduct

Please read and follow our [Code of Conduct](CODE_OF_CONDUCT.md) to keep our community approachable and respectable.

## Prerequisites

Before you begin contributing, ensure you have the following installed:

* [Docker](https://docs.docker.com/get-docker/) - Required for running integration tests
* Go 1.24 or later
* Git

## How to Contribute

### Reporting Bugs

Before creating bug reports, please check the issue list as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible:

* Use a clear and descriptive title
* Describe the exact steps to reproduce the problem
* Provide specific examples to demonstrate the steps
* Describe the behavior you observed after following the steps
* Explain which behavior you expected to see instead and why
* Include screenshots if possible
* Include the output of any error messages

### Suggesting Enhancements

If you have a suggestion for a new feature or enhancement, please include as much detail as possible:

* Use a clear and descriptive title
* Provide a step-by-step description of the suggested enhancement
* Provide specific examples to demonstrate the steps
* Describe the current behavior and explain which behavior you expected to see instead
* Explain why this enhancement would be useful to most users

### Pull Requests

1. Fork the repo and create your branch from `main`
2. If you've added code that should be tested, add tests
3. If you've changed APIs, update the documentation
4. Ensure the test suite passes
5. Make sure your code lints
6. Follow our commit message convention (see below)
7. Issue that pull request!

### Commit Message Convention

We use [Conventional Commits](https://www.conventionalcommits.org/) to automate versioning and changelog generation. Each commit message must follow this format:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Type** (required) - Must be one of:
* `feat:` - A new feature (triggers **MINOR** version bump, e.g., v0.1.0 → v0.2.0)
* `fix:` - A bug fix (triggers **PATCH** version bump, e.g., v0.1.0 → v0.1.1)
* `perf:` - Performance improvement (triggers **PATCH** version bump)
* `docs:` - Documentation only changes (no release)
* `style:` - Code style changes, formatting (no release)
* `refactor:` - Code refactoring without feature changes (no release)
* `test:` - Adding or updating tests (no release)
* `chore:` - Maintenance tasks, dependencies (no release)
* `ci:` - CI/CD changes (no release)
* `build:` - Build system changes (no release)

**Scope** (optional) - The area of the codebase affected (e.g., `client`, `writer`, `storage`, `protocol`)

**Breaking Changes** - Add `!` after type or include `BREAKING CHANGE:` in footer to trigger **MAJOR** version bump (e.g., v0.1.0 → v1.0.0)

**Examples:**

```bash
# Patch release (v0.1.0 → v0.1.1)
fix: resolve authentication timeout issue

fix(protocol): handle empty packfile responses correctly

# Minor release (v0.1.0 → v0.2.0)
feat: add support for shallow clones

feat(storage): implement Redis storage backend

# Major release (v0.1.0 → v1.0.0)
feat!: redesign Client interface for better performance

feat(api): remove deprecated methods

BREAKING CHANGE: Client.GetRef() now returns pointer instead of value

# No release
docs: update README with new examples

chore: update dependencies

test: add integration tests for authentication
```

**Important Notes:**
* Each merged PR automatically triggers a release based on commit messages
* Multiple commits in a PR: the highest version bump wins (major > minor > patch)
* Non-release commits (docs, chore, etc.) won't trigger a release
* Make sure your commit type accurately reflects the change
* Breaking changes should be clearly documented in the commit body

**Tools:**
* Use `git commit` with the format above
* PR titles don't need to follow this format (only commit messages matter)
* Our CI will automatically create releases and update the CHANGELOG

For more details, see [Conventional Commits specification](https://www.conventionalcommits.org/).

### Development Process

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/nanogit.git
   cd nanogit
   ```

2. Install dependencies:
   ```bash
   go mod download
   ```

3. Create a new branch for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   ```

4. Make your changes and commit them:
   ```bash
   git add .
   git commit -m "Description of your changes"
   ```

5. Push your changes:
   ```bash
   git push origin feature/your-feature-name
   ```

6. Create a Pull Request from your branch to `main`

### Testing

We use Go's built-in testing framework with [testify](https://github.com/stretchr/testify) for unit tests and [Ginkgo](https://onsi.github.io/ginkgo/) with [Gomega](https://onsi.github.io/gomega/) for integration tests. To run the tests:

```bash
make test # run all tests
make test-unit # run only unit tests
make test-integration # run only integration tests (requires Docker)
```

#### Unit Tests

Unit tests are located alongside the code they test (e.g., `client_test.go` in the same directory as `client.go`). We use testify's `assert` and `require` packages for assertions:

```go
import (
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"
)

func TestSomething(t *testing.T) {
    // Use require for setup/teardown that must succeed
    require.NoError(t, err)
    
    // Use assert for test conditions
    assert.Equal(t, expected, actual)
}
```

**Note**: unit tests in the root package include `unit` to distinguish them from integration test ones (e.g. `client_unit_test.go`).

#### Integration Tests

Integration tests are located in the root directory and use [Ginkgo](https://onsi.github.io/ginkgo/) as the testing framework with [Gomega](https://onsi.github.io/gomega/) for assertions. We migrated from testify to Ginkgo for integration tests due to several key advantages:

**Why We Use Ginkgo for Integration Tests:**

1. **Better Parallel Support**: Ginkgo has native, robust parallel test execution that doesn't suffer from the race conditions we encountered with testify's `t.Parallel()`
2. **Shared Resource Management**: Built-in `BeforeSuite`/`AfterSuite` hooks allow us to efficiently share expensive resources like Docker containers across all tests
3. **Thread-Safe Logging**: Ginkgo's `GinkgoWriter` eliminates data races that occurred when multiple goroutines tried to write to `testing.T` simultaneously
4. **Better Test Organization**: Ginkgo's `Describe`/`Context`/`It` structure provides clearer test hierarchy and better readability
5. **Focused/Pending Tests**: Easy test filtering and skipping with `--focus` and `--skip` flags
6. **Rich Reporting**: Better test output with timing, progress indicators, and failure details

**Key Features:**
- Tests use a shared Git server container (Gitea) for better performance and isolation
- Automatic container lifecycle management with proper cleanup
- Thread-safe test infrastructure that eliminates data races
- Parallel test execution support without race conditions
- Uses `internal/testhelpers/` for shared test utilities
- Real Git server testing using [Gitea](https://gitea.io/) in a Docker container

**Test Structure:**
```bash
internal/
├── testhelpers/
│   ├── gitserver.go          # Gitea container management
│   ├── remoterepo.go         # Remote repository helpers
│   ├── localrepo.go          # Local repository helpers
│   └── logger.go             # Thread-safe logging
| integration_suite_test.go # Main test suite with shared setup
| auth_integration_test.go             # Authentication integration tests
| refs_integration_test.go             # Reference operation tests
| writer_integration_test.go           # Writer operation tests
| ...                      # Other integration test files
```

**Example Ginkgo Test:**
```go
import (
    . "github.com/onsi/ginkgo/v2"
    . "github.com/onsi/gomega"
)

var _ = Describe("Feature", func() {
    Context("when condition is met", func() {
        It("should behave correctly", func() {
            // Setup
            client, _, local, _ := QuickSetup()
            
            // Test
            result, err := client.SomeOperation(context.Background())
            
            // Assertions
            Expect(err).NotTo(HaveOccurred())
            Expect(result).To(Equal(expected))
        })
    })
})
```

**Running Integration Tests:**

To run all integration tests:
```bash
make test-integration
```

To run specific tests:
```bash
ginkgo --focus="Authentication"
```

To run tests with verbose output:
```bash
ginkgo -v
```

To run tests in parallel:
```bash
ginkgo -p
```

**Note**: Integration tests require Docker to be running on your machine.

#### Performance Tests

nanogit includes a comprehensive performance testing suite to benchmark and compare nanogit against go-git and git CLI across various Git operations. These tests help ensure that performance improvements don't introduce regressions and provide insights into nanogit's relative performance.

**Location**: `perf/` (separate Go module)

**Key Features**:
- Containerized testing with Gitea servers for isolation
- Multi-client comparison (nanogit, go-git, git CLI)
- Multiple repository sizes (small, medium, large, xlarge)
- Realistic test scenarios with pre-generated repository data
- Network latency simulation for real-world conditions
- Comprehensive metrics collection and reporting

**Quick Start**:
```bash
# Generate test repository data (one-time setup)
cd perf && make test-perf-setup

# Run basic consistency tests
make test-perf-simple

# Run all performance benchmarks  
make test-perf-all
```

**Common Targets**:
- `test-perf-simple` - Quick consistency verification (~3 min)
- `test-perf-consistency` - Full client comparison (~5 min)
- `test-perf-file-ops` - File operations benchmarks (~8 min)
- `test-perf-tree` - Tree listing performance (~4 min)
- `test-perf-bulk` - Bulk operations performance (~7 min)
- `test-perf-small` - All tests on small repositories only (~3 min)

**Requirements**:
- Docker (for testcontainers)
- Git CLI (for git-cli client testing)
- Separate Go module in `perf/`

For detailed documentation, usage examples, and configuration options, see [perf/README.md](perf/README.md).

**Test Data Generation**:
- `generate_repo` - Creates realistic Git repositories of various sizes for testing
- `generate_dashboards` - Creates realistic Grafana dashboards for testing large JSON files and complex Git content

For dashboard generation documentation, see [perf/cmd/generate_dashboards/README.md](perf/cmd/generate_dashboards/README.md).

**Performance Profiling and Analysis**:

The performance test suite includes comprehensive profiling tools to analyze CPU and memory usage patterns. These tools are essential for identifying bottlenecks, measuring optimization impact, and ensuring performance regressions don't occur.

**Profiling Targets** (from `perf/` directory):
```bash
# Generate baseline profiles (run before making optimizations)
make profile-baseline

# Generate CPU profile for file operations
make profile-cpu

# Generate memory profile for file operations  
make profile-mem

# Generate both CPU and memory profiles
make profile-all

# Profile specific operations
make profile-all-tree    # Profile tree operations
make profile-all-commit  # Profile commit operations

# Compare current profiles with baseline
make profile-compare

# Clean up profile files
make profile-clean
```

**Profile Analysis Workflow**:
1. **Create baseline**: `make profile-baseline` - establishes performance baseline before optimizations
2. **Make changes**: Implement your optimizations or changes
3. **Generate new profiles**: `make profile-cpu` or `make profile-mem` 
4. **Compare results**: `make profile-compare` - shows performance differences
5. **Analyze bottlenecks**: Use `go tool pprof` for detailed analysis

**Manual Profile Analysis**:
```bash
# Interactive CPU analysis
go tool pprof profiles/cpu.prof

# Interactive memory analysis  
go tool pprof profiles/mem.prof

# Web-based analysis (opens browser)
go tool pprof -http=:8080 profiles/cpu.prof

# Compare two profiles
go tool pprof -diff_base=profiles/baseline_cpu.prof profiles/cpu.prof

# Top functions by CPU usage
go tool pprof -top profiles/cpu.prof

# Generate flame graph
go tool pprof -png profiles/cpu.prof > cpu_profile.png
```

**Profile Files Location**:
- `profiles/cpu.prof` - Current CPU profile
- `profiles/mem.prof` - Current memory profile  
- `profiles/baseline_cpu.prof` - Baseline CPU profile
- `profiles/baseline_mem.prof` - Baseline memory profile

**Common Profiling Use Cases**:
- **Before optimization**: Create baseline with `make profile-baseline`
- **After optimization**: Generate new profiles and compare with `make profile-compare`
- **Memory leak detection**: Use `make profile-mem` and analyze allocation patterns
- **CPU hotspot identification**: Use `make profile-cpu` and examine top functions
- **Performance regression testing**: Compare profiles between code versions

**Tips for Effective Profiling**:
- Always create a baseline before making changes
- Profile the same operations for consistent comparisons  
- Use realistic data sizes (medium or large repositories)
- Run profiles multiple times to account for variance
- Focus on the top consumers (functions using >1% of resources)
- Look for unexpected allocations or inefficient algorithms

**Note**: Performance tests are resource-intensive and disabled by default. They require `RUN_PERFORMANCE_TESTS=true` environment variable and Docker to be running.

#### Provider Tests

Provider tests validate nanogit's compatibility with various Git hosting services (GitHub, GitLab, etc.) by executing real-world workflows. These end-to-end tests ensure the client library functions correctly with actual Git providers, catching any significant integration issues or breaking changes.

These tests require specific environment variables to be set:
- `TEST_REPO`: The URL of the test repository
- `TEST_TOKEN`: Authentication token for the repository

To run provider tests:
```bash
export TEST_REPO=https://github.com/grafana/nanogit-test.git
export TEST_USER=git
export TEST_TOKEN=<SOMETOKEN>
make test-providers
```
Our CI pipeline includes provider tests against: 
- GitHub using [grafana/nanogit-test](https://github.com/grafana/nanogit-test.git).
- Gitlab using [grafana/nanogit-test](https://gitlab.com/grafana7281924/nanogit-test.git).
- Bitbucket using [grafana/nanogit-test](https://bitbucket.org/nanogit-test/nanogit-test)

#### Writing Tests

1. **Unit tests** should be fast and not require external dependencies
2. **Integration tests** should be in the `test/` directory using Ginkgo
3. Use testify's `assert` and `require` packages for unit tests, and Gomega matchers for integration tests
4. Follow Go's testing best practices
5. Add appropriate test coverage
6. Use `QuickSetup()` helper for integration tests that need a basic repository setup

For more information:
- [Go Testing Documentation](https://pkg.go.dev/testing)
- [Testify Documentation](https://pkg.go.dev/github.com/stretchr/testify)
- [Ginkgo Documentation](https://onsi.github.io/ginkgo/)
- [Gomega Documentation](https://onsi.github.io/gomega/)
- [Testcontainers-go Documentation](https://golang.testcontainers.org/)
- [Gitea Documentation](https://docs.gitea.io/)

### Testing with Mocks

nanogit includes generated mocks for easy unit testing using [counterfeiter](https://github.com/maxbrunsfeld/counterfeiter). 

To regenerate mocks after interface changes:

```bash
make generate
```

The generated mocks are located in the `mocks/` directory and provide test doubles for both `Client` and `StagedWriter` interfaces. See [mocks/example_test.go](mocks/example_test.go) for complete usage examples.

### Code Style

* Follow the [Go Code Review Comments](https://github.com/golang/go/wiki/CodeReviewComments)
* Use `make fmt` to format your code.
* Run `make lint` to check for style issues.

### Editor Settings

#### Cursor

We provide rules for cursor in `.cursor` directory that defines our coding standards and best practices. The rules cover:

* Code style and formatting
* Testing requirements
* Error handling patterns
* Documentation standards
* Security considerations
* Performance guidelines
* Git protocol compliance
* Code organization
* Versioning practices
* CI/CD requirements
* Code review guidelines
* Maintenance standards
* Accessibility requirements
* Extensibility guidelines

To use these rules in Cursor:
1. Open the project in Cursor
2. The rules will be automatically loaded
3. Cursor will provide inline suggestions based on these rules


### Contributing to Cursor Rules

We welcome contributions to improve our Cursor rules! The rules are designed to help maintain code quality and consistency, but they're not set in stone. If you have suggestions for improvements or find areas that could be enhanced, please feel free to contribute.

#### How to Contribute to Rules

1. **Identify Areas for Improvement**
   - Look for patterns that could be better enforced
   - Identify missing best practices
   - Suggest clearer guidelines for existing rules

2. **Propose Changes**
   - Open an issue to discuss proposed changes
   - Explain the rationale behind your suggestions
   - Provide examples of how the changes would improve the codebase

3. **Submit Pull Requests**
   - Update the relevant rule files in the `.cursor` directory
   - Include clear documentation for any new rules
   - Add examples where appropriate

4. **Review Process**
   - All rule changes will be reviewed by maintainers
   - Changes should align with the project's goals
   - Consider the impact on existing code

#### Rule Categories

Feel free to contribute to any of these categories:

* **Code Style**: Suggest improvements to formatting and style guidelines
* **Testing**: Propose new testing requirements or best practices
* **Error Handling**: Enhance error handling patterns
* **Documentation**: Improve documentation standards
* **Security**: Add new security considerations
* **Performance**: Suggest performance optimizations
* **Git Protocol**: Enhance Git protocol compliance rules
* **Code Organization**: Propose better code structure guidelines
* **Versioning**: Improve versioning practices
* **CI/CD**: Add new CI/CD requirements
* **Code Review**: Enhance code review guidelines
* **Maintenance**: Suggest maintenance standards
* **Accessibility**: Add accessibility requirements
* **Extensibility**: Propose extensibility guidelines

#### Best Practices for Rule Contributions

1. **Keep Rules Clear and Concise**
   - Rules should be easy to understand
   - Avoid overly complex requirements
   - Provide clear examples

2. **Consider Impact**
   - Evaluate the impact on existing code
   - Consider the learning curve for new contributors
   - Balance strictness with practicality

3. **Documentation**
   - Include clear explanations for new rules
   - Provide examples of correct and incorrect usage
   - Link to relevant documentation or resources

4. **Testing**
   - Test rules against existing code
   - Ensure rules don't conflict with each other
   - Verify rules work as expected in Cursor

Remember, the goal is to make the development experience better for everyone. Your contributions can help shape the future of this project's development standards.


### Documentation

The nanogit documentation site is built with [VitePress](https://vitepress.dev) and published at [grafana.github.io/nanogit](https://grafana.github.io/nanogit).

#### Documentation Structure

```
docs/
├── .vitepress/
│   └── config.mts              # VitePress configuration
├── index.md                    # Home page
├── getting-started/
│   ├── installation.md         # Installation instructions
│   └── quick-start.md          # Quick start guide
├── architecture/
│   ├── overview.md             # Architecture overview
│   ├── storage.md              # Storage backend architecture
│   ├── delta-resolution.md     # Delta resolution implementation
│   └── performance.md          # Performance characteristics
└── changelog.md                # Version history (auto-copied from CHANGELOG.md)
```

**Note**: Only `changelog.md` is copied from the root `CHANGELOG.md` during the build process. All other documentation files live directly in the `docs/` directory. API documentation is on [GoDoc](https://pkg.go.dev/github.com/grafana/nanogit), not duplicated in the site.

#### Building Documentation Locally

**Prerequisites:**
- Node.js 18+ and npm

**Installation:**

```bash
# Install dependencies
npm install

# Or use make target
make docs-install
```

**Build and Serve:**

```bash
# Serve with live reload (recommended for development)
make docs

# Or use individual targets:
make docs-prepare    # Copy CHANGELOG.md to docs/
make docs-serve      # Serve at http://localhost:5173
make docs-build      # Build static site
make docs-preview    # Preview built site

# Or use npm scripts directly:
npm run docs:dev     # Development server
npm run docs:build   # Build for production
npm run docs:preview # Preview production build
```

The documentation will be available at `http://localhost:5173/nanogit/`.

#### Contributing to Documentation

1. **Edit existing pages**: Modify the Markdown files in the appropriate directory
2. **Add new pages**: Create new Markdown files and update the sidebar config in `docs/.vitepress/config.mts`
3. **Test locally**: Run `make docs` to preview your changes
4. **Submit PR**: Follow the standard contribution process

**Documentation Guidelines:**
- Update documentation for any new features or changes
- Use clear, concise language
- Include code examples where appropriate
- Use proper Markdown formatting
- Add links to related documentation
- Keep navigation structure simple and intuitive
- Test locally with `make docs-build` before submitting PR

#### Deployment

Documentation is automatically built and deployed to GitHub Pages when changes are pushed to the `main` branch via the `.github/workflows/docs.yml` workflow.

## Getting Help

If you need help, you can:

* Open an issue
* Check the existing documentation

## License

By contributing to NanoGit, you agree that your contributions will be licensed under the project's [Apache License 2.0](LICENSE.md). 