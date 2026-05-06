# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

nanogit is a lightweight, HTTPS-only Git implementation written in Go, designed for cloud-native environments. It provides essential Git operations optimized for server-side usage with pluggable storage backends, developed by Grafana as an alternative to full Git implementations in multitenant cloud services.

## Development Commands

### Code Generation
```bash
make generate          # Generate mocks using counterfeiter
```

### Code Quality
```bash
make fmt               # Format code with goimports
make lint              # Run golangci-lint
make lint-staticcheck  # Run staticcheck
```

### Testing
```bash
make test              # Run all tests (unit + integration)
make test-unit         # Run unit tests only (fast, no Docker required)
make test-integration  # Run integration tests (requires Docker)
make test-providers    # Test against real Git providers (GitHub, GitLab, etc.)
make test-coverage     # Generate coverage reports
make test-coverage-html # View coverage in browser

# Performance tests (in perf/ directory)
cd perf && make test-perf-setup    # One-time setup for performance tests
cd perf && make test-perf-simple   # Quick consistency tests
cd perf && make test-perf-all      # Full performance benchmark suite
cd perf && make help               # See all performance testing targets

# Performance profiling (in perf/ directory)
cd perf && make profile-baseline   # Create baseline profiles before optimization
cd perf && make profile-cpu        # Generate CPU profile for analysis
cd perf && make profile-mem        # Generate memory profile for analysis
cd perf && make profile-compare    # Compare current vs baseline performance
```

## Architecture Overview

### Core Design Principles
- **Stateless operations**: No local .git directory dependency
- **HTTPS-only**: Cloud-focused, no SSH or git:// protocol support
- **Pluggable storage**: Configurable backends via context
- **Minimal surface area**: Essential Git operations only

### Key Components

**Main Interfaces** (`client.go`, `writer.go`):
- `Client`: Primary interface for Git read operations
- `StagedWriter`: Transactional interface for batched write operations

**Protocol Layer** (`protocol/`):
- Git Smart HTTP Protocol implementation
- Object processing (blobs, commits, trees, deltas, pack files)
- Reference resolution and management
- Authentication handling

**Storage System** (`storage/`):
- Context-based pluggable storage backends
- Default in-memory implementation
- Custom storage implementations via dependency injection

### Testing Architecture

**Unit Tests**: 
- Use `testify/require` (preferred) and `testify/assert`
- Generated mocks via `counterfeiter` (run `make generate`)
- Focus on individual component behavior

**Integration Tests** (`tests/`):
- Ginkgo/Gomega framework
- Real Git server testing using Testcontainers with Gitea
- Provider compatibility tests against GitHub, GitLab, Bitbucket
- Requires Docker for execution

**Performance Tests** (`perf/`):
- Separate Go module with dedicated Makefile
- Multi-client benchmarking (nanogit vs go-git vs git CLI)
- Containerized testing with realistic repository data
- Multiple repository sizes and operation types
- Network latency simulation capabilities
- Comprehensive metrics collection and reporting
- See `tests/performance/README.md` for detailed documentation

## Development Notes

### Dependencies
- **Go 1.24+** required
- Minimal external dependencies, heavy use of standard library
- Key test frameworks: Ginkgo/Gomega, testify, counterfeiter

### Code Style
- Standard Go formatting enforced via `goimports`
- Comprehensive linting with `golangci-lint` and `staticcheck`
- Error wrapping with context for debugging
- Godoc required for all exported APIs

### Comparison to go-git
nanogit is **not** a drop-in replacement for go-git. Key differences:
- **Protocol support**: HTTPS-only vs. all Git protocols
- **State management**: Stateless vs. local filesystem operations  
- **Scope**: Essential operations vs. full Git functionality
- **Target use case**: Cloud services vs. general-purpose Git operations