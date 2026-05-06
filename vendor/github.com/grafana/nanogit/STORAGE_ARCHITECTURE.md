# nanogit Storage Architecture

This document describes nanogit's flexible storage architecture, including configurable writing modes and pluggable object storage systems.

## Overview

nanogit features a sophisticated two-layer storage architecture designed for cloud-native environments:

1. **Writing Modes**: Control temporary storage during packfile creation
2. **Object Storage**: Handle long-term caching and retrieval of Git objects

This separation allows you to optimize each layer independently for your specific performance, memory, and deployment requirements.

## Writing Modes

The `StagedWriter` supports configurable writing modes for packfile operations, allowing you to optimize how objects are temporarily stored while building packfiles during write operations.

These writing modes control how Git objects are stored during the staging and packfile creation process, giving you fine-grained control over performance vs memory usage trade-offs.

### Available Writing Modes

#### `PackfileStorageAuto` (Default)
- **Behavior**: Automatically chooses between memory and disk storage based on object count
- **Memory Usage**: Uses memory for small operations (≤10 objects), switches to disk for larger operations
- **Use Case**: Balanced approach suitable for most applications

#### `PackfileStorageMemory`
- **Behavior**: Always stores objects in memory
- **Memory Usage**: Higher memory usage, especially for bulk operations
- **Use Case**: Performance-critical scenarios where memory usage is not a constraint

#### `PackfileStorageDisk`
- **Behavior**: Always stores objects in temporary files on disk
- **Memory Usage**: Minimal memory usage
- **Use Case**: Bulk operations or memory-constrained environments

## Usage Examples

### Default Auto Mode
```go
// Uses auto mode by default
writer, err := client.NewStagedWriter(ctx, ref)
```

### Explicit Memory Storage
```go
// Always use memory for best performance
writer, err := client.NewStagedWriter(ctx, ref, nanogit.WithMemoryStorage())
```

### Explicit Disk Storage
```go
// Always use disk to minimize memory usage
writer, err := client.NewStagedWriter(ctx, ref, nanogit.WithDiskStorage())
```

### Explicit Auto Mode
```go
// Explicitly enable auto mode (same as default)
writer, err := client.NewStagedWriter(ctx, ref, nanogit.WithAutoStorage())
```

## Performance Characteristics

| Writing Mode | Memory Usage | Performance | Best For |
|--------------|--------------|-------------|----------|
| Auto | Variable | Balanced | General use cases |
| Memory | High | Fastest | Small operations, performance-critical |
| Disk | Low | Slightly slower | Bulk operations, memory-constrained |

## Migration Notes

- Existing code continues to work without changes (backward compatible)
- The `...WriterOption` parameter is variadic, so zero options is valid
- Default behavior remains the same (auto mode with 10 object threshold)

## Object Storage and Caching

Object storage in nanogit handles long-term caching and retrieval of Git objects (commits, trees, blobs). This is separate from writing modes and operates through a context-based configuration system.

### Key Characteristics

- **Immutable objects**: Git objects never change once created, enabling efficient caching
- **Context-based**: Storage backend is configured per operation via Go context
- **Pluggable**: Implement custom backends for different storage systems
- **Shareable**: Cache objects across multiple repositories and operations

### Default In-Memory Storage

The default implementation uses an in-memory cache optimized for:

- Stateless operations requiring minimal resource footprint
- Temporary caching during Git operations
- High-performance object retrieval and diffing

### Custom Storage Implementations

The object storage system supports custom backends through the `PackfileStorage` interface:

```go
// Example: Redis-based object storage
ctx = storage.ToContext(ctx, myRedisStorage)
client, err := nanogit.NewHTTPClient(repo, options...)

// Example: Database-based object storage  
ctx = storage.ToContext(ctx, myDatabaseStorage)
writer, err := client.NewStagedWriter(ctx, ref)
```

**Benefits of custom storage:**
- Persist Git objects across service restarts
- Share object cache across multiple repositories
- Scale storage independently of Git operations
- Optimize for specific deployment patterns (e.g., microservices)
- Implement TTL-based cache eviction
- Add metrics and monitoring

### Two-Layer Architecture Benefits

The separation between writing modes and object storage provides several advantages:

1. **Independent optimization**: Use disk-based writing for memory efficiency while maintaining Redis-based object caching for fast reads
2. **Flexible deployment**: Configure each layer based on specific infrastructure constraints
3. **Clear separation of concerns**: Temporary vs persistent storage have different requirements
4. **Scalability**: Scale each layer independently based on workload patterns

### Example Configurations

```go
// Memory-optimized: Fast writing + persistent caching
writer, err := client.NewStagedWriter(
    storage.ToContext(ctx, redisStorage),
    ref,
    nanogit.WithMemoryStorage(),
)

// Memory-constrained: Disk writing + in-memory caching
writer, err := client.NewStagedWriter(ctx, ref, nanogit.WithDiskStorage())

// Balanced: Auto writing + custom persistent storage
writer, err := client.NewStagedWriter(
    storage.ToContext(ctx, myCustomStorage),
    ref,
    // Auto mode is default
)
```

## Implementation Details

- Writing mode is configured per `StagedWriter` instance
- The same writing mode is maintained across multiple push operations
- Temporary files are automatically cleaned up after successful pushes
- All writing modes support the streaming packfile implementation for reduced memory usage during transmission
- Writing modes are independent from object storage - you can mix and match configurations