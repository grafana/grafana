<div align="center">
  <img src=".github/assets/banner.png" alt="nanogit - Git reimagined for the cloud – in Go" width="800">
</div>

<p align="center">
  <a href="https://github.com/grafana/nanogit/releases"><img src="https://img.shields.io/github/v/release/grafana/nanogit" alt="GitHub Release"></a>
  <a href="LICENSE.md"><img src="https://img.shields.io/github/license/grafana/nanogit" alt="License"></a>
  <a href="https://goreportcard.com/report/github.com/grafana/nanogit"><img src="https://goreportcard.com/badge/github.com/grafana/nanogit" alt="Go Report Card"></a>
  <a href="https://godoc.org/github.com/grafana/nanogit"><img src="https://godoc.org/github.com/grafana/nanogit?status.svg" alt="GoDoc"></a>
  <a href="https://codecov.io/gh/grafana/nanogit"><img src="https://codecov.io/gh/grafana/nanogit/branch/main/graph/badge.svg" alt="codecov"></a>
</p>

<p align="center">
  📚 <strong><a href="https://grafana.github.io/nanogit">Read the full documentation at grafana.github.io/nanogit</a></strong>
</p>

## Overview

nanogit is a lightweight, cloud-native Git implementation designed for applications that need efficient Git operations over HTTPS without the complexity and resource overhead of traditional Git implementations.

## Features

- **HTTPS-only Git operations** - Works with any Git service supporting Smart HTTP Protocol v2 (GitHub, GitLab, Bitbucket, etc.), eliminating the need for SSH key management in cloud environments

- **Stateless architecture** - No local .git directory dependency, making it perfect for serverless functions, containers, and microservices where persistent local state isn't available or desired

- **Memory-optimized design** - Streaming packfile operations and configurable writing modes minimize memory usage, crucial for bulk operations and memory-constrained environments

- **Flexible storage architecture** - Pluggable object storage and configurable writing modes allow optimization for different deployment patterns, from high-performance in-memory operations to memory-efficient disk-based processing

- **Cloud-native authentication** - Built-in support for Basic Auth and API tokens, designed for automated workflows and CI/CD systems without interactive authentication

- **Essential Git operations** - Focused on core functionality (read/write objects, commit operations, diffing) without the complexity of full Git implementations, reducing attack surface and resource requirements

- **High performance** - Significantly faster than traditional Git implementations for common cloud operations, with up to 300x speed improvements for certain scenarios

## Non-Goals

The following features are explicitly not supported:

- `git://` and Git-over-SSH protocols
- File protocol (local Git operations)
- Commit signing and signature verification
- Git hooks
- Git configuration management
- Direct .git directory access
- "Dumb" servers
- Complex permissions (all objects use mode 0644)

## Why nanogit?

While [go-git](https://github.com/go-git/go-git) is a mature Git implementation, nanogit is designed for cloud-native, multitenant environments requiring minimal, stateless operations.

| Feature        | nanogit                                                | go-git                 |
| -------------- | ------------------------------------------------------ | ---------------------- |
| Protocol       | HTTPS-only                                             | All protocols          |
| Storage        | Stateless, configurable object storage + writing modes | Local disk operations  |
| Cloning        | Path filtering with glob patterns, shallow clones      | Full repository clones |
| Scope          | Essential operations only                              | Full Git functionality |
| Use Case       | Cloud services, multitenant                            | General purpose        |
| Resource Usage | Minimal footprint                                      | Full Git features      |

Choose nanogit for lightweight cloud services requiring stateless operations and minimal resources. Use go-git when you need full Git functionality, local operations, or advanced features.

This are some of the performance differences between nanogit and go-git in some of the measured scenarios:

| Scenario                                  | Speed       | Memory Usage |
| ----------------------------------------- | ----------- | ------------ |
| CreateFile (XL repo)                      | 306x faster | 186x less    |
| UpdateFile (XL repo)                      | 291x faster | 178x less    |
| DeleteFile (XL repo)                      | 302x faster | 175x less    |
| BulkCreateFiles (1000 files, medium repo) | 607x faster | 11x less     |
| CompareCommits (XL repo)                  | 60x faster  | 96x less     |
| GetFlatTree (XL repo)                     | 258x faster | 160x less    |

For detailed performance metrics, see the [latest performance report](perf/LAST_REPORT.md) and [performance analysis](docs/architecture/performance.md).

## Getting Started

### Prerequisites

- Go 1.24 or later.
- Git (for development)

### Installation

Install the latest version:

```bash
go get github.com/grafana/nanogit@latest
```

Or install a specific version:

```bash
go get github.com/grafana/nanogit@v0.x.x # Replace v0.x.x with the latest released version
```

See all available versions on the [releases page](https://github.com/grafana/nanogit/releases).

### Usage

```go
// Create client with authentication
client, err := nanogit.NewHTTPClient(
    "https://github.com/user/repo.git",
    options.WithBasicAuth("username", "token"),
)

// Get main branch and create staged writer
ref, err := client.GetRef(ctx, "refs/heads/main")
writer, err := client.NewStagedWriter(ctx, ref)

// Create and update files
writer.CreateBlob(ctx, "docs/new-feature.md", []byte("# New Feature"))
writer.UpdateBlob(ctx, "README.md", []byte("Updated content"))

// Commit changes with proper author/committer info
author := nanogit.Author{
    Name:  "John Doe",
    Email: "john@example.com",
    Time:  time.Now(),
}
committer := nanogit.Committer{
    Name:  "Deploy Bot",
    Email: "deploy@example.com",
    Time:  time.Now(),
}

commit, err := writer.Commit(ctx, "Add feature and update docs", author, committer)
writer.Push(ctx)
```

### Cloning Repositories with Path Filtering

nanogit provides efficient cloning with flexible path filtering, ideal for CI environments where only specific directories are needed:

```go
// First, get the commit hash for the branch you want to clone
ref, err := client.GetRef(ctx, "main")
if err != nil {
    return err
}

// Clone specific directories only (perfect for CI with no caching)
result, err := client.Clone(ctx, nanogit.CloneOptions{
    Path:         "/tmp/my-repo",        // Local filesystem path (required)
    Hash:         ref.Hash,              // Commit hash (required)
    IncludePaths: []string{"src/**", "docs/**"}, // Include only these paths
    ExcludePaths: []string{"*.tmp", "node_modules/**"}, // Exclude these paths
})
if err != nil {
    return err
}

// result.Commit contains the commit information
// result.FlatTree contains filtered file tree
// Files are automatically written to result.Path
fmt.Printf("Cloned %d of %d files to %s\n",
    result.FilteredFiles, result.TotalFiles, result.Path)
```

Key clone features:

- **Path filtering**: Use glob patterns to include/exclude specific files and directories
- **Filesystem output**: Automatically writes filtered files to specified local path
- **Shallow clones**: Fetch only the latest commit to minimize bandwidth
- **Branch isolation**: Clone only specific branches to reduce transfer time
- **CI optimized**: Perfect for build environments with no persistent storage
- **Performance tuning**: Configurable batch fetching and concurrency for optimal performance

#### Performance Optimization Options

The Clone operation supports two key performance optimization options to significantly improve cloning speed:

```go
// Clone with performance optimizations
result, err := client.Clone(ctx, nanogit.CloneOptions{
    Path:         "/tmp/my-repo",
    Hash:         ref.Hash,
    IncludePaths: []string{"pkg/api/**"},
    BatchSize:    50,      // Fetch 50 blobs per network request
    Concurrency:  8,       // Use 8 concurrent workers
})
```

**BatchSize** - Controls how many blobs to fetch in a single network request:

- **Value 0 or 1**: Fetches blobs individually (backward compatible, default behavior)
- **Values > 1**: Enables batch fetching, reducing network round trips by 50-70%
- Automatically falls back to individual fetching if a blob is missing from a batch response
- Recommended for repositories with many files to minimize network overhead
- Recommended value: 20-100 depending on average blob size and network conditions

**Concurrency** - Controls parallel blob fetching:

- **Value 0 or 1**: Sequential fetching (backward compatible, default behavior)
- **Values > 1**: Enables concurrent fetching using worker pools
- Works with both batch fetching (fetches multiple batches in parallel) and individual fetching
- Recommended value: 4-10 depending on network conditions and server capacity
- Can improve performance by 2-3x on high-latency networks

**Performance Impact**: Combined optimization (BatchSize=50, Concurrency=8) can achieve 5-10x speedup compared to default sequential fetching, making it ideal for CI/CD environments and large repository operations.

### Configurable Writing Modes

nanogit provides flexible writing modes to optimize memory usage during write operations:

```go
// Auto mode (default) - smart memory/disk switching
writer, err := client.NewStagedWriter(ctx, ref)

// Memory mode - maximum performance
writer, err := client.NewStagedWriter(ctx, ref, nanogit.WithMemoryStorage())

// Disk mode - minimal memory usage for bulk operations
writer, err := client.NewStagedWriter(ctx, ref, nanogit.WithDiskStorage())
```

For detailed information about writing modes, performance characteristics, and use cases, see [Storage Architecture Documentation](docs/architecture/storage.md).

### Retry Mechanism

nanogit includes a pluggable retry mechanism, making operations more robust against transient network errors and server issues. The retry mechanism follows the same pattern as storage options, using context-based injection.

#### Basic Usage

By default, no retries are performed (backward compatible). To enable retries, inject a retrier into the context:

```go
import "github.com/grafana/nanogit/retry"

// Create a retrier with default settings (3 attempts, exponential backoff)
retrier := retry.NewExponentialBackoffRetrier()
ctx = retry.ToContext(ctx, retrier)

// All HTTP operations will now use retry logic
client, err := nanogit.NewHTTPClient(repo, options...)
ref, err := client.GetRef(ctx, "main")
```

#### Built-in Retrier

The `ExponentialBackoffRetrier` provides configurable exponential backoff retry logic:

```go
// Customize retry behavior
retrier := retry.NewExponentialBackoffRetrier().
    WithMaxAttempts(5).                    // Retry up to 5 times
    WithInitialDelay(200 * time.Millisecond). // Start with 200ms delay
    WithMaxDelay(10 * time.Second).        // Cap at 10 seconds
    WithMultiplier(2.0).                   // Double delay each retry
    WithJitter()                          // Add random jitter

ctx = retry.ToContext(ctx, retrier)
```

#### Custom Retrier

You can implement your own retry logic by implementing the `Retrier` interface:

```go
type MyRetrier struct {
    // Your custom fields
}

func (r *MyRetrier) ShouldRetry(ctx context.Context, err error, attempt int) bool {
    // Your retry logic
    return true
}

func (r *MyRetrier) Wait(ctx context.Context, attempt int) error {
    // Your backoff logic
    return nil
}

func (r *MyRetrier) MaxAttempts() int {
    return 3
}

// Use your custom retrier
ctx = retry.ToContext(ctx, &MyRetrier{})
```

#### What Gets Retried

The retry mechanism automatically retries on:
- **Network timeout errors**
- **5xx server errors**: Server unavailable errors (for GET requests only)
- **Temporary errors**: Any error marked as temporary

The retry mechanism does **not** retry on:
- **4xx client errors**: Bad requests, authentication failures, etc.
- **Context cancellation**: When the context is cancelled or deadline exceeded
- **POST request 5xx errors**: POST requests cannot retry 5xx errors because the request body (`io.Reader`) is consumed when the request is sent and cannot be re-read

#### Retry Behavior by Request Type

- **GET requests** (SmartInfo): Retry on network errors and 5xx status codes
- **POST requests** (UploadPack, ReceivePack): Retry only on network errors (before response is received)

This limitation exists because POST request bodies are consumed during the HTTP request and cannot be re-read for retries.

## Storage Architecture

nanogit features a flexible two-layer storage architecture that separates concerns and allows independent optimization:

1. **Writing modes**: Control temporary storage during packfile creation (memory/disk/auto)
2. **Object storage**: Handle long-term caching and retrieval of Git objects (pluggable backends)

### Object Storage and Caching

nanogit provides context-based object storage with pluggable backends. The default in-memory implementation is optimized for stateless operations, but you can implement custom backends for persistent caching:

```go
// Custom storage example
ctx = storage.ToContext(ctx, myRedisStorage)
client, err := nanogit.NewHTTPClient(repo, options...)
```

This enables sharing Git object cache across multiple repositories, persistent caching across service restarts, and optimization for specific deployment patterns.

For detailed information about storage architecture, writing modes, and custom implementations, see [Storage Architecture Documentation](STORAGE_ARCHITECTURE.md).

## Testing

nanogit includes generated mocks for easy unit testing. The mocks are generated using [counterfeiter](https://github.com/maxbrunsfeld/counterfeiter) and provide comprehensive test doubles for both the `Client` and `StagedWriter` interfaces.

For detailed testing examples and instructions, see [CONTRIBUTING.md](CONTRIBUTING.md#testing-with-mocks). You can also find complete working examples in [mocks/example_test.go](mocks/example_test.go).

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details on how to submit pull requests, report issues, and set up your development environment.

## Code of Conduct

This project follows the [Grafana Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## License

This project is licensed under the [Apache License 2.0](LICENSE.md) - see the LICENSE file for details.

## Project Status

This project is currently in active development. While it's open source, it's important to note that it was initially created as part of a hackathon. We're working to make it production-ready, but please use it with appropriate caution.

## Documentation

Comprehensive documentation is available at **[grafana.github.io/nanogit](https://grafana.github.io/nanogit)**:

- **[Getting Started](https://grafana.github.io/nanogit/getting-started/installation/)** - Installation and quick start guide
- **[Architecture](https://grafana.github.io/nanogit/architecture/overview/)** - Design principles, storage backend, performance
- **[API Reference (GoDoc)](https://pkg.go.dev/github.com/grafana/nanogit)** - Complete API documentation
- **[Changelog](https://grafana.github.io/nanogit/changelog/)** - Version history and release notes

## Resources

Want to learn how Git works? The following resources are useful:

- [Git on the Server - The Protocols](https://git-scm.com/book/ms/v2/Git-on-the-Server-The-Protocols)
- [Git Protocol v2](https://git-scm.com/docs/protocol-v2)
- [Pack Protocol](https://git-scm.com/docs/pack-protocol)
- [Git HTTP Backend](https://git-scm.com/docs/git-http-backend)
- [HTTP Protocol](https://git-scm.com/docs/http-protocol)
- [Git Protocol HTTP](https://git-scm.com/docs/gitprotocol-http)
- [Git Protocol v2](https://git-scm.com/docs/gitprotocol-v2)
- [Git Protocol Pack](https://git-scm.com/docs/gitprotocol-pack)
- [Git Protocol Common](https://git-scm.com/docs/gitprotocol-common)

## Security

If you find a security vulnerability, please report it to <security@grafana.com>. For more information, see our [Security Policy](SECURITY.md).

## Support

- GitHub Issues: [Create an issue](https://github.com/grafana/nanogit/issues)
- Community: [Grafana Community Forums](https://community.grafana.com)

## Acknowledgments

- The Grafana team for their support and guidance
- The open source community for their valuable feedback and contributions
