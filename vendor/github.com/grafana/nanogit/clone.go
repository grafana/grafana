package nanogit

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"

	"github.com/grafana/nanogit/log"
	"github.com/grafana/nanogit/protocol"
	"github.com/grafana/nanogit/protocol/client"
	"github.com/grafana/nanogit/protocol/hash"
	"golang.org/x/sync/errgroup"
)

// CloneOptions provides configuration options for repository cloning operations.
// It supports flexible folder filtering to optimize clones of large repositories
// by only including or excluding specific paths, which is ideal for CI environments
// with no caching where only certain directories are needed.
type CloneOptions struct {
	// Path specifies the local filesystem path where files should be written.
	// This field is required for clone operations.
	Path string

	// Hash specifies the commit hash to clone from.
	// Use client.GetRef() to resolve branch/tag names to hashes first.
	Hash hash.Hash

	// IncludePaths specifies which paths to include in the clone.
	// Only files and directories matching these patterns will be included.
	// Supports glob patterns (e.g., "src/**", "*.go", "docs/api/*").
	// If empty, all paths are included (unless excluded by ExcludePaths).
	IncludePaths []string

	// ExcludePaths specifies which paths to exclude from the clone.
	// Files and directories matching these patterns will be excluded.
	// Supports glob patterns (e.g., "node_modules/**", "*.tmp", "test/**").
	// ExcludePaths takes precedence over IncludePaths.
	ExcludePaths []string

	// BatchSize specifies how many blobs to fetch in a single request.
	// A value of 0 or 1 will fetch blobs individually (backward compatible behavior).
	// Values > 1 enable batch fetching, which can significantly improve performance
	// for repositories with many files by reducing the number of network requests.
	// If a blob is not returned in a batch request, the client will automatically
	// fall back to fetching it individually.
	BatchSize int

	// Concurrency specifies how many blob fetches to perform in parallel.
	// A value of 0 or 1 will fetch sequentially (backward compatible behavior).
	// Values > 1 enable concurrent fetching, which can significantly improve performance
	// by utilizing network bandwidth more effectively.
	// Works with both batch fetching (fetches multiple batches concurrently) and
	// individual fetching (fetches multiple blobs concurrently).
	// Recommended value: 4-10 depending on network conditions and server capacity.
	Concurrency int
}

// CloneResult contains the results of a clone operation.
type CloneResult struct {
	// Path is the local filesystem path where files were written.
	Path string

	// Commit is the commit object that was cloned.
	Commit *Commit

	// FlatTree contains all files and directories in the cloned repository,
	// filtered according to the CloneOptions.
	FlatTree *FlatTree

	// TotalFiles is the total number of files in the cloned tree.
	TotalFiles int

	// FilteredFiles is the number of files after applying include/exclude filters.
	FilteredFiles int
}

// Clone clones a repository for the given reference with optional path filtering.
// This method is optimized for CI environments and large repositories where only
// specific directories are needed. It supports flexible include/exclude patterns
// to minimize the amount of data fetched and processed.
//
// The clone operation:
//  1. Resolves the specified ref to a commit hash
//  2. Fetches the commit and tree objects
//  3. Applies include/exclude filters to the tree structure
//  4. Returns the filtered tree with only the requested paths
//
// Parameters:
//   - ctx: Context for the operation
//   - opts: Clone options including ref, depth, and path filters
//
// Returns:
//   - *CloneResult: Contains the cloned commit and filtered tree
//   - error: Error if clone operation fails
//
// Example:
//
//	// Get the commit hash for main branch
//	ref, err := client.GetRef(ctx, "main")
//	if err != nil {
//	    return err
//	}
//
//	// Clone only the src/ and docs/ directories
//	result, err := client.Clone(ctx, nanogit.CloneOptions{
//	    Path: "/tmp/repo",
//	    Hash: ref.Hash,
//	    IncludePaths: []string{"src/**", "docs/**"},
//	})
//	if err != nil {
//	    return err
//	}
//	fmt.Printf("Cloned %d files from commit %s\n",
//	    result.FilteredFiles, result.Commit.Hash.String()[:8])
func (c *httpClient) Clone(ctx context.Context, opts CloneOptions) (*CloneResult, error) {
	logger := log.FromContext(ctx)
	// Validate that hash is provided
	if opts.Hash == hash.Zero {
		return nil, fmt.Errorf("commit hash is required - use client.GetRef() to resolve branch/tag names to hashes")
	}

	logger.Debug("Starting clone operation",
		"commit_hash", opts.Hash.String(),
		"include_paths", opts.IncludePaths,
		"exclude_paths", opts.ExcludePaths)

	// Get the commit object
	commit, err := c.GetCommit(ctx, opts.Hash)
	if err != nil {
		return nil, fmt.Errorf("get commit %s: %w", opts.Hash.String(), err)
	}

	// Get the full tree structure
	fullTree, err := c.GetFlatTree(ctx, commit.Hash)
	if err != nil {
		return nil, fmt.Errorf("get tree for commit %s: %w", commit.Hash.String(), err)
	}

	logger.Debug("Retrieved full tree",
		"commit_hash", commit.Hash.String(),
		"total_entries", len(fullTree.Entries))

	// Validate that path is provided
	if opts.Path == "" {
		return nil, fmt.Errorf("clone path is required")
	}

	// Apply path filters to the tree
	filteredTree, err := c.filterTree(fullTree, opts.IncludePaths, opts.ExcludePaths)
	if err != nil {
		return nil, fmt.Errorf("filter tree: %w", err)
	}

	// Write files to filesystem
	err = c.writeFilesToDisk(ctx, opts.Path, filteredTree, opts.BatchSize, opts.Concurrency)
	if err != nil {
		return nil, fmt.Errorf("write files to disk: %w", err)
	}

	result := &CloneResult{
		Path:          opts.Path,
		Commit:        commit,
		FlatTree:      filteredTree,
		TotalFiles:    len(fullTree.Entries),
		FilteredFiles: len(filteredTree.Entries),
	}

	logger.Debug("Clone completed",
		"commit_hash", commit.Hash.String(),
		"total_files", result.TotalFiles,
		"filtered_files", result.FilteredFiles,
		"output_path", opts.Path)

	return result, nil
}

// filterTree applies include and exclude path patterns to filter a FlatTree.
// It returns a new FlatTree containing only entries that match the criteria.
func (c *httpClient) filterTree(tree *FlatTree, includePaths, excludePaths []string) (*FlatTree, error) {
	if len(includePaths) == 0 && len(excludePaths) == 0 {
		// No filtering needed
		return tree, nil
	}

	filtered := &FlatTree{
		Entries: make([]FlatTreeEntry, 0, len(tree.Entries)),
	}

	for _, entry := range tree.Entries {
		included := c.shouldIncludePath(entry.Path, includePaths, excludePaths)
		if included {
			filtered.Entries = append(filtered.Entries, entry)
		}
	}

	return filtered, nil
}

// shouldIncludePath determines if a path should be included based on include/exclude patterns.
// ExcludePaths takes precedence over IncludePaths.
func (c *httpClient) shouldIncludePath(path string, includePaths, excludePaths []string) bool {
	// First check exclude patterns - they take precedence
	if matchesAnyPattern(path, excludePaths) {
		return false
	}

	// If no include patterns specified, include everything not excluded
	if len(includePaths) == 0 {
		return true
	}

	// Check include patterns
	return matchesAnyPattern(path, includePaths)
}

// matchesAnyPattern checks if a path matches any of the given patterns.
func matchesAnyPattern(path string, patterns []string) bool {
	for _, pattern := range patterns {
		if matchesSinglePattern(path, pattern) {
			return true
		}
	}
	return false
}

// matchesSinglePattern checks if a path matches a single pattern.
func matchesSinglePattern(path, pattern string) bool {
	// Check if pattern contains **/ anywhere - needs special handling
	if strings.Contains(pattern, "/**/") || strings.HasPrefix(pattern, "**/") || strings.HasSuffix(pattern, "/**") {
		return matchesPatternWithDoubleStar(path, pattern)
	}

	// Standard filepath.Match for simple patterns
	matched, err := filepath.Match(pattern, path)
	return err == nil && matched
}

// writeFilesToDisk writes all files from the filtered tree to the specified directory path.
// It creates the necessary directory structure and downloads blob content for each file.
// If batchSize > 1, it fetches multiple blobs in batches to improve performance.
// If concurrency > 1, it fetches blobs concurrently to improve performance.
func (c *httpClient) writeFilesToDisk(ctx context.Context, basePath string, tree *FlatTree, batchSize, concurrency int) error {
	logger := log.FromContext(ctx)
	logger.Debug("Writing files to disk",
		"base_path", basePath,
		"file_count", len(tree.Entries),
		"batch_size", batchSize,
		"concurrency", concurrency)

	// Create the base directory if it doesn't exist
	if err := os.MkdirAll(basePath, 0755); err != nil {
		return fmt.Errorf("create base directory %s: %w", basePath, err)
	}

	// Collect all blob entries
	var blobEntries []FlatTreeEntry
	for _, entry := range tree.Entries {
		if entry.Type == protocol.ObjectTypeBlob {
			blobEntries = append(blobEntries, entry)
		}
	}

	// Normalize concurrency (0 or 1 means sequential)
	if concurrency <= 1 {
		concurrency = 1
	}

	// Fetch and write blobs based on batch size
	if batchSize <= 1 {
		// Fetch individually (with optional concurrency)
		return c.writeFilesIndividually(ctx, basePath, blobEntries, concurrency, logger)
	}

	// Batch fetching enabled (with optional concurrency)
	return c.writeFilesInBatches(ctx, basePath, blobEntries, batchSize, concurrency, logger)
}

// writeFilesIndividually fetches and writes each blob individually
// with optional concurrency for improved performance
func (c *httpClient) writeFilesIndividually(ctx context.Context, basePath string, entries []FlatTreeEntry, concurrency int, logger log.Logger) error {
	if concurrency <= 1 {
		// Sequential fetching (backward compatible)
		for _, entry := range entries {
			if err := c.writeFile(ctx, basePath, entry, logger); err != nil {
				return err
			}
		}
		return nil
	}

	// Concurrent fetching using errgroup
	g, ctx := errgroup.WithContext(ctx)
	g.SetLimit(concurrency)

	// Use mutex to safely log from multiple goroutines
	var logMutex sync.Mutex

	for _, entry := range entries {
		entry := entry // capture loop variable
		g.Go(func() error {
			// Create parent directories first (with synchronization)
			filePath := filepath.Join(basePath, entry.Path)
			parentDir := filepath.Dir(filePath)
			if err := os.MkdirAll(parentDir, 0755); err != nil {
				return fmt.Errorf("create parent directory for %s: %w", entry.Path, err)
			}

			// Fetch blob
			blob, err := c.GetBlob(ctx, entry.Hash)
			if err != nil {
				return fmt.Errorf("get blob content for %s: %w", entry.Path, err)
			}

			// Write file
			if err := os.WriteFile(filePath, blob.Content, 0644); err != nil {
				return fmt.Errorf("write file %s: %w", entry.Path, err)
			}

			// Safe logging
			logMutex.Lock()
			logger.Debug("File written",
				"path", entry.Path,
				"size", len(blob.Content))
			logMutex.Unlock()

			return nil
		})
	}

	return g.Wait()
}

// writeFile fetches a single blob and writes it to disk
func (c *httpClient) writeFile(ctx context.Context, basePath string, entry FlatTreeEntry, logger log.Logger) error {
	filePath := filepath.Join(basePath, entry.Path)

	// Create parent directories if needed
	parentDir := filepath.Dir(filePath)
	if err := os.MkdirAll(parentDir, 0755); err != nil {
		return fmt.Errorf("create parent directory for %s: %w", entry.Path, err)
	}

	// Get the blob content
	blob, err := c.GetBlob(ctx, entry.Hash)
	if err != nil {
		return fmt.Errorf("get blob content for %s: %w", entry.Path, err)
	}

	// Write the file content
	if err := os.WriteFile(filePath, blob.Content, 0644); err != nil {
		return fmt.Errorf("write file %s: %w", entry.Path, err)
	}

	logger.Debug("File written",
		"path", entry.Path,
		"size", len(blob.Content))

	return nil
}

// writeFilesInBatches fetches and writes blobs in batches with fallback to individual fetching
// with optional concurrency for improved performance
func (c *httpClient) writeFilesInBatches(ctx context.Context, basePath string, entries []FlatTreeEntry, batchSize, concurrency int, logger log.Logger) error {
	totalFiles := len(entries)
	logger.Debug("Starting batch blob fetching",
		"total_files", totalFiles,
		"batch_size", batchSize,
		"concurrency", concurrency)

	// Split entries into batches
	var batches [][]FlatTreeEntry
	for i := 0; i < len(entries); i += batchSize {
		end := i + batchSize
		if end > len(entries) {
			end = len(entries)
		}
		batches = append(batches, entries[i:end])
	}

	if concurrency <= 1 {
		// Sequential batch processing (backward compatible)
		return c.processBlobBatchesSequentially(ctx, basePath, batches, logger)
	}

	// Concurrent batch processing
	return c.processBlobBatchesConcurrently(ctx, basePath, batches, concurrency, logger)
}

// processBlobBatchesSequentially processes blob batches one at a time (backward compatible)
func (c *httpClient) processBlobBatchesSequentially(ctx context.Context, basePath string, batches [][]FlatTreeEntry, logger log.Logger) error {
	for i, batch := range batches {
		logger.Debug("Processing batch",
			"batch_number", i+1,
			"batch_size", len(batch))

		if err := c.processSingleBlobBatch(ctx, basePath, batch, logger); err != nil {
			return err
		}
	}
	return nil
}

// processBlobBatchesConcurrently processes multiple blob batches concurrently
func (c *httpClient) processBlobBatchesConcurrently(ctx context.Context, basePath string, batches [][]FlatTreeEntry, concurrency int, logger log.Logger) error {
	g, ctx := errgroup.WithContext(ctx)
	g.SetLimit(concurrency)

	// Use mutex for safe logging
	var logMutex sync.Mutex

	for batchIdx, batch := range batches {
		batchIdx := batchIdx
		batch := batch
		g.Go(func() error {
			logMutex.Lock()
			logger.Debug("Processing batch concurrently",
				"batch_number", batchIdx+1,
				"batch_size", len(batch))
			logMutex.Unlock()

			return c.processSingleBlobBatch(ctx, basePath, batch, logger)
		})
	}

	return g.Wait()
}

// processSingleBlobBatch fetches and writes a single batch of blobs
func (c *httpClient) processSingleBlobBatch(ctx context.Context, basePath string, batch []FlatTreeEntry, logger log.Logger) error {
	// Attempt to fetch batch
	blobs, err := c.fetchBlobBatch(ctx, batch)
	if err != nil {
		return fmt.Errorf("fetch blob batch: %w", err)
	}

	// Write fetched blobs and track missing ones
	var missingEntries []FlatTreeEntry
	for _, entry := range batch {
		blob, found := blobs[entry.Hash.String()]
		if !found {
			// Blob not in batch response, will fetch individually later
			missingEntries = append(missingEntries, entry)
			logger.Debug("Blob missing from batch, will retry individually",
				"path", entry.Path,
				"hash", entry.Hash.String())
			continue
		}

		// Write the fetched blob to disk
		if err := c.writeBlobToFile(ctx, basePath, entry, blob.Data, logger); err != nil {
			return err
		}
	}

	// Fallback: fetch missing blobs individually
	if len(missingEntries) > 0 {
		logger.Debug("Fetching missing blobs individually",
			"count", len(missingEntries))
		for _, entry := range missingEntries {
			if err := c.writeFile(ctx, basePath, entry, logger); err != nil {
				return err
			}
		}
	}

	return nil
}

// fetchBlobBatch fetches multiple blobs in a single request
func (c *httpClient) fetchBlobBatch(ctx context.Context, entries []FlatTreeEntry) (map[string]*protocol.PackfileObject, error) {
	// Collect hashes to fetch
	hashes := make([]hash.Hash, len(entries))
	for i, entry := range entries {
		hashes[i] = entry.Hash
	}

	// Fetch all hashes in a single request using the protocol Fetch
	objects, err := c.Fetch(ctx, client.FetchOptions{
		NoProgress:     true,
		Want:           hashes,
		Done:           true,
		NoExtraObjects: true,
	})
	if err != nil {
		return nil, fmt.Errorf("fetch %d blobs: %w", len(hashes), err)
	}

	return objects, nil
}

// writeBlobToFile writes blob data to a file on disk
func (c *httpClient) writeBlobToFile(ctx context.Context, basePath string, entry FlatTreeEntry, data []byte, logger log.Logger) error {
	filePath := filepath.Join(basePath, entry.Path)

	// Create parent directories if needed
	parentDir := filepath.Dir(filePath)
	if err := os.MkdirAll(parentDir, 0755); err != nil {
		return fmt.Errorf("create parent directory for %s: %w", entry.Path, err)
	}

	// Write the file content
	if err := os.WriteFile(filePath, data, 0644); err != nil {
		return fmt.Errorf("write file %s: %w", entry.Path, err)
	}

	logger.Debug("File written",
		"path", entry.Path,
		"size", len(data))

	return nil
}

// matchesPatternWithDoubleStar checks if a pattern with **/ matches a path.
// Handles patterns like:
// - "**/*.go" - matches *.go at any depth
// - "src/**" - matches anything under src/
// - "src/**/*.go" - matches *.go at any depth under src/
// - "**/test/**" - matches test directory at any depth
// - "level1/**/level5/**" - complex multi-segment patterns
func matchesPatternWithDoubleStar(path, pattern string) bool {
	// Case 1: Pattern contains /**/ in the middle (e.g., "src/**/*.go", "services/**/src/**")
	// Check this FIRST before checking suffix/prefix, as "a/**/b/**" contains both /**/ and ends with /**
	if strings.Contains(pattern, "/**/") {
		return matchesMiddleDoubleStarPattern(path, pattern)
	}

	// Case 2: Special case "**/dirname/**" - matches dirname directory at any depth
	if strings.HasPrefix(pattern, "**/") && strings.HasSuffix(pattern, "/**") {
		dirname := strings.TrimSuffix(strings.TrimPrefix(pattern, "**/"), "/**")
		return matchesDirAtAnyDepth(path, dirname)
	}

	// Case 3: Pattern starts with **/ (e.g., "**/*.go")
	if strings.HasPrefix(pattern, "**/") {
		return matchesPrefixDoubleStarPattern(path, pattern)
	}

	// Case 4: Pattern ends with /** (e.g., "src/**")
	if strings.HasSuffix(pattern, "/**") {
		prefix := strings.TrimSuffix(pattern, "/**")
		return strings.HasPrefix(path, prefix+"/") || path == prefix
	}

	return false
}

// matchesMiddleDoubleStarPattern handles patterns with /**/ in the middle.
func matchesMiddleDoubleStarPattern(path, pattern string) bool {
	// Split pattern into prefix and suffix around the first /**/
	parts := strings.SplitN(pattern, "/**/", 2)
	if len(parts) != 2 {
		return false
	}
	prefix := parts[0]
	suffix := parts[1]

	// Path must start with prefix
	if !strings.HasPrefix(path, prefix+"/") && path != prefix {
		return false
	}

	// Remove prefix from path, handle path == prefix explicitly
	var remainder string
	if path == prefix {
		remainder = ""
	} else {
		remainder = strings.TrimPrefix(path, prefix+"/")
	}

	// If suffix is dir/** (e.g., "src/**"), we need to find dir at any depth in remainder
	if strings.HasSuffix(suffix, "/**") && !strings.Contains(strings.TrimSuffix(suffix, "/**"), "/") {
		dirname := strings.TrimSuffix(suffix, "/**")
		return matchesDirAtAnyDepth(remainder, dirname)
	}

	// If suffix contains more /**/, we need to match it at any possible starting point in remainder
	if strings.Contains(suffix, "/**/") || strings.HasSuffix(suffix, "/**") {
		return matchesSuffixAtAnyDepthRecursive(remainder, suffix, 0)
	}

	// Otherwise check if remainder matches suffix at any depth
	return matchesSuffixAtAnyDepth(remainder, suffix)
}

// matchesPrefixDoubleStarPattern handles patterns that start with **/.
func matchesPrefixDoubleStarPattern(path, pattern string) bool {
	suffix := strings.TrimPrefix(pattern, "**/")
	// If suffix also ends with /**, handle specially
	if strings.HasSuffix(suffix, "/**") {
		dirname := strings.TrimSuffix(suffix, "/**")
		return matchesDirAtAnyDepth(path, dirname)
	}
	return matchesSuffixAtAnyDepth(path, suffix)
}

// matchesSuffixAtAnyDepthRecursive tries to match suffix at any depth in the path recursively.
// The depth parameter prevents infinite recursion by limiting how deep we can recurse.
func matchesSuffixAtAnyDepthRecursive(path, suffix string, depth int) bool {
	// Prevent infinite recursion - limit to 50 levels (more than any reasonable directory depth)
	const maxDepth = 50
	if depth >= maxDepth {
		return false
	}

	// Try to match suffix starting from path
	if matchesPatternWithDoubleStar(path, suffix) {
		return true
	}

	// Also try matching suffix at any depth in path
	// Use strings.Split for better performance instead of byte-by-byte iteration
	segments := strings.Split(path, "/")
	for i := 1; i < len(segments); i++ {
		tail := strings.Join(segments[i:], "/")
		if matchesPatternWithDoubleStar(tail, suffix) {
			return true
		}
	}
	return false
}

// matchesDirAtAnyDepth checks if a directory name appears anywhere in the path.
func matchesDirAtAnyDepth(path, dirname string) bool {
	// Check if path is exactly the dirname
	if path == dirname {
		return true
	}
	// Check if path starts with dirname/
	if strings.HasPrefix(path, dirname+"/") {
		return true
	}
	// Check if path contains /dirname/
	if strings.Contains(path, "/"+dirname+"/") {
		return true
	}
	// Check if path ends with /dirname
	if strings.HasSuffix(path, "/"+dirname) {
		return true
	}
	return false
}

// matchesSuffixAtAnyDepth checks if a suffix pattern matches a path at any depth.
// The pattern parameter should be the suffix after a '**/' prefix has been stripped (e.g., '*.log' from '**/*.log').
// For pattern '*.log' (from '**/*.log') and path 'src/logs/debug.log', it checks:
// - 'src/logs/debug.log' against '*.log' (no match)
// - 'logs/debug.log' against '*.log' (no match)
// - 'debug.log' against '*.log' (match!)
func matchesSuffixAtAnyDepth(path, pattern string) bool {
	// First try matching the full path
	if matched, err := filepath.Match(pattern, path); err == nil && matched {
		return true
	}

	// Then try matching each tail of the path (split by /)
	// Use strings.Split for better performance instead of byte-by-byte iteration
	segments := strings.Split(path, "/")
	for i := 1; i < len(segments); i++ {
		tail := strings.Join(segments[i:], "/")
		if matched, err := filepath.Match(pattern, tail); err == nil && matched {
			return true
		}
	}

	return false
}
