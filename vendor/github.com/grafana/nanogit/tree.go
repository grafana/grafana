package nanogit

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"
	"sync"

	"github.com/grafana/nanogit/log"
	"github.com/grafana/nanogit/protocol"
	"github.com/grafana/nanogit/protocol/client"
	"github.com/grafana/nanogit/protocol/hash"
	"github.com/grafana/nanogit/storage"
)

// Pools for flatten optimization
var (
	// Pool for strings.Builder to avoid allocations during path construction
	pathBuilderPool = sync.Pool{
		New: func() interface{} {
			b := &strings.Builder{}
			b.Grow(256) // Pre-allocate reasonable capacity for typical paths
			return b
		},
	}

	// Cache for hash.FromHex conversions to avoid repeated parsing
	hashCache = sync.Map{} // map[string]hash.Hash
)

// getPathBuilder gets a strings.Builder from the pool
func getPathBuilder() *strings.Builder {
	return pathBuilderPool.Get().(*strings.Builder)
}

// putPathBuilder returns a strings.Builder to the pool after resetting it
func putPathBuilder(b *strings.Builder) {
	b.Reset()
	pathBuilderPool.Put(b)
}

// getCachedHash gets a hash from cache or parses it and caches the result
func getCachedHash(hexStr string) (hash.Hash, error) {
	if cached, ok := hashCache.Load(hexStr); ok {
		return cached.(hash.Hash), nil
	}

	h, err := hash.FromHex(hexStr)
	if err != nil {
		return hash.Hash{}, err
	}

	// Cache the result for future use
	hashCache.Store(hexStr, h)
	return h, nil
}

// estimateFlatTreeSize estimates the total number of entries in a tree structure
func estimateFlatTreeSize(rootTree *protocol.PackfileObject, allTreeObjects storage.PackfileStorage) int {
	// More accurate estimation by sampling actual tree sizes
	totalEntries := 0
	treeCount := 0
	sampleSize := 0

	// Process up to 10 trees to get better average
	queue := []*protocol.PackfileObject{rootTree}
	visited := make(map[string]bool)

	for len(queue) > 0 && sampleSize < 10 {
		current := queue[0]
		queue = queue[1:]

		if visited[current.Hash.String()] {
			continue
		}
		visited[current.Hash.String()] = true
		sampleSize++

		totalEntries += len(current.Tree)

		// Add subdirectories to queue for sampling
		for _, entry := range current.Tree {
			if entry.FileMode&0o40000 != 0 { // Is directory
				treeCount++
				if sampleSize < 5 { // Only sample first few levels
					if entryHash, err := hash.FromHex(entry.Hash); err == nil {
						if childTree, exists := allTreeObjects.GetByType(entryHash, protocol.ObjectTypeTree); exists {
							queue = append(queue, childTree)
						}
					}
				}
			}
		}
	}

	if sampleSize == 0 {
		return 100 // Safe default
	}

	// Calculate average entries per tree from sample
	avgEntriesPerTree := float64(totalEntries) / float64(sampleSize)

	// Estimate total trees (exponential growth factor)
	estimatedTotalTrees := treeCount * 3 // More aggressive multiplier

	// Calculate final estimate
	estimate := int(avgEntriesPerTree * float64(estimatedTotalTrees))

	// Apply bounds with higher ceiling
	if estimate < 50 {
		return 50
	}
	if estimate > 50000 {
		return 50000
	}

	return estimate
}

// FlatTreeEntry represents a single entry in a flattened Git tree structure.
// Unlike TreeEntry, this includes the full path from the repository root,
// making it suitable for operations that need to work with complete file paths.
//
// A flattened tree contains all files and directories recursively, with each
// entry having its complete path from the repository root.
type FlatTreeEntry struct {
	// Name is the base filename (e.g., "file.txt")
	Name string
	// Path is the full path from repository root (e.g., "dir/subdir/file.txt")
	Path string
	// Mode is the file mode in octal (e.g., 0o100644 for regular files, 0o40000 for directories)
	Mode uint32
	// Hash is the SHA-1 hash of the object
	Hash hash.Hash
	// Type is the type of Git object (blob for files, tree for directories)
	Type protocol.ObjectType
}

// FlatTree represents a recursive, flattened view of a Git tree structure.
// This provides a complete list of all files and directories in the tree,
// with each entry containing its full path from the repository root.
//
// This is useful for operations that need to:
//   - List all files in a repository
//   - Search for specific files by path
//   - Compare entire directory structures
//   - Generate file listings for display
type FlatTree struct {
	// Entries contains all files and directories in the tree (recursive)
	Entries []FlatTreeEntry
	// Hash is the SHA-1 hash of the root tree object
	Hash hash.Hash
}

// TreeEntry represents a single entry in a Git tree object.
// This contains only direct children of the tree (non-recursive),
// similar to what you'd see with 'ls' in a directory.
type TreeEntry struct {
	// Name is the filename or directory name
	Name string
	// Mode is the file mode in octal (e.g., 0o100644 for files, 0o40000 for directories)
	Mode uint32
	// Hash is the SHA-1 hash of the object
	Hash hash.Hash
	// Type is the type of Git object (blob for files, tree for directories)
	Type protocol.ObjectType
}

// Tree represents a single Git tree object containing direct children only.
// This provides a non-recursive view of a directory, showing only the
// immediate files and subdirectories within it.
//
// This is useful for operations that need to:
//   - Browse directory contents one level at a time
//   - Implement tree navigation interfaces
//   - Work with specific directory levels
//   - Minimize memory usage when not all files are needed
type Tree struct {
	// Entries contains the direct children of this tree (non-recursive)
	Entries []TreeEntry
	// Hash is the SHA-1 hash of this tree object
	Hash hash.Hash
}

// GetFlatTree retrieves a complete, recursive view of all files and directories
// in a Git tree structure. This method flattens the entire tree hierarchy into
// a single list where each entry contains its full path from the repository root.
//
// The method can accept either a tree hash directly or a commit hash (in which
// case it will extract the tree from the commit).
//
// Parameters:
//   - ctx: Context for the operation
//   - h: Hash of the commit object
//
// Returns:
//   - *FlatTree: Complete recursive listing of all files and directories
//   - error: Error if the hash is invalid, object not found, or processing fails
//
// Example:
//
//	flatTree, err := client.GetFlatTree(ctx, commitHash)
//	for _, entry := range flatTree.Entries {
//	    fmt.Printf("%s (%s)\n", entry.Path, entry.Type)
//	}
func (c *httpClient) GetFlatTree(ctx context.Context, commitHash hash.Hash) (*FlatTree, error) {
	logger := log.FromContext(ctx)
	logger.Debug("Get flat tree",
		"commit_hash", commitHash.String())

	ctx, _ = storage.FromContextOrInMemory(ctx)

	allTreeObjects, rootTree, err := c.fetchAllTreeObjects(ctx, commitHash)
	if err != nil {
		return nil, fmt.Errorf("fetch tree objects for commit %s: %w", commitHash.String(), err)
	}

	flatTree, err := c.flatten(ctx, rootTree, allTreeObjects)
	if err != nil {
		return nil, fmt.Errorf("flatten tree %s: %w", rootTree.Hash.String(), err)
	}

	logger.Debug("Flat tree retrieved",
		"commit_hash", commitHash.String(),
		"tree_hash", rootTree.Hash.String(),
		"entry_count", len(flatTree.Entries))
	return flatTree, nil
}

// fetchAllTreeObjects collects all tree objects needed for the flat tree by starting with
// an initial request and iteratively fetching missing tree objects in batches.
func (c *httpClient) fetchAllTreeObjects(ctx context.Context, commitHash hash.Hash) (storage.PackfileStorage, *protocol.PackfileObject, error) {
	logger := log.FromContext(ctx)
	logger.Debug("Fetch tree objects", "commit_hash", commitHash.String())

	ctx, allObjects := storage.FromContextOrInMemory(ctx)

	metrics := &fetchMetrics{totalRequests: 1}

	initialObjects, commitObj, err := c.fetchInitialCommitObjects(ctx, commitHash, metrics)
	if err != nil {
		return nil, nil, err
	}

	c.logInitialFetchStats(logger, commitHash, initialObjects)

	rootTree, err := c.findRootTree(ctx, commitHash, allObjects)
	if err != nil {
		return nil, nil, fmt.Errorf("find root tree for commit %s: %w", commitHash.String(), err)
	}

	pending, processedTrees, requestedHashes := c.initializePendingTrees(commitObj, rootTree, initialObjects, allObjects)

	logger.Debug("Initial tree analysis completed",
		"pending_count", len(pending),
		"processed_count", len(processedTrees))

	err = c.processPendingTreeBatches(ctx, &pending, processedTrees, requestedHashes, allObjects, metrics)
	if err != nil {
		return nil, nil, err
	}

	logger.Debug("Tree collection completed",
		"commit_hash", commitHash.String(),
		"total_requests", metrics.totalRequests,
		"total_objects", metrics.totalObjectsFetched,
		"total_batches", metrics.batchNumber)

	return allObjects, rootTree, nil
}

// fetchMetrics tracks statistics during tree object fetching
type fetchMetrics struct {
	totalRequests       int
	totalObjectsFetched int
	batchNumber         int
}

// fetchInitialCommitObjects performs the initial fetch of commit objects
func (c *httpClient) fetchInitialCommitObjects(ctx context.Context, commitHash hash.Hash, metrics *fetchMetrics) (map[string]*protocol.PackfileObject, *protocol.PackfileObject, error) {
	initialObjects, err := c.Fetch(ctx, client.FetchOptions{
		NoProgress:   true,
		NoBlobFilter: true,
		Want:         []hash.Hash{commitHash},
		Shallow:      true,
		Deepen:       1,
		Done:         true,
	})
	if err != nil {
		if strings.Contains(err.Error(), "not our ref") {
			return nil, nil, NewObjectNotFoundError(commitHash)
		}
		return nil, nil, fmt.Errorf("fetch commit tree %s: %w", commitHash.String(), err)
	}

	commitObj, exists := initialObjects[commitHash.String()]
	if !exists {
		return nil, nil, NewObjectNotFoundError(commitHash)
	}

	if commitObj.Type != protocol.ObjectTypeCommit {
		return nil, nil, NewUnexpectedObjectTypeError(commitHash, protocol.ObjectTypeCommit, commitObj.Type)
	}

	metrics.totalObjectsFetched = len(initialObjects)
	return initialObjects, commitObj, nil
}

// logInitialFetchStats logs statistics about the initial fetch
func (c *httpClient) logInitialFetchStats(logger log.Logger, commitHash hash.Hash, initialObjects map[string]*protocol.PackfileObject) {
	var commitCount, treeCount, blobCount, otherCount int
	for _, obj := range initialObjects {
		switch obj.Type {
		case protocol.ObjectTypeCommit:
			commitCount++
		case protocol.ObjectTypeTree:
			treeCount++
		case protocol.ObjectTypeBlob:
			blobCount++
		default:
			otherCount++
		}
	}

	logger.Debug("Initial fetch completed",
		"commit_hash", commitHash.String(),
		"object_count", len(initialObjects),
		"commit_count", commitCount,
		"tree_count", treeCount,
		"blob_count", blobCount,
		"other_count", otherCount)
}

// initializePendingTrees sets up the initial state for pending tree processing
func (c *httpClient) initializePendingTrees(commitObj *protocol.PackfileObject, rootTree *protocol.PackfileObject, initialObjects map[string]*protocol.PackfileObject, allObjects storage.PackfileStorage) ([]hash.Hash, map[string]bool, map[string]bool) {
	pending := []hash.Hash{}
	if rootTree == nil {
		pending = append(pending, commitObj.Commit.Tree)
	}

	processedTrees := make(map[string]bool)
	requestedHashes := make(map[string]bool)

	newPending, err := c.collectMissingTreeHashes(context.Background(), initialObjects, allObjects, pending, processedTrees, requestedHashes)
	if err == nil {
		pending = newPending
	}

	return pending, processedTrees, requestedHashes
}

// processPendingTreeBatches handles the main batch processing loop
func (c *httpClient) processPendingTreeBatches(ctx context.Context, pending *[]hash.Hash, processedTrees, requestedHashes map[string]bool, allObjects storage.PackfileStorage, metrics *fetchMetrics) error {
	logger := log.FromContext(ctx)

	const (
		batchSize      = 10
		retryBatchSize = 10
		maxRetries     = 3
		maxBatches     = 1000
	)

	retries := []hash.Hash{}
	retryCount := make(map[string]int)

	for len(*pending) > 0 || len(retries) > 0 {
		metrics.batchNumber++

		if metrics.batchNumber > maxBatches {
			logger.Error("Maximum batch limit exceeded",
				"max_batches", maxBatches,
				"pending_count", len(*pending),
				"retry_count", len(retries),
				"processed_count", len(processedTrees),
				"total_objects", allObjects.Len())
			return fmt.Errorf("exceeded maximum batch limit (%d), possible infinite loop", maxBatches)
		}

		currentBatch, batchType := c.prepareBatch(pending, &retries, batchSize, retryBatchSize)

		logger.Debug("Process batch",
			"batch_number", metrics.batchNumber,
			"batch_type", batchType,
			"batch_size", len(currentBatch),
			"pending_count", len(*pending),
			"retry_count", len(retries))

		err := c.processSingleBatch(ctx, currentBatch, &retries, retryCount, requestedHashes, processedTrees, allObjects, pending, metrics, maxRetries)
		if err != nil {
			return err
		}
	}

	return nil
}

// prepareBatch prepares the next batch of hashes to process
func (c *httpClient) prepareBatch(pending *[]hash.Hash, retries *[]hash.Hash, batchSize, retryBatchSize int) ([]hash.Hash, string) {
	if len(*retries) > 0 {
		currentBatch := *retries
		if len(*retries) > retryBatchSize {
			currentBatch = (*retries)[:retryBatchSize]
			*retries = (*retries)[retryBatchSize:]
		} else {
			*retries = nil
		}
		return currentBatch, "retry"
	}

	currentBatch := *pending
	if len(*pending) > batchSize {
		currentBatch = (*pending)[:batchSize]
		*pending = (*pending)[batchSize:]
	} else {
		*pending = nil
	}
	return currentBatch, "normal"
}

// processSingleBatch processes a single batch of tree objects
func (c *httpClient) processSingleBatch(ctx context.Context, currentBatch []hash.Hash, retries *[]hash.Hash, retryCount map[string]int, requestedHashes, processedTrees map[string]bool, allObjects storage.PackfileStorage, pending *[]hash.Hash, metrics *fetchMetrics, maxRetries int) error {
	logger := log.FromContext(ctx)

	metrics.totalRequests++
	objects, err := c.Fetch(ctx, client.FetchOptions{
		NoProgress:     true,
		NoBlobFilter:   true,
		Want:           currentBatch,
		Done:           true,
		NoExtraObjects: false, // we want to fetch all objects in this batch
	})
	if err != nil {
		return fmt.Errorf("fetch tree batch: %w", err)
	}

	metrics.totalObjectsFetched += len(objects)

	requestedReceived := c.countRequestedReceived(currentBatch, objects)
	additionalReceived := len(objects) - requestedReceived

	logger.Debug("Batch completed",
		"batch_number", metrics.batchNumber,
		"requested_count", len(currentBatch),
		"received_count", len(objects),
		"requested_received", requestedReceived,
		"additional_received", additionalReceived)

	err = c.handleMissingObjects(currentBatch, objects, retries, retryCount, requestedHashes, maxRetries, metrics.totalRequests)
	if err != nil {
		return err
	}

	newPending, err := c.collectMissingTreeHashes(ctx, objects, allObjects, *pending, processedTrees, requestedHashes)
	if err != nil {
		return fmt.Errorf("collect missing trees from batch: %w", err)
	}
	*pending = newPending

	return nil
}

// countRequestedReceived counts how many of the requested objects were received
func (c *httpClient) countRequestedReceived(currentBatch []hash.Hash, objects map[string]*protocol.PackfileObject) int {
	var requestedReceived int
	for _, requestedHash := range currentBatch {
		if _, exists := objects[requestedHash.String()]; exists {
			requestedReceived++
		}
	}
	return requestedReceived
}

// handleMissingObjects handles objects that weren't returned in the batch
func (c *httpClient) handleMissingObjects(currentBatch []hash.Hash, objects map[string]*protocol.PackfileObject, retries *[]hash.Hash, retryCount map[string]int, requestedHashes map[string]bool, maxRetries, totalRequests int) error {
	logger := log.FromContext(context.Background())

	for _, requestedHash := range currentBatch {
		if _, exists := objects[requestedHash.String()]; exists {
			continue
		}

		hashStr := requestedHash.String()
		retryCount[hashStr]++

		if retryCount[hashStr] > maxRetries {
			logger.Error("Object not returned after max retries",
				"hash", hashStr,
				"max_retries", maxRetries,
				"total_requests", totalRequests)
			return fmt.Errorf("object %s not returned after %d attempts: %w", hashStr, maxRetries, ErrObjectNotFound)
		}

		if !requestedHashes[hashStr] {
			*retries = append(*retries, requestedHash)
			requestedHashes[hashStr] = true
		}
	}
	return nil
}

// collectMissingTreeHashes processes tree objects and collects missing child tree hashes.
// It iterates through the provided objects, optionally adds them to allObjects if addToCollection is true,
// and identifies any missing child tree objects that need to be fetched.
func (c *httpClient) collectMissingTreeHashes(ctx context.Context, objects map[string]*protocol.PackfileObject, allObjects storage.PackfileStorage, pending []hash.Hash, processedTrees map[string]bool, requestedHashes map[string]bool) ([]hash.Hash, error) {
	logger := log.FromContext(ctx)
	var treesProcessed int
	var newTreesFound int

	// Mark current pending hashes as requested
	for _, h := range pending {
		requestedHashes[h.String()] = true
	}

	for _, obj := range objects {
		if obj.Type != protocol.ObjectTypeTree {
			continue
		}

		// Skip if we've already processed this tree for dependencies
		if processedTrees[obj.Hash.String()] {
			continue
		}

		treesProcessed++
		processedTrees[obj.Hash.String()] = true

		for _, entry := range obj.Tree {
			// If it's a file, we can ignore it
			if entry.FileMode&0o40000 == 0 {
				continue
			}

			entryHash, err := hash.FromHex(entry.Hash)
			if err != nil {
				return nil, fmt.Errorf("parsing child hash %s: %w", entry.Hash, err)
			}

			// Skip if we already have this object
			if _, exists := allObjects.GetByType(entryHash, protocol.ObjectTypeTree); exists {
				continue
			}

			// Skip if we've already requested this hash
			if requestedHashes[entry.Hash] {
				continue
			}

			pending = append(pending, entryHash)
			requestedHashes[entry.Hash] = true
			newTreesFound++
		}
	}

	if newTreesFound > 0 {
		logger.Debug("discovered tree dependencies",
			"trees_processed", treesProcessed,
			"new_trees_found", newTreesFound,
			"total_pending", len(pending))
	}

	return pending, nil
}

// findRootTree locates the root tree object from the target hash and available objects.
// It handles both commit and tree target objects, extracting the tree hash and object as needed.
func (c *httpClient) findRootTree(ctx context.Context, commitHash hash.Hash, allObjects storage.PackfileStorage) (*protocol.PackfileObject, error) {
	logger := log.FromContext(ctx)
	obj, exists := allObjects.GetByType(commitHash, protocol.ObjectTypeCommit)
	if !exists {
		return nil, NewObjectNotFoundError(commitHash)
	}

	// Extract tree hash from commit
	treeHash, err := hash.FromHex(obj.Commit.Tree.String())
	if err != nil {
		return nil, fmt.Errorf("parsing tree hash: %w", err)
	}

	// Check if the tree object is already in our available objects
	treeObj, exists := allObjects.GetByType(treeHash, protocol.ObjectTypeTree)
	if !exists {
		return nil, NewObjectNotFoundError(treeHash)
	}

	logger.Debug("resolved commit to tree",
		"commit_hash", commitHash.String(),
		"tree_hash", treeHash.String(),
		"tree_available", treeObj != nil)

	return treeObj, nil
}

// flatten converts collected tree objects into a flat tree structure using depth-first traversal.
func (c *httpClient) flatten(ctx context.Context, rootTree *protocol.PackfileObject, allTreeObjects storage.PackfileStorage) (*FlatTree, error) {
	logger := log.FromContext(ctx)
	logger.Debug("Flatten tree", "treeHash", rootTree.Hash.String())

	// Pre-allocate entries slice with estimated capacity to reduce reallocations
	estimatedSize := estimateFlatTreeSize(rootTree, allTreeObjects)
	entries := make([]FlatTreeEntry, 0, estimatedSize)

	// Use depth-first traversal with sorted processing to naturally produce sorted entries
	var traverseTree func(tree *protocol.PackfileObject, basePath string) error
	traverseTree = func(tree *protocol.PackfileObject, basePath string) error {
		// Create a sorted slice of entries to ensure consistent ordering
		treeEntries := make([]*protocol.PackfileTreeEntry, len(tree.Tree))
		for i := range tree.Tree {
			treeEntries[i] = &tree.Tree[i]
		}

		// Sort entries by filename to ensure deterministic order
		sort.Slice(treeEntries, func(i, j int) bool {
			return treeEntries[i].FileName < treeEntries[j].FileName
		})

		// Process sorted entries in depth-first order
		for _, entry := range treeEntries {
			// Use cached hash parsing to avoid repeated allocations
			entryHash, err := getCachedHash(entry.Hash)
			if err != nil {
				logger.Debug("Failed to parse entry hash",
					"hash", entry.Hash,
					"error", err)
				return fmt.Errorf("parsing entry hash %s: %w", entry.Hash, err)
			}

			// Build the full path for this entry using pooled string builder
			var entryPath string
			if basePath != "" {
				pathBuilder := getPathBuilder()
				pathBuilder.WriteString(basePath)
				pathBuilder.WriteString("/")
				pathBuilder.WriteString(entry.FileName)
				entryPath = pathBuilder.String()
				putPathBuilder(pathBuilder)
			} else {
				entryPath = entry.FileName
			}

			// Determine the type based on the mode
			entryType := protocol.ObjectTypeBlob
			if entry.FileMode&0o40000 != 0 {
				entryType = protocol.ObjectTypeTree
			}

			// Add this entry to results (directories first, then files within)
			entries = append(entries, FlatTreeEntry{
				Name: entry.FileName,
				Path: entryPath,
				Mode: uint32(entry.FileMode),
				Hash: entryHash,
				Type: entryType,
			})

			// If this is a tree, recursively process it
			if entryType == protocol.ObjectTypeTree {
				childTree, exists := allTreeObjects.GetByType(entryHash, protocol.ObjectTypeTree)
				if !exists {
					logger.Debug("Child tree not found in collection, attempting individual fetch",
						"hash", entryHash.String(),
						"path", entryPath)

					// Fallback: try to fetch the missing tree object individually
					fetchedTree, err := c.fetchMissingTreeObject(ctx, entryHash)
					if err != nil {
						logger.Error("Failed to fetch missing tree object",
							"hash", entryHash.String(),
							"path", entryPath,
							"error", err)
						return fmt.Errorf("tree object %s not found in collection and individual fetch failed: %w", entryHash.String(), err)
					}

					// Add the fetched tree to the collection for future lookups
					allTreeObjects.Add(fetchedTree)
					childTree = fetchedTree

					logger.Debug("Successfully fetched missing tree object",
						"hash", entryHash.String(),
						"path", entryPath)
				}
				// Recursively traverse the child tree
				if err := traverseTree(childTree, entryPath); err != nil {
					return err
				}
			}
		}
		return nil
	}

	logger.Debug("Traverse tree depth-first for sorted processing", "estimatedEntries", estimatedSize)

	// Start depth-first traversal from root
	if err := traverseTree(rootTree, ""); err != nil {
		return nil, err
	}

	logger.Debug("Tree flattening completed",
		"treeHash", rootTree.Hash.String(),
		"totalEntries", len(entries))
	return &FlatTree{
		Entries: entries,
		Hash:    rootTree.Hash,
	}, nil
}

// fetchMissingTreeObject attempts to fetch a single missing tree object individually.
// This is a fallback mechanism used when a tree object is not found in the batch-fetched collection.
// It performs an individual fetch for the specific tree hash and validates the result.
func (c *httpClient) fetchMissingTreeObject(ctx context.Context, treeHash hash.Hash) (*protocol.PackfileObject, error) {
	logger := log.FromContext(ctx)
	logger.Debug("Fetching missing tree object individually", "hash", treeHash.String())

	objects, err := c.Fetch(ctx, client.FetchOptions{
		NoProgress:     true,
		NoBlobFilter:   true,
		Want:           []hash.Hash{treeHash},
		Done:           true,
		NoExtraObjects: true, // We only want this specific object
	})
	if err != nil {
		return nil, fmt.Errorf("fetch failed: %w", err)
	}

	// Check if we got any objects
	if len(objects) == 0 {
		return nil, fmt.Errorf("no objects returned from fetch")
	}

	// Find the requested tree object in the response
	obj, exists := objects[treeHash.String()]
	if !exists {
		return nil, fmt.Errorf("requested tree %s not in response", treeHash.String())
	}

	// Validate that it's actually a tree object
	if obj.Type != protocol.ObjectTypeTree {
		return nil, fmt.Errorf("expected tree object but got %s", obj.Type)
	}

	logger.Debug("Successfully fetched missing tree object",
		"hash", treeHash.String(),
		"entries", len(obj.Tree))

	return obj, nil
}

// GetTree retrieves a single Git tree object showing only direct children.
// This method provides a non-recursive view of a directory, similar to running
// 'ls' in a Unix directory - you see only the immediate contents, not subdirectories.
//
// The method can accept only a tree hash directly.
//
// Parameters:
//   - ctx: Context for the operation
//   - treeHash: Hash of a tree object
//
// Returns:
//   - *Tree: Tree object containing direct children only
//   - error: Error if the hash is invalid, object not found, or processing fails
//
// Example:
//
//	tree, err := client.GetTree(ctx, treeHash)
//	for _, entry := range tree.Entries {
//	    if entry.Type == protocol.ObjectTypeTree {
//	        fmt.Printf("📁 %s/\n", entry.Name)
//	    } else {
//	        fmt.Printf("📄 %s\n", entry.Name)
//	    }
//	}
func (c *httpClient) GetTree(ctx context.Context, treeHash hash.Hash) (*Tree, error) {
	logger := log.FromContext(ctx)
	logger.Debug("Get tree",
		"tree_hash", treeHash.String())

	tree, err := c.getTree(ctx, treeHash)
	if err != nil {
		return nil, fmt.Errorf("get tree object %s: %w", treeHash.String(), err)
	}

	result, err := packfileObjectToTree(tree)
	if err != nil {
		return nil, fmt.Errorf("convert tree object %s: %w", treeHash.String(), err)
	}

	logger.Debug("Tree retrieved",
		"tree_hash", treeHash.String(),
		"entry_count", len(result.Entries))
	return result, nil
}

func (c *httpClient) getTree(ctx context.Context, want hash.Hash) (*protocol.PackfileObject, error) {
	logger := log.FromContext(ctx)
	logger.Debug("Fetch tree object", "hash", want.String())

	objects, err := c.Fetch(ctx, client.FetchOptions{
		NoProgress:     true,
		NoBlobFilter:   true,
		Want:           []hash.Hash{want},
		Done:           true,
		NoExtraObjects: false, // GetFlatTree is called after this one. Let's read all of them
	})
	if err != nil {
		// TODO: handle this at the client level
		if strings.Contains(err.Error(), "not our ref") {
			return nil, NewObjectNotFoundError(want)
		}

		logger.Debug("Failed to fetch tree objects", "hash", want.String(), "error", err)
		return nil, fmt.Errorf("fetching tree objects: %w", err)
	}

	if len(objects) == 0 {
		logger.Debug("No objects returned", "hash", want.String())
		return nil, NewObjectNotFoundError(want)
	}

	// TODO: can we do in the fetch?
	for _, obj := range objects {
		if obj.Type != protocol.ObjectTypeTree {
			logger.Debug("Unexpected object type",
				"hash", want.String(),
				"expectedType", protocol.ObjectTypeTree,
				"actualType", obj.Type)
			return nil, NewUnexpectedObjectTypeError(want, protocol.ObjectTypeTree, obj.Type)
		}
	}

	// Due to Git protocol limitations, when fetching a tree object, we receive all tree objects
	// in the path. We must filter the response to extract only the requested tree.
	if obj, ok := objects[want.String()]; ok {
		logger.Debug("Tree object found", "hash", want.String())
		return obj, nil
	}

	logger.Debug("Tree object not found in response", "hash", want.String())
	return nil, NewObjectNotFoundError(want)
}

// packfileObjectToTree converts a packfile object to a tree object.
// It returns the direct children of the tree.
func packfileObjectToTree(obj *protocol.PackfileObject) (*Tree, error) {
	if obj.Type != protocol.ObjectTypeTree {
		return nil, NewUnexpectedObjectTypeError(obj.Hash, protocol.ObjectTypeTree, obj.Type)
	}

	// Convert PackfileTreeEntry to TreeEntry (direct children only)
	entries := make([]TreeEntry, len(obj.Tree))
	for i, entry := range obj.Tree {
		entryHash, err := hash.FromHex(entry.Hash)
		if err != nil {
			return nil, fmt.Errorf("parsing hash: %w", err)
		}

		// Determine the type based on the mode
		entryType := protocol.ObjectTypeBlob
		if entry.FileMode&0o40000 != 0 {
			entryType = protocol.ObjectTypeTree
		}

		entries[i] = TreeEntry{
			Name: entry.FileName,
			Mode: uint32(entry.FileMode),
			Hash: entryHash,
			Type: entryType,
		}
	}

	return &Tree{
		Entries: entries,
		Hash:    obj.Hash,
	}, nil
}

// GetTreeByPath retrieves a tree object at a specific path by navigating through
// the directory structure. This method efficiently traverses the tree hierarchy
// to find the directory at the specified path without fetching unnecessary data.
//
// The path should use forward slashes ("/") as separators, similar to Unix paths.
// Empty path or "." returns the root tree.
//
// Parameters:
//   - ctx: Context for the operation
//   - rootHash: Hash of the root tree to start navigation from
//   - path: Directory path to navigate to (e.g., "src/main" or "docs/api")
//
// Returns:
//   - *Tree: Tree object at the specified path
//   - error: Error if path doesn't exist, contains non-directories, or navigation fails
//
// Example:
//
//	// Get the tree for the "src/components" directory
//	tree, err := client.GetTreeByPath(ctx, rootHash, "src/components")
//	if err != nil {
//	    return fmt.Errorf("directory not found: %w", err)
//	}
//
//	// List all files in that directory
//	for _, entry := range tree.Entries {
//	    fmt.Printf("%s\n", entry.Name)
//	}
func (c *httpClient) GetTreeByPath(ctx context.Context, rootHash hash.Hash, path string) (*Tree, error) {
	// If the path is "." or empty, return the root tree
	if path == "" || path == "." {
		return c.GetTree(ctx, rootHash)
	}

	logger := log.FromContext(ctx)
	logger.Debug("Get tree by path",
		"root_hash", rootHash.String(),
		"path", path)

	ctx, _ = storage.FromContextOrInMemory(ctx)

	parts := strings.Split(path, "/")
	currentHash := rootHash

	for i, part := range parts {
		part = strings.TrimSpace(part)
		if part == "" {
			return nil, errors.New("path component is empty")
		}

		currentPath := strings.Join(parts[:i+1], "/")

		logger.Debug("Navigate directory",
			"depth", i+1,
			"dir_name", part,
			"current_path", currentPath)

		currentTree, err := c.GetTree(ctx, currentHash)
		if err != nil {
			return nil, fmt.Errorf("get tree at %q: %w", currentPath, err)
		}

		found := false
		for _, entry := range currentTree.Entries {
			if entry.Name == part {
				if entry.Type != protocol.ObjectTypeTree {
					return nil, fmt.Errorf("path component %q is not a directory: %w", currentPath, NewUnexpectedObjectTypeError(entry.Hash, protocol.ObjectTypeTree, entry.Type))
				}
				currentHash = entry.Hash
				found = true
				break
			}
		}

		if !found {
			return nil, NewPathNotFoundError(currentPath)
		}
	}

	finalTree, err := c.GetTree(ctx, currentHash)
	if err != nil {
		return nil, fmt.Errorf("get final tree at %q: %w", path, err)
	}

	logger.Debug("Tree found by path",
		"path", path,
		"tree_hash", currentHash.String(),
		"entry_count", len(finalTree.Entries))
	return finalTree, nil
}
