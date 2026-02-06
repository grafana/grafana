package nanogit

import (
	"context"
	"crypto"
	"errors"
	"fmt"
	"io"
	"sort"
	"strings"

	"github.com/grafana/nanogit/log"
	"github.com/grafana/nanogit/protocol"
	"github.com/grafana/nanogit/protocol/hash"
	"github.com/grafana/nanogit/storage"
)

// ErrWriterCleanedUp is returned when trying to use a writer after cleanup has been called.
var ErrWriterCleanedUp = errors.New("writer has been cleaned up and can no longer be used")

// NewStagedWriter creates a new StagedWriter for staging changes to a Git reference.
// It initializes the writer with the current state of the specified reference,
// allowing you to stage multiple changes (create/update/delete blobs and trees)
// before committing and pushing them as a single atomic operation.
//
// The writer maintains an in-memory representation of the repository state and
// tracks all changes until they are committed and pushed.
//
// Example usage:
//
//	writer, err := client.NewStagedWriter(ctx, ref)
//	if err != nil {
//	    return err
//	}
//
//	// Stage multiple changes
//	writer.CreateBlob(ctx, "new.txt", []byte("content"))
//	writer.UpdateBlob(ctx, "existing.txt", []byte("updated"))
//	writer.DeleteBlob(ctx, "old.txt")
//
//	// Commit all changes at once
//	commit, err := writer.Commit(ctx, "Update files", author, committer)
//	if err != nil {
//	    return err
//	}
//
//	// Push to remote
//	return writer.Push(ctx)
func (c *httpClient) NewStagedWriter(ctx context.Context, ref Ref, options ...WriterOption) (StagedWriter, error) {
	// Apply writer options
	opts, err := applyWriterOptions(options)
	if err != nil {
		return nil, fmt.Errorf("apply writer options: %w", err)
	}

	logger := log.FromContext(ctx)
	logger.Debug("Initialize staged writer",
		"ref_name", ref.Name,
		"ref_hash", ref.Hash.String(),
		"storage_mode", opts.StorageMode)

	ctx, objStorage := storage.FromContextOrInMemory(ctx)

	// Get essential objects - fetch commit, root tree, and flat tree
	commit, err := c.getCommit(ctx, ref.Hash, false)
	if err != nil {
		return nil, fmt.Errorf("get commit %s: %w", ref.Hash.String(), err)
	}

	treeObj, err := c.getTree(ctx, commit.Tree)
	if err != nil {
		return nil, fmt.Errorf("get tree %s: %w", commit.Tree.String(), err)
	}

	// Get the flat tree representation for efficient path-based operations
	currentTree, err := c.GetFlatTree(ctx, commit.Hash)
	if err != nil {
		return nil, fmt.Errorf("get flat tree for commit %s: %w", commit.Hash.String(), err)
	}

	// Build tree entries map from flat tree
	entries := make(map[string]*FlatTreeEntry, len(currentTree.Entries))
	for _, entry := range currentTree.Entries {
		entries[entry.Path] = &entry
	}

	logger.Debug("Staged writer ready",
		"ref_name", ref.Name,
		"commit_hash", commit.Hash.String(),
		"tree_hash", treeObj.Hash.String(),
		"tree_entries", len(entries))

	// Convert writer storage mode to protocol storage mode
	var protocolStorageMode protocol.PackfileStorageMode
	switch opts.StorageMode {
	case PackfileStorageMemory:
		protocolStorageMode = protocol.PackfileStorageMemory
	case PackfileStorageDisk:
		protocolStorageMode = protocol.PackfileStorageDisk
	case PackfileStorageAuto:
		protocolStorageMode = protocol.PackfileStorageAuto
	default:
		protocolStorageMode = protocol.PackfileStorageAuto
	}

	writer := protocol.NewPackfileWriter(crypto.SHA1, protocolStorageMode)
	return &stagedWriter{
		client:      c,
		ref:         ref,
		writer:      writer,
		lastCommit:  commit,
		lastTree:    treeObj,
		objStorage:  objStorage,
		treeEntries: entries,
		storageMode: protocolStorageMode,
		dirtyPaths:  make(map[string]bool), // Initialize dirty paths tracking for deferred tree building
	}, nil
}

// stagedWriter implements the StagedWriter interface.
// It maintains the state of staged changes for a Git reference, including:
//   - A packfile writer for creating new Git objects
//   - Cache of tree objects to avoid redundant fetches
//   - Mapping of file paths to their tree entries
//   - Reference to the last commit and tree state
//
// The writer operates by maintaining an in-memory representation of the
// repository state and building up a packfile of new objects as changes
// are staged. When committed, all changes are applied atomically.
type stagedWriter struct {
	// Embedded HTTP client for Git operations
	client *httpClient
	// Git reference being modified
	ref Ref
	// Packfile writer for creating objects
	writer *protocol.PackfileWriter
	// Last commit on the reference
	lastCommit *Commit
	// Root tree object from last commit
	lastTree *protocol.PackfileObject
	// Cache of fetched tree objects
	objStorage storage.PackfileStorage
	// Flat mapping of paths to tree entries
	treeEntries map[string]*FlatTreeEntry
	// Storage mode for packfile writer
	storageMode protocol.PackfileStorageMode
	// Track if cleanup has been called
	isCleanedUp bool
	// Deferred tree building optimization: track which directory paths need tree rebuilding
	dirtyPaths map[string]bool
}

// checkCleanupState returns an error if the writer has been cleaned up.
func (w *stagedWriter) checkCleanupState() error {
	if w.isCleanedUp {
		return ErrWriterCleanedUp
	}
	return nil
}

// BlobExists checks if a blob exists at the given path in the repository.
// This method verifies the existence of a file by checking the tree entries
// that have been loaded into memory.
//
// Parameters:
//   - ctx: Context for the operation
//   - path: File path to check (e.g., "docs/readme.md")
//
// Returns:
//   - bool: True if the blob exists at the specified path
//   - error: Error if the check fails
//
// Example:
//
//	exists, err := writer.BlobExists(ctx, "src/main.go")
func (w *stagedWriter) BlobExists(ctx context.Context, path string) (bool, error) {
	if err := w.checkCleanupState(); err != nil {
		return false, err
	}

	if path == "" {
		return false, ErrEmptyPath
	}

	logger := log.FromContext(ctx)
	logger.Debug("Check blob existence", "path", path)

	entry, exists := w.treeEntries[path]
	if !exists {
		return false, nil
	}

	return entry.Type == protocol.ObjectTypeBlob, nil
}

// CreateBlob creates a new blob object at the specified path with the given content.
// The path can include directory separators ("/") to create nested directory structures.
// If intermediate directories don't exist, they will be created automatically.
//
// This operation stages the blob creation but does not immediately commit it.
// You must call Commit() and Push() to persist the changes.
//
// Parameters:
//   - ctx: Context for the operation
//   - path: File path where the blob should be created (e.g., "docs/readme.md")
//   - content: Raw content of the file as bytes
//
// Returns:
//   - hash.Hash: The SHA-1 hash of the created blob object
//   - error: Error if the path already exists or if blob creation fails
//
// Example:
//
//	hash, err := writer.CreateBlob(ctx, "src/main.go", []byte("package main\n"))
func (w *stagedWriter) CreateBlob(ctx context.Context, path string, content []byte) (hash.Hash, error) {
	if err := w.checkCleanupState(); err != nil {
		return hash.Zero, err
	}

	if path == "" {
		return hash.Zero, ErrEmptyPath
	}

	logger := log.FromContext(ctx)
	logger.Debug("Create blob",
		"path", path,
		"content_size", len(content))

	if obj, ok := w.treeEntries[path]; ok {
		return hash.Zero, NewObjectAlreadyExistsError(obj.Hash)
	}

	blobHash, err := w.writer.AddBlob(content)
	if err != nil {
		return hash.Zero, fmt.Errorf("create blob at %q: %w", path, err)
	}

	w.treeEntries[path] = &FlatTreeEntry{
		Path: path,
		Hash: blobHash,
		Type: protocol.ObjectTypeBlob,
		Mode: 0o100644,
	}

	if err := w.addMissingOrStaleTreeEntries(ctx, path, blobHash); err != nil {
		return hash.Zero, fmt.Errorf("update tree structure for %q: %w", path, err)
	}

	logger.Debug("Blob created",
		"path", path,
		"blob_hash", blobHash.String())

	return blobHash, nil
}

// UpdateBlob updates the content of an existing blob at the specified path.
// The blob must already exist at the given path, otherwise an error is returned.
//
// This operation stages the blob update but does not immediately commit it.
// You must call Commit() and Push() to persist the changes.
//
// Parameters:
//   - ctx: Context for the operation
//   - path: File path of the existing blob to update
//   - content: New content for the file as bytes
//
// Returns:
//   - hash.Hash: The SHA-1 hash of the updated blob object
//   - error: Error if the path doesn't exist or if blob update fails
//
// Example:
//
//	hash, err := writer.UpdateBlob(ctx, "README.md", []byte("Updated content"))
func (w *stagedWriter) UpdateBlob(ctx context.Context, path string, content []byte) (hash.Hash, error) {
	if err := w.checkCleanupState(); err != nil {
		return hash.Zero, err
	}

	if path == "" {
		return hash.Zero, ErrEmptyPath
	}

	logger := log.FromContext(ctx)
	logger.Debug("Update blob",
		"path", path,
		"content_size", len(content))

	if w.treeEntries[path] == nil {
		return hash.Zero, NewPathNotFoundError(path)
	}

	blobHash, err := w.writer.AddBlob(content)
	if err != nil {
		return hash.Zero, fmt.Errorf("create blob at %q: %w", path, err)
	}

	w.treeEntries[path] = &FlatTreeEntry{
		Path: path,
		Hash: blobHash,
		Type: protocol.ObjectTypeBlob,
		Mode: 0o100644,
	}

	if err := w.addMissingOrStaleTreeEntries(ctx, path, blobHash); err != nil {
		return hash.Zero, fmt.Errorf("update tree structure for %q: %w", path, err)
	}

	logger.Debug("Blob updated",
		"path", path,
		"blob_hash", blobHash.String())

	return blobHash, nil
}

// DeleteBlob removes a blob (file) at the specified path from the repository.
// The blob must exist and must be a file (not a directory), otherwise an error is returned.
// If removing the blob leaves empty parent directories, those directories will also be removed.
//
// This operation stages the blob deletion but does not immediately commit it.
// You must call Commit() and Push() to persist the changes.
//
// Parameters:
//   - ctx: Context for the operation
//   - path: File path of the blob to delete
//
// Returns:
//   - hash.Hash: The SHA-1 hash of the deleted blob object
//   - error: Error if the path doesn't exist, is not a blob, or deletion fails
//
// Example:
//
//	hash, err := writer.DeleteBlob(ctx, "old-file.txt")
func (w *stagedWriter) DeleteBlob(ctx context.Context, path string) (hash.Hash, error) {
	if err := w.checkCleanupState(); err != nil {
		return hash.Zero, err
	}

	if path == "" {
		return hash.Zero, ErrEmptyPath
	}

	logger := log.FromContext(ctx)
	logger.Debug("Delete blob",
		"path", path)

	existing, ok := w.treeEntries[path]
	if !ok {
		return hash.Zero, NewPathNotFoundError(path)
	}

	if existing.Type != protocol.ObjectTypeBlob {
		return hash.Zero, NewUnexpectedObjectTypeError(existing.Hash, protocol.ObjectTypeBlob, existing.Type)
	}

	blobHash := existing.Hash
	delete(w.treeEntries, path)

	if err := w.removeBlobFromTree(ctx, path); err != nil {
		return hash.Zero, fmt.Errorf("remove blob from tree at %q: %w", path, err)
	}

	logger.Debug("Blob deleted",
		"path", path,
		"blob_hash", blobHash.String())

	return blobHash, nil
}

// MoveBlob moves a file from srcPath to destPath by copying the content and deleting the original.
// This operation stages both the creation at the destination and deletion at the source.
// If intermediate directories don't exist at the destination, they will be created automatically.
//
// This operation stages the move but does not immediately commit it.
// You must call Commit() and Push() to persist the changes.
//
// Parameters:
//   - ctx: Context for the operation
//   - srcPath: Source file path to move from
//   - destPath: Destination file path to move to
//
// Returns:
//   - hash.Hash: The SHA-1 hash of the moved blob object
//   - error: Error if the source path doesn't exist, destination already exists, or move fails
//
// Example:
//
//	hash, err := writer.MoveBlob(ctx, "old/path/file.txt", "new/path/file.txt")
func (w *stagedWriter) MoveBlob(ctx context.Context, srcPath, destPath string) (hash.Hash, error) {
	if err := w.checkCleanupState(); err != nil {
		return hash.Zero, err
	}

	if srcPath == "" {
		return hash.Zero, ErrEmptyPath
	}

	if destPath == "" {
		return hash.Zero, ErrEmptyPath
	}

	if srcPath == destPath {
		return hash.Zero, fmt.Errorf("source and destination paths are the same: %q", srcPath)
	}

	logger := log.FromContext(ctx)
	logger.Debug("Move blob",
		"src_path", srcPath,
		"dest_path", destPath)

	// Check that source exists and is a blob
	srcEntry, ok := w.treeEntries[srcPath]
	if !ok {
		return hash.Zero, NewPathNotFoundError(srcPath)
	}

	if srcEntry.Type != protocol.ObjectTypeBlob {
		return hash.Zero, NewUnexpectedObjectTypeError(srcEntry.Hash, protocol.ObjectTypeBlob, srcEntry.Type)
	}

	// Check that destination doesn't already exist
	if destEntry, exists := w.treeEntries[destPath]; exists {
		return hash.Zero, NewObjectAlreadyExistsError(destEntry.Hash)
	}

	// Get the blob content - since it's already staged, we need to get it from the writer
	// The blob hash is the same, so we just need to copy the tree entry and update paths
	blobHash := srcEntry.Hash

	// Create the blob at the destination path
	w.treeEntries[destPath] = &FlatTreeEntry{
		Path: destPath,
		Hash: blobHash,
		Type: protocol.ObjectTypeBlob,
		Mode: srcEntry.Mode,
	}

	// Update tree structure for destination
	if err := w.addMissingOrStaleTreeEntries(ctx, destPath, blobHash); err != nil {
		return hash.Zero, fmt.Errorf("update tree structure for destination %q: %w", destPath, err)
	}

	// Remove the blob from the source path
	delete(w.treeEntries, srcPath)

	// Update tree structure for source removal
	if err := w.removeBlobFromTree(ctx, srcPath); err != nil {
		return hash.Zero, fmt.Errorf("remove blob from tree at source %q: %w", srcPath, err)
	}

	logger.Debug("Blob moved",
		"src_path", srcPath,
		"dest_path", destPath,
		"blob_hash", blobHash.String())

	return blobHash, nil
}

// GetTree retrieves the tree object at the specified path from the repository.
// The tree represents a directory structure containing files and subdirectories.
// The path must exist and must be a directory (tree), otherwise an error is returned.
//
// This operation retrieves the tree from memory if it has been staged,
// or from the repository if it hasn't been modified.
//
// Parameters:
//   - ctx: Context for the operation
//   - path: Directory path to retrieve
//
// Returns:
//   - *Tree: The tree object containing directory entries
//   - error: Error if the path doesn't exist, is not a tree, or retrieval fails
//
// Example:
//
//	tree, err := writer.GetTree(ctx, "src")
//	if err != nil {
//	    return fmt.Errorf("failed to get tree: %w", err)
//	}
//	for _, entry := range tree.Entries {
//	    fmt.Printf("Found %s: %s\n", entry.Type, entry.Name)
//	}
func (w *stagedWriter) GetTree(ctx context.Context, path string) (*Tree, error) {
	if err := w.checkCleanupState(); err != nil {
		return nil, err
	}

	existing, ok := w.treeEntries[path]
	if !ok {
		return nil, NewPathNotFoundError(path)
	}

	if existing.Type != protocol.ObjectTypeTree {
		return nil, NewUnexpectedObjectTypeError(existing.Hash, protocol.ObjectTypeTree, existing.Type)
	}

	// Get all entries that are direct children of this path
	pathPrefix := path + "/"
	var entries []TreeEntry

	for entryPath, entry := range w.treeEntries {
		if entryPath == path {
			continue // Skip the tree itself
		}

		// Check if this is a direct child (no intermediate slashes)
		if strings.HasPrefix(entryPath, pathPrefix) {
			remainingPath := entryPath[len(pathPrefix):]
			if !strings.Contains(remainingPath, "/") {
				entries = append(entries, TreeEntry{
					Name: remainingPath,
					Type: entry.Type,
					Hash: entry.Hash,
					Mode: entry.Mode,
				})
			}
		}
	}

	return &Tree{
		Hash:    existing.Hash,
		Entries: entries,
	}, nil
}

// DeleteTree removes an entire directory tree at the specified path from the repository.
// This operation recursively deletes all files and subdirectories within the specified path.
// The path must exist and must be a directory (tree), otherwise an error is returned.
//
// This is equivalent to `rm -rf <path>` in Unix systems.
//
// This operation stages the tree deletion but does not immediately commit it.
// You must call Commit() and Push() to persist the changes.
//
// Parameters:
//   - ctx: Context for the operation
//   - path: Directory path to delete recursively
//
// Returns:
//   - hash.Hash: The SHA-1 hash of the deleted tree object
//   - error: Error if the path doesn't exist, is not a tree, or deletion fails
//
// Example:
//
//	hash, err := writer.DeleteTree(ctx, "old-directory")
func (w *stagedWriter) DeleteTree(ctx context.Context, path string) (hash.Hash, error) {
	if err := w.checkCleanupState(); err != nil {
		return hash.Zero, err
	}

	logger := log.FromContext(ctx)
	if path == "" || path == "." {
		emptyHash, err := protocol.Object(crypto.SHA1, protocol.ObjectTypeTree, []byte{})
		if err != nil {
			return hash.Zero, fmt.Errorf("create empty tree: %w", err)
		}

		emptyTree := protocol.PackfileObject{
			Hash: emptyHash,
			Type: protocol.ObjectTypeTree,
			Tree: []protocol.PackfileTreeEntry{},
		}

		w.writer.AddObject(emptyTree)
		w.objStorage.Add(&emptyTree)
		w.treeEntries[""] = &FlatTreeEntry{
			Path: "",
			Hash: emptyHash,
			Type: protocol.ObjectTypeTree,
			Mode: 0o40000,
		}
		w.lastTree = &emptyTree

		return emptyHash, nil
	}

	existing, ok := w.treeEntries[path]
	if !ok {
		return hash.Zero, NewPathNotFoundError(path)
	}

	if existing.Type != protocol.ObjectTypeTree {
		return hash.Zero, NewUnexpectedObjectTypeError(existing.Hash, protocol.ObjectTypeTree, existing.Type)
	}
	treeHash := existing.Hash

	logger.Debug("deleting tree", "path", path)

	// Find and remove all entries that start with this path
	pathPrefix := path + "/"
	var entriesToDelete []string

	for entryPath := range w.treeEntries {
		if entryPath == path || strings.HasPrefix(entryPath, pathPrefix) {
			entriesToDelete = append(entriesToDelete, entryPath)
		}
	}

	// Remove all entries under this tree
	for _, entryPath := range entriesToDelete {
		logger.Debug("removing entry", "path", entryPath)
		delete(w.treeEntries, entryPath)
	}

	// Update the tree structure to remove the directory entry
	if err := w.removeTreeFromTree(ctx, path); err != nil {
		return hash.Zero, fmt.Errorf("remove tree from entire tree: %w", err)
	}

	return treeHash, nil
}

// MoveTree moves an entire directory tree from srcPath to destPath.
// This operation recursively moves all files and subdirectories within the specified path.
// If intermediate directories don't exist at the destination, they will be created automatically.
//
// This operation stages the move but does not immediately commit it.
// You must call Commit() and Push() to persist the changes.
//
// Parameters:
//   - ctx: Context for the operation
//   - srcPath: Source directory path to move from
//   - destPath: Destination directory path to move to
//
// Returns:
//   - hash.Hash: The SHA-1 hash of the moved tree object
//   - error: Error if the source path doesn't exist, destination already exists, or move fails
//
// Example:
//
//	hash, err := writer.MoveTree(ctx, "old/directory", "new/location")
func (w *stagedWriter) MoveTree(ctx context.Context, srcPath, destPath string) (hash.Hash, error) {
	if err := w.checkCleanupState(); err != nil {
		return hash.Zero, err
	}

	if err := w.validateMoveTreePaths(srcPath, destPath); err != nil {
		return hash.Zero, err
	}

	logger := log.FromContext(ctx)
	logger.Debug("Move tree", "src_path", srcPath, "dest_path", destPath)

	_, treeHash, err := w.validateMoveTreeSource(srcPath)
	if err != nil {
		return hash.Zero, err
	}

	if err := w.validateMoveTreeDestination(destPath); err != nil {
		return hash.Zero, err
	}

	entriesToMove := w.findTreeEntriesToMove(srcPath)
	logger.Debug("Found entries to move", "count", len(entriesToMove))

	if err := w.moveTreeEntries(ctx, srcPath, destPath, entriesToMove); err != nil {
		return hash.Zero, err
	}

	if err := w.updateTreeStructuresForMove(ctx, srcPath, destPath, treeHash); err != nil {
		return hash.Zero, err
	}

	logger.Debug("Tree moved",
		"src_path", srcPath,
		"dest_path", destPath,
		"tree_hash", treeHash.String(),
		"entries_moved", len(entriesToMove))

	return treeHash, nil
}

// validateMoveTreePaths validates the source and destination paths for MoveTree
func (w *stagedWriter) validateMoveTreePaths(srcPath, destPath string) error {
	if srcPath == "" {
		return ErrEmptyPath
	}
	if destPath == "" {
		return ErrEmptyPath
	}
	if srcPath == destPath {
		return fmt.Errorf("source and destination paths are the same: %q", srcPath)
	}
	return nil
}

// validateMoveTreeSource validates the source path exists and is a tree
func (w *stagedWriter) validateMoveTreeSource(srcPath string) (*FlatTreeEntry, hash.Hash, error) {
	srcEntry, ok := w.treeEntries[srcPath]
	if !ok {
		return nil, hash.Zero, NewPathNotFoundError(srcPath)
	}
	if srcEntry.Type != protocol.ObjectTypeTree {
		return nil, hash.Zero, NewUnexpectedObjectTypeError(srcEntry.Hash, protocol.ObjectTypeTree, srcEntry.Type)
	}
	return srcEntry, srcEntry.Hash, nil
}

// validateMoveTreeDestination validates the destination path doesn't already exist
func (w *stagedWriter) validateMoveTreeDestination(destPath string) error {
	if destEntry, exists := w.treeEntries[destPath]; exists {
		return NewObjectAlreadyExistsError(destEntry.Hash)
	}
	return nil
}

// findTreeEntriesToMove finds all entries that belong to the source tree
func (w *stagedWriter) findTreeEntriesToMove(srcPath string) []string {
	srcPathPrefix := srcPath + "/"
	var entriesToMove []string

	for entryPath := range w.treeEntries {
		if entryPath == srcPath || strings.HasPrefix(entryPath, srcPathPrefix) {
			entriesToMove = append(entriesToMove, entryPath)
		}
	}
	return entriesToMove
}

// moveTreeEntries moves all entries from source to destination paths
func (w *stagedWriter) moveTreeEntries(ctx context.Context, srcPath, destPath string, entriesToMove []string) error {
	logger := log.FromContext(ctx)
	
	for _, entryPath := range entriesToMove {
		entry := w.treeEntries[entryPath]
		newPath := w.calculateNewTreeEntryPath(srcPath, destPath, entryPath)

		w.treeEntries[newPath] = &FlatTreeEntry{
			Path: newPath,
			Hash: entry.Hash,
			Type: entry.Type,
			Mode: entry.Mode,
		}

		logger.Debug("Moved entry", "from", entryPath, "to", newPath, "type", entry.Type)
	}

	// Remove all entries from their original locations
	for _, entryPath := range entriesToMove {
		delete(w.treeEntries, entryPath)
	}

	return nil
}

// calculateNewTreeEntryPath calculates the new path for a tree entry during move
func (w *stagedWriter) calculateNewTreeEntryPath(srcPath, destPath, entryPath string) string {
	if entryPath == srcPath {
		return destPath
	}
	// Replace the source path prefix with destination path prefix
	relativePath := entryPath[len(srcPath)+1:] // +1 for the "/"
	return destPath + "/" + relativePath
}

// updateTreeStructuresForMove updates tree structures for both source and destination
func (w *stagedWriter) updateTreeStructuresForMove(ctx context.Context, srcPath, destPath string, treeHash hash.Hash) error {
	// Update tree structure for destination - mark all parent directories as dirty
	if err := w.addMissingOrStaleTreeEntries(ctx, destPath, treeHash); err != nil {
		return fmt.Errorf("update tree structure for destination %q: %w", destPath, err)
	}

	// Update tree structure for source removal
	if err := w.removeTreeFromTree(ctx, srcPath); err != nil {
		return fmt.Errorf("remove tree from source %q: %w", srcPath, err)
	}

	return nil
}

// Commit creates a new commit object with all the staged changes and the specified metadata.
// This operation takes all the changes that have been staged via CreateBlob, UpdateBlob,
// DeleteBlob, and DeleteTree operations and creates a single commit containing all of them.
//
// The commit is created in memory but not yet pushed to the remote repository.
// You must call Push() to send the commit to the remote.
//
// Parameters:
//   - ctx: Context for the operation
//   - message: Commit message describing the changes
//   - author: Information about who authored the changes
//   - committer: Information about who created the commit (often same as author)
//
// Returns:
//   - *Commit: The created commit object with hash and metadata
//   - error: Error if commit creation fails
//
// Example:
//
//	author := nanogit.Author{
//	    Name:  "John Doe",
//	    Email: "john@example.com",
//	    Time:  time.Now(),
//	}
//	commit, err := writer.Commit(ctx, "Add new features", author, author)
func (w *stagedWriter) Commit(ctx context.Context, message string, author Author, committer Committer) (*Commit, error) {
	if err := w.checkCleanupState(); err != nil {
		return nil, err
	}

	if message == "" {
		return nil, ErrEmptyCommitMessage
	}

	if author.Name == "" || author.Email == "" {
		return nil, NewAuthorError("author", "missing name or email")
	}

	if committer.Name == "" || committer.Email == "" {
		return nil, NewAuthorError("committer", "missing name or email")
	}

	logger := log.FromContext(ctx)
	logger.Debug("Create commit",
		"message", message,
		"author_name", author.Name,
		"committer_name", committer.Name)

	// Build all pending trees before creating the commit
	// This optimizes performance by deferring tree building until commit time
	if err := w.buildPendingTrees(ctx); err != nil {
		return nil, fmt.Errorf("build pending trees: %w", err)
	}

	if !w.writer.HasObjects() {
		return nil, ErrNothingToCommit
	}

	authorIdentity := protocol.Identity{
		Name:      author.Name,
		Email:     author.Email,
		Timestamp: author.Time.Unix(),
		Timezone:  author.Time.Format("-0700"),
	}

	committerIdentity := protocol.Identity{
		Name:      committer.Name,
		Email:     committer.Email,
		Timestamp: committer.Time.Unix(),
		Timezone:  committer.Time.Format("-0700"),
	}

	commitHash, err := w.writer.AddCommit(w.lastTree.Hash, w.lastCommit.Hash, &authorIdentity, &committerIdentity, message)
	if err != nil {
		return nil, fmt.Errorf("create commit object: %w", err)
	}

	w.lastCommit = &Commit{
		Hash:      commitHash,
		Tree:      w.lastTree.Hash,
		Parent:    w.lastCommit.Hash,
		Author:    author,
		Committer: committer,
		Message:   message,
	}

	logger.Debug("Commit created",
		"commit_hash", commitHash.String(),
		"tree_hash", w.lastTree.Hash.String(),
		"parent_hash", w.lastCommit.Parent.String())

	return w.lastCommit, nil
}

// Push sends all staged changes and commits to the remote Git repository.
// This operation packages all the staged objects into a Git packfile and
// transmits it to the remote repository using the Git protocol.
//
// After a successful push, the writer is reset and can be used to stage
// additional changes for future commits.
//
// Parameters:
//   - ctx: Context for the operation
//
// Returns:
//   - error: Error if the push operation fails
//
// Example:
//
//	err := writer.Push(ctx)
//	if err != nil {
//	    log.Printf("Failed to push changes: %v", err)
//	}
func (w *stagedWriter) Push(ctx context.Context) error {
	if err := w.checkCleanupState(); err != nil {
		return err
	}

	logger := log.FromContext(ctx)
	logger.Debug("Push changes",
		"ref_name", w.ref.Name,
		"from_hash", w.ref.Hash.String(),
		"to_hash", w.lastCommit.Hash.String())

	if !w.writer.HasObjects() {
		return ErrNothingToPush
	}

	// Create a pipe to stream packfile data directly from WritePackfile to ReceivePack
	pipeReader, pipeWriter := io.Pipe()

	// Channel to capture any error from WritePackfile goroutine
	writeErrChan := make(chan error, 1)

	// Start WritePackfile in a goroutine, writing to the pipe
	go func() {
		defer func() {
			_ = pipeWriter.Close() // Best effort close in goroutine
		}()
		err := w.writer.WritePackfile(pipeWriter, w.ref.Name, w.ref.Hash)
		writeErrChan <- err
	}()

	// Call ReceivePack with the pipe reader (this will stream the data and parse the response)
	err := w.client.ReceivePack(ctx, pipeReader)
	if err != nil {
		_ = pipeReader.Close() // Best effort close since we're already handling an error
		return fmt.Errorf("send packfile to remote: %w", err)
	}

	// Check for any error from the WritePackfile goroutine
	if writeErr := <-writeErrChan; writeErr != nil {
		return fmt.Errorf("write packfile for ref %q: %w", w.ref.Name, writeErr)
	}

	logger.Debug("Packfile streamed successfully")

	w.writer = protocol.NewPackfileWriter(crypto.SHA1, w.storageMode)
	w.ref.Hash = w.lastCommit.Hash

	logger.Debug("Push completed",
		"ref_name", w.ref.Name,
		"new_hash", w.lastCommit.Hash.String())

	return nil
}

// addMissingOrStaleTreeEntries marks directory paths as dirty for deferred tree building.
// This method handles the tree structure updates required when adding files to Git:
//   - Marks all parent directories as dirty for later tree rebuilding
//   - Creates missing intermediate directory entries in treeEntries map
//   - Defers actual tree object creation until commit time for better performance
//
// The method works by traversing the path from the file up to the root,
// marking each directory path as dirty so trees can be built efficiently at commit time.
func (w *stagedWriter) addMissingOrStaleTreeEntries(ctx context.Context, path string, blobHash hash.Hash) error {
	logger := log.FromContext(ctx)
	// Split the path into parts
	pathParts := strings.Split(path, "/")
	// Get the file name and directory parts
	dirParts := pathParts[:len(pathParts)-1]

	// Mark all parent directories as dirty for deferred tree building
	for i := 0; i < len(dirParts); i++ {
		currentPath := strings.Join(dirParts[:i+1], "/")

		// Check if not a tree
		existingObj, exists := w.treeEntries[currentPath]
		if exists && existingObj.Type != protocol.ObjectTypeTree {
			return NewUnexpectedObjectTypeError(existingObj.Hash, protocol.ObjectTypeTree, existingObj.Type)
		}

		// Create directory entry if it doesn't exist
		if !exists {
			w.treeEntries[currentPath] = &FlatTreeEntry{
				Path: currentPath,
				Hash: hash.Zero, // Will be calculated during tree building
				Type: protocol.ObjectTypeTree,
				Mode: 0o40000,
			}
			logger.Debug("created directory entry", "path", currentPath)
		}

		// Mark this directory path as dirty
		w.dirtyPaths[currentPath] = true
		logger.Debug("marked path as dirty", "path", currentPath)
	}

	// Mark root as dirty if file is in root directory
	if len(dirParts) == 0 {
		w.dirtyPaths[""] = true
		logger.Debug("marked root as dirty for root-level file")
	} else {
		// Always mark root as dirty when any nested directory changes
		w.dirtyPaths[""] = true
		logger.Debug("marked root as dirty for nested file")
	}

	return nil
}

// removeBlobFromTree marks directory paths as dirty for deferred tree building after blob removal.
// This method handles marking the tree structure for updates when deleting files from Git:
//   - Marks all parent directories as dirty for later tree rebuilding
//   - Defers actual tree object rebuilding until commit time for better performance
//
// The method works by traversing the path from the file up to the root,
// marking each directory path as dirty so trees can be rebuilt efficiently at commit time.
func (w *stagedWriter) removeBlobFromTree(ctx context.Context, path string) error {
	logger := log.FromContext(ctx)
	// Split the path into parts
	pathParts := strings.Split(path, "/")
	if len(pathParts) == 0 {
		return errors.New("empty path")
	}

	// Get the directory parts
	dirParts := pathParts[:len(pathParts)-1]

	// Mark all parent directories as dirty for deferred tree building
	for i := 0; i < len(dirParts); i++ {
		currentPath := strings.Join(dirParts[:i+1], "/")

		// Verify the directory exists
		existingObj, exists := w.treeEntries[currentPath]
		if !exists {
			return fmt.Errorf("parent directory %s does not exist: %w", currentPath, NewPathNotFoundError(currentPath))
		}

		if existingObj.Type != protocol.ObjectTypeTree {
			return fmt.Errorf("parent path is not a tree: %w", NewUnexpectedObjectTypeError(existingObj.Hash, protocol.ObjectTypeTree, existingObj.Type))
		}

		// Mark this directory path as dirty
		w.dirtyPaths[currentPath] = true
		logger.Debug("marked path as dirty for blob removal", "path", currentPath)
	}

	// Always mark root as dirty when any file is removed
	w.dirtyPaths[""] = true
	logger.Debug("marked root as dirty for blob removal")

	return nil
}

// removeTreeFromTree marks directory paths as dirty for deferred tree building after tree removal.
// This method handles marking the tree structure for updates when deleting directories from Git:
//   - Marks all parent directories as dirty for later tree rebuilding
//   - Defers actual tree object rebuilding until commit time for better performance
//
// This is similar to removeBlobFromTree but handles directory removal instead of file removal.
func (w *stagedWriter) removeTreeFromTree(ctx context.Context, path string) error {
	logger := log.FromContext(ctx)
	// Split the path into parts
	pathParts := strings.Split(path, "/")
	// Get the parent directory parts
	parentParts := pathParts[:len(pathParts)-1]

	// Mark all parent directories as dirty for deferred tree building
	for i := 0; i < len(parentParts); i++ {
		currentPath := strings.Join(parentParts[:i+1], "/")

		// Verify the directory exists
		existingObj, exists := w.treeEntries[currentPath]
		if !exists {
			return fmt.Errorf("parent directory %s does not exist: %w", currentPath, NewPathNotFoundError(currentPath))
		}

		if existingObj.Type != protocol.ObjectTypeTree {
			return fmt.Errorf("parent path is not a tree: %w", NewUnexpectedObjectTypeError(existingObj.Hash, protocol.ObjectTypeTree, existingObj.Type))
		}

		// Mark this directory path as dirty
		w.dirtyPaths[currentPath] = true
		logger.Debug("marked path as dirty for tree removal", "path", currentPath)
	}

	// Always mark root as dirty when any directory is removed
	w.dirtyPaths[""] = true
	logger.Debug("marked root as dirty for tree removal")

	return nil
}

// buildPendingTrees builds all dirty tree objects in topological order (deepest first).
// This method is called at commit time to efficiently build all trees that need updating.
// It builds trees bottom-up to ensure parent trees can reference their children's hashes.
func (w *stagedWriter) buildPendingTrees(ctx context.Context) error {
	if len(w.dirtyPaths) == 0 {
		return nil // No dirty paths, nothing to build
	}

	logger := log.FromContext(ctx)
	logger.Debug("Building pending trees", "dirty_path_count", len(w.dirtyPaths))

	// Step 1: Collect all dirty paths and sort them by depth (deepest first)
	var dirtyPathList []string
	for path := range w.dirtyPaths {
		dirtyPathList = append(dirtyPathList, path)
	}

	// Sort by depth (deepest first) - deeper paths have more "/" separators
	sort.Slice(dirtyPathList, func(i, j int) bool {
		depthI := strings.Count(dirtyPathList[i], "/")
		depthJ := strings.Count(dirtyPathList[j], "/")
		if depthI != depthJ {
			return depthI > depthJ // Deeper paths first
		}
		// Same depth, sort alphabetically for consistency
		// Root directory ("") should always be last
		if dirtyPathList[i] == "" {
			return false
		}
		if dirtyPathList[j] == "" {
			return true
		}
		return dirtyPathList[i] < dirtyPathList[j]
	})

	logger.Debug("Sorted dirty paths", "paths", dirtyPathList)

	// Step 2: Build trees from deepest to shallowest
	for _, path := range dirtyPathList {
		// Skip if this path was already processed (can happen with complex operations)
		if _, exists := w.treeEntries[path]; !exists && path != "" {
			continue // Directory was deleted
		}

		if err := w.buildSingleTree(ctx, path); err != nil {
			return fmt.Errorf("build tree for path %q: %w", path, err)
		}
	}

	// Step 3: Clear dirty paths since all trees have been built
	w.dirtyPaths = make(map[string]bool)
	logger.Debug("Finished building pending trees")

	return nil
}

// collectDirectChildren collects all direct children entries for a directory path.
func (w *stagedWriter) collectDirectChildren(dirPath string) []protocol.PackfileTreeEntry {
	var entries []protocol.PackfileTreeEntry
	pathPrefix := dirPath
	if pathPrefix != "" {
		pathPrefix += "/"
	}

	// Find all direct children (files and subdirectories)
	for entryPath, entry := range w.treeEntries {
		if entryPath == dirPath {
			continue // Skip the directory itself
		}

		isDirectChild, childName := w.isDirectChild(entryPath, dirPath, pathPrefix)
		if isDirectChild {
			entries = append(entries, protocol.PackfileTreeEntry{
				FileMode: entry.Mode,
				FileName: childName,
				Hash:     entry.Hash.String(),
			})
		}
	}

	return entries
}

// isDirectChild determines if an entry path is a direct child of a directory.
func (w *stagedWriter) isDirectChild(entryPath, dirPath, pathPrefix string) (bool, string) {
	if dirPath == "" {
		// Root directory: direct children have no "/" in their path
		if !strings.Contains(entryPath, "/") {
			return true, entryPath
		}
	} else {
		// Non-root directory: direct children start with dirPath + "/"
		if strings.HasPrefix(entryPath, pathPrefix) {
			remainingPath := entryPath[len(pathPrefix):]
			if !strings.Contains(remainingPath, "/") {
				return true, remainingPath
			}
		}
	}
	return false, ""
}

// buildTreeObject creates a tree object and updates storage.
func (w *stagedWriter) buildTreeObject(ctx context.Context, dirPath string, entries []protocol.PackfileTreeEntry) error {
	logger := log.FromContext(ctx)

	treeObj, err := protocol.BuildTreeObject(crypto.SHA1, entries)
	if err != nil {
		return fmt.Errorf("build tree object for %q: %w", dirPath, err)
	}

	// Add to writer and storage
	w.writer.AddObject(treeObj)
	w.objStorage.Add(&treeObj)

	// Update the tree entry with the calculated hash
	if dirPath == "" {
		// This is the root tree
		w.lastTree = &treeObj
		logger.Debug("Built root tree", "hash", treeObj.Hash.String(), "entry_count", len(entries))
	} else {
		// Update the directory entry
		if dirEntry, exists := w.treeEntries[dirPath]; exists {
			dirEntry.Hash = treeObj.Hash
		}
		logger.Debug("Built directory tree", "path", dirPath, "hash", treeObj.Hash.String(), "entry_count", len(entries))
	}

	return nil
}

// buildSingleTree builds a single tree object for the given directory path.
// It collects all direct children (files and subdirectories) and creates a tree object.
func (w *stagedWriter) buildSingleTree(ctx context.Context, dirPath string) error {
	logger := log.FromContext(ctx)

	// Collect all direct children of this directory
	entries := w.collectDirectChildren(dirPath)

	// Handle empty directories by creating empty tree objects
	if len(entries) == 0 {
		logger.Debug("Creating empty tree object", "path", dirPath)
		return w.buildTreeObject(ctx, dirPath, []protocol.PackfileTreeEntry{})
	}

	// Build the tree object with collected entries
	return w.buildTreeObject(ctx, dirPath, entries)
}

// Cleanup releases all resources held by the writer and clears staged changes.
// This method:
//   - Cleans up the underlying PackfileWriter (removes temp files)
//   - Clears all staged tree entries from memory
//   - Resets the writer state
//
// After calling Cleanup, the writer should not be used for further operations.
func (w *stagedWriter) Cleanup(ctx context.Context) error {
	if w.isCleanedUp {
		return ErrWriterCleanedUp
	}

	logger := log.FromContext(ctx)
	logger.Debug("Cleaning up staged writer")

	// Clean up the packfile writer (removes temp files)
	if err := w.writer.Cleanup(); err != nil {
		return fmt.Errorf("cleanup packfile writer: %w", err)
	}

	// Clear all staged changes from memory
	w.treeEntries = make(map[string]*FlatTreeEntry)
	w.dirtyPaths = make(map[string]bool)

	// Reset writer state
	w.writer = protocol.NewPackfileWriter(crypto.SHA1, w.storageMode)

	// Mark as cleaned up to prevent further use
	w.isCleanedUp = true

	logger.Debug("Staged writer cleanup completed")
	return nil
}
