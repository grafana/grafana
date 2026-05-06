package nanogit

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/grafana/nanogit/log"
	"github.com/grafana/nanogit/protocol"
	"github.com/grafana/nanogit/protocol/client"
	"github.com/grafana/nanogit/protocol/hash"
	"github.com/grafana/nanogit/storage"
)

// Author represents the person who created the changes in the commit.
// It includes their name, email, and the timestamp of when they made the changes.
// This is typically the person who wrote the code or made the modifications.
type Author struct {
	// Name is the full name of the author (e.g., "John Doe")
	Name string
	// Email is the email address of the author (e.g., "john@example.com")
	Email string
	// Time is when the changes were originally made by the author
	Time time.Time
}

// Committer represents the person who created the commit object.
// This is often the same as the author, but can be different in cases
// where someone else commits changes on behalf of the author (e.g., via patches).
type Committer struct {
	// Name is the full name of the committer (e.g., "Jane Smith")
	Name string
	// Email is the email address of the committer (e.g., "jane@example.com")
	Email string
	// Time is when the commit object was created
	Time time.Time
}

// Commit represents a Git commit object.
// It contains metadata about the commit, including the author, committer,
// commit message, and references to the parent commits and tree.
type Commit struct {
	// Hash is the SHA-1 hash of the commit object
	Hash hash.Hash
	// Tree is the hash of the root tree object that represents the state
	// of the repository at the time of the commit
	Tree hash.Hash
	// Parent is the hash of the parent commit
	// TODO: Merge commits can have multiple parents, but currently only single parent is supported
	Parent hash.Hash
	// Author is the person who created the changes in the commit
	Author Author
	// Committer is the person who created the commit object
	Committer Committer
	// Message is the commit message that describes the changes made in this commit
	Message string
}

// Time returns the timestamp when the commit object was created.
// This is equivalent to the committer's timestamp, as the committer is the person
// who actually created the commit object in the repository. For most commits,
// this will be the same as the author time, but they can differ in some workflows.
//
// Returns:
//   - time.Time: The timestamp when the commit was created
func (c *Commit) Time() time.Time {
	return c.Committer.Time
}

// CommitFile represents a file change between two commits.
// It contains information about how a file was modified, including its path,
// mode, hash, and the type of change (added, modified, deleted, etc.).
type CommitFile struct {
	// Path of the file in the head commit
	Path string
	// Mode is the file mode in the head commit (e.g., 100644 for regular files)
	Mode uint32
	// OldMode is the original file mode in the base commit (for modified files)
	OldMode uint32
	// Hash is the file hash in the head commit
	Hash hash.Hash
	// OldHash is the original file hash in the base commit (for modified files)
	OldHash hash.Hash
	// Status indicates the type of file change (added, modified, deleted, etc.)
	Status protocol.FileStatus
}

// CompareCommits compares two commits and returns the differences between them.
// This method performs a comprehensive diff between two commits, analyzing
// all file changes that occurred between the base and head commits.
//
// The comparison includes:
//   - Added files (present in head but not in base)
//   - Modified files (different content or mode between base and head)
//   - Deleted files (present in base but not in head)
//
// Parameters:
//   - ctx: Context for the operation
//   - baseCommit: Hash of the base commit (older commit)
//   - headCommit: Hash of the head commit (newer commit)
//
// Returns:
//   - []CommitFile: Sorted list of file changes between the commits
//   - error: Error if either commit cannot be found or comparison fails
//
// Example:
//
//	changes, err := client.CompareCommits(ctx, oldCommit, newCommit)
//	if err != nil {
//	    return err
//	}
//	for _, change := range changes {
//	    fmt.Printf("%s: %s\n", change.Status, change.Path)
//	}
func (c *httpClient) CompareCommits(ctx context.Context, baseCommit, headCommit hash.Hash) ([]CommitFile, error) {
	logger := log.FromContext(ctx)
	logger.Debug("Compare commits",
		"base_hash", baseCommit.String(),
		"head_hash", headCommit.String())

	ctx, _ = storage.FromContextOrInMemory(ctx)

	// Fetch both trees concurrently to improve performance
	type treeResult struct {
		tree *FlatTree
		err  error
	}

	baseResult := make(chan treeResult, 1)
	headResult := make(chan treeResult, 1)

	go func() {
		tree, err := c.GetFlatTree(ctx, baseCommit)
		baseResult <- treeResult{tree, err}
	}()

	go func() {
		tree, err := c.GetFlatTree(ctx, headCommit)
		headResult <- treeResult{tree, err}
	}()

	baseRes := <-baseResult
	if baseRes.err != nil {
		return nil, fmt.Errorf("get base tree for commit %s: %w", baseCommit.String(), baseRes.err)
	}

	headRes := <-headResult
	if headRes.err != nil {
		return nil, fmt.Errorf("get head tree for commit %s: %w", headCommit.String(), headRes.err)
	}

	baseTree := baseRes.tree
	headTree := headRes.tree

	changes := c.compareTrees(baseTree, headTree)
	logger.Debug("Commits compared",
		"base_hash", baseCommit.String(),
		"head_hash", headCommit.String(),
		"change_count", len(changes))
	return changes, nil
}

// Memory-efficient maps storing only hash+mode instead of full entries
// This reduces memory overhead by ~60%
//
// Memory optimizations applied:
//   - mode: uint16 instead of uint32 (saves 2 bytes per entry)
//     Git file modes max out at 0o160000, so uint16 is sufficient
//
// - Struct field ordering optimized (hash first, then mode for alignment)
// - Could use [20]byte for SHA-1 hashes instead of []byte to save slice header (24 bytes -> 20 bytes)
// Additional optimizations considered:
// - Could use byte enum for common modes (0o100644, 0o100755, 0o040000) + overflow field
type entryInfo struct {
	hash hash.Hash
	mode uint16 // uint16 is sufficient for Git file modes (max 0o160000)
}

// compareTrees recursively compares two trees and collects changes between them.
// It builds maps of entries from both trees and compares them to identify:
//   - Files that exist in the head tree but not in the base tree (added)
//   - Files that exist in both trees but have different content or mode (modified)
//   - Files that exist in the base tree but not in the head tree (deleted)
//
// The function returns a sorted list of changes, with each change containing
// the relevant file information and status.
func (c *httpClient) compareTrees(base, head *FlatTree) []CommitFile {
	// Estimate capacity: assume 10-20% of files changed
	estimatedChanges := (len(base.Entries) + len(head.Entries)) / 10
	if estimatedChanges < 10 {
		estimatedChanges = 10
	}
	if estimatedChanges > 1000 {
		estimatedChanges = 1000
	}
	changes := make([]CommitFile, 0, estimatedChanges)

	// Pre-allocate maps with capacity to avoid reallocations
	inBase := make(map[string]entryInfo, len(base.Entries))
	for _, entry := range base.Entries {
		inBase[entry.Path] = entryInfo{
			hash: entry.Hash,
			mode: uint16(entry.Mode),
		}
	}

	// Single pass through head entries to find added/modified files
	inHead := make(map[string]struct{}, len(head.Entries)) // For deleted file lookup
	for _, entry := range head.Entries {
		inHead[entry.Path] = struct{}{}
		if baseInfo, exists := inBase[entry.Path]; !exists {
			// File exists in head but not in base - it was added
			changes = append(changes, CommitFile{
				Path:   entry.Path,
				Status: protocol.FileStatusAdded,
				Mode:   entry.Mode,
				Hash:   entry.Hash,
			})
		} else if !baseInfo.hash.Is(entry.Hash) && entry.Type != protocol.ObjectTypeTree {
			// File exists in both but has different content - it was modified
			changes = append(changes, CommitFile{
				Path:    entry.Path,
				Status:  protocol.FileStatusModified,
				Mode:    entry.Mode,
				Hash:    entry.Hash,
				OldHash: baseInfo.hash,
				OldMode: uint32(baseInfo.mode),
			})
		}
	}

	// Check for deleted files - only iterate through base entries not in head
	for path, baseInfo := range inBase {
		if _, exists := inHead[path]; !exists {
			// File exists in base but not in head - it was deleted
			changes = append(changes, CommitFile{
				Path:   path,
				Status: protocol.FileStatusDeleted,
				Mode:   uint32(baseInfo.mode),
				Hash:   baseInfo.hash,
			})
		}
	}

	// Sort changes by path for consistent ordering
	sort.Slice(changes, func(i, j int) bool {
		return changes[i].Path < changes[j].Path
	})

	return changes
}

// GetCommit retrieves a specific commit object from the repository by its hash.
// This method fetches the complete commit information including metadata,
// author, committer, message, and references to parent commits and tree.
//
// Parameters:
//   - ctx: Context for the operation
//   - hash: SHA-1 hash of the commit to retrieve
//
// Returns:
//   - *Commit: The commit object with all metadata
//   - error: Error if the commit is not found or cannot be retrieved
//
// Example:
//
//	commit, err := client.GetCommit(ctx, commitHash)
//	if err != nil {
//	    return err
//	}
//	fmt.Printf("Commit by %s: %s\n", commit.Author.Name, commit.Message)
func (c *httpClient) GetCommit(ctx context.Context, commitHash hash.Hash) (*Commit, error) {
	return c.getCommit(ctx, commitHash, true)
}

func (c *httpClient) getCommit(ctx context.Context, commitHash hash.Hash, noExtraObjects bool) (*Commit, error) {
	logger := log.FromContext(ctx)
	logger.Debug("Get commit",
		"commit_hash", commitHash.String())

	objects, err := c.Fetch(ctx, client.FetchOptions{
		NoProgress:     true,
		NoBlobFilter:   true,
		Want:           []hash.Hash{commitHash},
		Deepen:         1,
		Shallow:        true,
		Done:           true,
		NoExtraObjects: noExtraObjects,
	})
	if err != nil {
		// TODO: handle this at the client level
		if strings.Contains(err.Error(), "not our ref") {
			return nil, NewObjectNotFoundError(commitHash)
		}

		return nil, fmt.Errorf("fetch commit %s: %w", commitHash.String(), err)
	}

	if len(objects) == 0 {
		return nil, NewObjectNotFoundError(commitHash)
	}

	var foundObj *protocol.PackfileObject
	for _, obj := range objects {
		// Skip tree objects that are included in the response despite the blob:none filter.
		// Most Git servers don't support tree:0 filter specification, so we may receive
		// recursive tree objects that we need to filter out.
		if obj.Type == protocol.ObjectTypeTree {
			continue
		}

		if obj.Type != protocol.ObjectTypeCommit {
			return nil, NewUnexpectedObjectTypeError(commitHash, protocol.ObjectTypeCommit, obj.Type)
		}

		if foundObj != nil {
			return nil, NewUnexpectedObjectCountError(1, []*protocol.PackfileObject{foundObj, obj})
		}

		if obj.Hash.Is(commitHash) {
			foundObj = obj
		}
	}

	if foundObj == nil {
		return nil, NewObjectNotFoundError(commitHash)
	}

	commit, err := packfileObjectToCommit(foundObj)
	if err != nil {
		return nil, fmt.Errorf("parse commit %s: %w", commitHash.String(), err)
	}

	logger.Debug("Commit found",
		"commit_hash", commitHash.String(),
		"tree_hash", commit.Tree.String(),
		"parent_hash", commit.Parent.String())
	return commit, nil
}

func packfileObjectToCommit(commit *protocol.PackfileObject) (*Commit, error) {
	if commit.Type != protocol.ObjectTypeCommit {
		return nil, errors.New("commit is not a commit")
	}

	authorTime, err := commit.Commit.Author.Time()
	if err != nil {
		return nil, fmt.Errorf("parsing author time: %w", err)
	}

	committerTime, err := commit.Commit.Committer.Time()
	if err != nil {
		return nil, fmt.Errorf("parsing committer time: %w", err)
	}

	return &Commit{
		Hash:   commit.Hash,
		Tree:   commit.Commit.Tree,
		Parent: commit.Commit.Parent,
		Author: Author{
			Name:  commit.Commit.Author.Name,
			Email: commit.Commit.Author.Email,
			Time:  authorTime,
		},
		Committer: Committer{
			Name:  commit.Commit.Committer.Name,
			Email: commit.Commit.Committer.Email,
			Time:  committerTime,
		},
		Message: strings.TrimSpace(commit.Commit.Message),
	}, nil
}

// ListCommitsOptions provides filtering and pagination options for listing commits.
// Similar to GitHub's API, it allows limiting results, filtering by path, and pagination.
type ListCommitsOptions struct {
	// PerPage specifies the number of commits to return per page
	// If 0, defaults to 30. Maximum allowed is 100
	PerPage int
	// Page specifies which page of results to return (1-based)
	// If 0, defaults to 1
	Page int
	// Path filters commits to only those that affect the specified file or directory path
	// If empty, all commits are included
	Path string
	// Since filters commits to only those created after this time
	// If zero, no time filtering is applied
	Since time.Time
	// Until filters commits to only those created before this time
	// If zero, no time filtering is applied
	Until time.Time
}

// ListCommits retrieves a list of commits starting from the specified commit,
// walking backwards through the commit history. This method supports filtering
// and pagination similar to GitHub's API, allowing you to traverse repository
// history efficiently.
//
// The method traverses the commit graph starting from the specified commit,
// following parent links to build a chronological list of commits. It supports
// various filters to narrow down results and pagination for large histories.
//
// Parameters:
//   - ctx: Context for the operation
//   - startCommit: Hash of the commit to start traversal from (typically HEAD)
//   - options: Filtering and pagination options
//
// Returns:
//   - []Commit: List of commits matching the specified criteria
//   - error: Error if traversal fails or commits cannot be retrieved
//
// Example:
//
//	// Get the latest 10 commits on main branch
//	options := nanogit.ListCommitsOptions{
//	    PerPage: 10,
//	    Page:    1,
//	}
//	commits, err := client.ListCommits(ctx, mainBranchHash, options)
//	if err != nil {
//	    return err
//	}
//	for _, commit := range commits {
//	    fmt.Printf("%s: %s\n", commit.Hash.String()[:8], commit.Message)
//	}
func (c *httpClient) ListCommits(ctx context.Context, startCommit hash.Hash, options ListCommitsOptions) ([]Commit, error) {
	logger := log.FromContext(ctx)
	logger.Debug("List commits",
		"start_hash", startCommit.String(),
		"path_filter", options.Path,
		"page", options.Page,
		"per_page", options.PerPage)

	page, perPage := c.validatePagination(options)
	skip := (page - 1) * perPage
	collect := perPage

	ctx, allObjects := storage.FromContextOrInMemory(ctx)

	commitObjs, err := c.collectCommitObjects(ctx, startCommit, options, skip+collect, perPage, allObjects)
	if err != nil {
		return nil, err
	}

	commits, err := c.paginateCommits(commitObjs, skip, collect)
	if err != nil {
		return nil, err
	}

	logger.Debug("Commits listed",
		"start_hash", startCommit.String(),
		"total_found", len(commitObjs),
		"returned_count", len(commits),
		"page", page,
		"per_page", perPage)
	return commits, nil
}

// validatePagination validates and normalizes pagination parameters
func (c *httpClient) validatePagination(options ListCommitsOptions) (int, int) {
	perPage := options.PerPage
	if perPage <= 0 {
		perPage = 30
	}
	if perPage > 100 {
		perPage = 100
	}

	page := options.Page
	if page <= 0 {
		page = 1
	}

	return page, perPage
}

// collectCommitObjects traverses commit history and collects matching commits
func (c *httpClient) collectCommitObjects(ctx context.Context, startCommit hash.Hash, options ListCommitsOptions, maxCommits, perPage int, allObjects storage.PackfileStorage) ([]*protocol.PackfileObject, error) {
	logger := log.FromContext(ctx)
	var commitObjs []*protocol.PackfileObject
	visited := make(map[string]bool)
	queue := []hash.Hash{startCommit}

	for len(queue) > 0 && len(commitObjs) < maxCommits {
		currentHash := queue[0]
		queue = queue[1:]

		if visited[currentHash.String()] {
			continue
		}
		visited[currentHash.String()] = true

		commit, err := c.fetchCommitObject(ctx, currentHash, perPage, allObjects)
		if err != nil {
			return nil, err
		}

		matches, err := c.commitMatchesFilters(ctx, commit, &options, allObjects)
		if err != nil {
			return nil, fmt.Errorf("check filters for commit %s: %w", currentHash.String(), err)
		}

		if matches {
			commitObjs = append(commitObjs, commit)
			logger.Debug("Commit added",
				"commit_hash", currentHash.String(),
				"total_commits", len(commitObjs))
		}

		if !commit.Commit.Parent.Is(hash.Zero) {
			queue = append(queue, commit.Commit.Parent)
		}
	}

	return commitObjs, nil
}

// fetchCommitObject fetches a single commit object
func (c *httpClient) fetchCommitObject(ctx context.Context, commitHash hash.Hash, perPage int, allObjects storage.PackfileStorage) (*protocol.PackfileObject, error) {
	logger := log.FromContext(ctx)
	logger.Debug("Process commit",
		"commit_hash", commitHash.String())

	objects, err := c.Fetch(ctx, client.FetchOptions{
		NoProgress:     true,
		NoBlobFilter:   true,
		Want:           []hash.Hash{commitHash},
		Deepen:         perPage,
		Done:           true,
		NoExtraObjects: false, // we want to read other commits
	})
	if err != nil {
		return nil, fmt.Errorf("fetch commit %s: %w", commitHash.String(), err)
	}

	commit, ok := objects[commitHash.String()]
	if !ok || commit.Type != protocol.ObjectTypeCommit {
		commit, ok = allObjects.GetByType(commitHash, protocol.ObjectTypeCommit)
		if !ok {
			return nil, NewObjectNotFoundError(commitHash)
		}
	}

	return commit, nil
}

// paginateCommits applies pagination to the collected commits
func (c *httpClient) paginateCommits(commitObjs []*protocol.PackfileObject, skip, collect int) ([]Commit, error) {
	if skip >= len(commitObjs) {
		return []Commit{}, nil
	}

	end := min(skip+collect, len(commitObjs))
	commits := make([]Commit, 0, end-skip)
	for _, obj := range commitObjs[skip:end] {
		commit, err := packfileObjectToCommit(obj)
		if err != nil {
			return nil, fmt.Errorf("parse commit %s: %w", obj.Hash.String(), err)
		}
		commits = append(commits, *commit)
	}

	return commits, nil
}

// commitMatchesFilters checks if a commit matches the specified filters.
func (c *httpClient) commitMatchesFilters(ctx context.Context, commit *protocol.PackfileObject, options *ListCommitsOptions, allObjects storage.PackfileStorage) (bool, error) {
	logger := log.FromContext(ctx)
	logger.Debug("Check commit filters",
		"commit_hash", commit.Hash.String(),
		"path_filter", options.Path)

	commitTime, err := commit.Commit.Author.Time()
	if err != nil {
		return false, fmt.Errorf("parse commit time for %s: %w", commit.Hash.String(), err)
	}

	if !options.Since.IsZero() && commitTime.Before(options.Since) {
		logger.Debug("Commit filtered by time",
			"commit_hash", commit.Hash.String(),
			"commit_time", commitTime,
			"since", options.Since)
		return false, nil
	}

	if !options.Until.IsZero() && commitTime.After(options.Until) {
		logger.Debug("Commit filtered by time",
			"commit_hash", commit.Hash.String(),
			"commit_time", commitTime,
			"until", options.Until)
		return false, nil
	}

	if options.Path != "" {
		affected, err := c.commitAffectsPath(ctx, commit, options.Path, allObjects)
		if err != nil {
			logger.Debug("Failed to check path filter",
				"commit_hash", commit.Hash.String(),
				"path", options.Path,
				"error", err)
			return false, fmt.Errorf("check path filter: %w", err)
		}
		if !affected {
			logger.Debug("Commit filtered by path",
				"commit_hash", commit.Hash.String(),
				"path", options.Path)
			return false, nil
		}
	}

	return true, nil
}

// commitAffectsPath checks if a commit affects the specified path by comparing with the hash of that path in the parent commit.
// TODO: make it work for merge commits
func (c *httpClient) commitAffectsPath(ctx context.Context, commit *protocol.PackfileObject, path string, allObjects storage.PackfileStorage) (bool, error) {
	logger := log.FromContext(ctx)
	logger.Debug("Checking if commit affects path",
		"commitHash", commit.Hash.String(),
		"path", path)

	// For the initial commit (no parent), check if the path exists
	if commit.Commit.Parent.Is(hash.Zero) {
		parentHash, err := c.hashForPath(ctx, commit.Hash, path, allObjects)
		if err != nil {
			logger.Debug("Failed to get hash for path in initial commit",
				"commitHash", commit.Hash.String(),
				"path", path,
				"error", err)
			return false, fmt.Errorf("hash for path: %w", err)
		}

		affected := !parentHash.Is(hash.Zero)
		logger.Debug("Initial commit path check",
			"commitHash", commit.Hash.String(),
			"path", path,
			"affected", affected)
		return affected, nil
	}

	pathHashParent, err := c.hashForPath(ctx, commit.Commit.Parent, path, allObjects)
	if err != nil {
		logger.Debug("Failed to get hash for path in parent commit",
			"commitHash", commit.Commit.Parent.String(),
			"path", path,
			"error", err)
		return false, fmt.Errorf("hash for path: %w", err)
	}

	pathHashCommit, err := c.hashForPath(ctx, commit.Hash, path, allObjects)
	if err != nil {
		logger.Debug("Failed to get hash for path in current commit",
			"commitHash", commit.Hash.String(),
			"path", path,
			"error", err)
		return false, fmt.Errorf("hash for path: %w", err)
	}

	affected := !pathHashParent.Is(pathHashCommit)
	logger.Debug("Path comparison completed",
		"commitHash", commit.Hash.String(),
		"path", path,
		"parentHash", pathHashParent.String(),
		"currentHash", pathHashCommit.String(),
		"affected", affected)
	return affected, nil
}

// walkPathToTreeHash walks the path to find the tree hash
// if the object is not in the storage, it will be fetched.
// All objects returned by the client will be added to the storage.
// If the object is not found, hash.Zero will be returned.
// If the object is a tree, the hash of the tree will be returned.
// If the object is a blob, the hash of the blob will be returned.
// Otherwise, return an error.
func (c *httpClient) hashForPath(ctx context.Context, commitHash hash.Hash, path string, allObjects storage.PackfileStorage) (hash.Hash, error) {
	logger := log.FromContext(ctx)
	logger.Debug("Getting hash for path",
		"commitHash", commitHash.String(),
		"path", path)

	commit, ok := allObjects.GetByType(commitHash, protocol.ObjectTypeCommit)
	if !ok {
		logger.Debug("Commit not in storage, fetching", "commitHash", commitHash.String())
		objects, err := c.Fetch(ctx, client.FetchOptions{
			NoProgress:     true,
			NoBlobFilter:   true,
			Want:           []hash.Hash{commitHash},
			Shallow:        true,
			Done:           true,
			NoExtraObjects: false, // let's read of other tree objects if possible
		})
		if err != nil {
			logger.Debug("Failed to fetch commit", "commitHash", commitHash.String(), "error", err)
			return hash.Zero, fmt.Errorf("getting commit to get hash for path: %w", err)
		}

		// Try to find it in the objects we got but if not, get it from the storage
		commit, ok = objects[commitHash.String()]
		if !ok {
			return hash.Zero, NewObjectNotFoundError(commitHash)
		}
	}

	treeHash := commit.Commit.Tree
	tree, err := c.GetTree(ctx, treeHash)
	if err != nil {
		logger.Debug("Failed to get tree", "treeHash", treeHash.String(), "error", err)
		return hash.Zero, fmt.Errorf("getting tree: %w", err)
	}

	// If path is empty, return the tree hash
	if path == "" {
		// This should never happen with the current use of hashForPath
		return treeHash, nil
	}

	// Split path into components
	components := strings.Split(path, "/")
	currentTree := tree

	// Walk through all components except the last one
	for i := 0; i < len(components)-1; i++ {
		component := strings.TrimSpace(components[i])
		if component == "" {
			return hash.Zero, errors.New("path component is empty")
		}

		// Find the entry in the current tree
		var entryHash hash.Hash
		var found bool
		for _, entry := range currentTree.Entries {
			if entry.Name == component {
				entryHash = entry.Hash
				found = true
				break
			}
		}

		if !found {
			logger.Debug("Path component not found",
				"component", component,
				"depth", i+1,
				"fullPath", path)
			return hash.Zero, nil
		}

		// Get the next tree for the next iteration
		nextTree, err := c.GetTree(ctx, entryHash)
		if err != nil {
			logger.Debug("Failed to get next tree",
				"treeHash", entryHash.String(),
				"component", component,
				"error", err)
			return hash.Zero, fmt.Errorf("getting tree: %w", err)
		}

		currentTree = nextTree
	}

	// Handle the final component
	finalComponent := strings.TrimSpace(components[len(components)-1])
	if finalComponent == "" {
		return hash.Zero, errors.New("path component is empty")
	}

	// Find the final entry in the current tree
	for _, entry := range currentTree.Entries {
		if entry.Name == finalComponent {
			logger.Debug("Found hash for path",
				"path", path,
				"hash", entry.Hash.String())
			return entry.Hash, nil
		}
	}

	// Final component not found
	logger.Debug("Final path component not found",
		"component", finalComponent,
		"fullPath", path)
	return hash.Zero, nil
}
