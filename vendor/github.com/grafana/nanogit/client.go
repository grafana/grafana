package nanogit

import (
	"context"

	"github.com/grafana/nanogit/options"
	"github.com/grafana/nanogit/protocol/client"
	"github.com/grafana/nanogit/protocol/hash"
)

//go:generate go run github.com/maxbrunsfeld/counterfeiter/v6 -o mocks/staged_writer.go . StagedWriter

// StagedWriter provides a transactional interface for writing changes to Git objects.
// It allows staging multiple changes (file writes, updates, deletes) before committing them together.
// Changes are staged in memory and only sent to the server when Push() is called.
// This can be used to write to any Git object: commits, tags, branches, or other references.
type StagedWriter interface {
	// BlobExists checks if a blob exists at the given path.
	BlobExists(ctx context.Context, path string) (bool, error)

	// CreateBlob stages a new file to be written at the given path.
	// Returns the hash of the created blob.
	CreateBlob(ctx context.Context, path string, content []byte) (hash.Hash, error)

	// UpdateBlob stages an update to an existing file at the given path.
	// Returns the hash of the updated blob.
	UpdateBlob(ctx context.Context, path string, content []byte) (hash.Hash, error)

	// DeleteBlob stages the deletion of a file at the given path.
	// Returns the hash of the tree after deletion.
	DeleteBlob(ctx context.Context, path string) (hash.Hash, error)

	// MoveBlob stages the move of a file from srcPath to destPath.
	// This is equivalent to copying the file to the new location and deleting the original.
	// Returns the hash of the moved blob.
	MoveBlob(ctx context.Context, srcPath, destPath string) (hash.Hash, error)

	// GetTree gets the tree object at the given path.
	GetTree(ctx context.Context, path string) (*Tree, error)

	// DeleteTree stages the deletion of a directory and all its contents at the given path.
	// Returns the hash of the deleted tree.
	DeleteTree(ctx context.Context, path string) (hash.Hash, error)

	// MoveTree stages the move of a directory and all its contents from srcPath to destPath.
	// This recursively moves all files and subdirectories within the specified path.
	// Returns the hash of the moved tree.
	MoveTree(ctx context.Context, srcPath, destPath string) (hash.Hash, error)

	// Commit creates a new commit with all staged changes.
	// Returns the hash of the created commit.
	Commit(ctx context.Context, message string, author Author, committer Committer) (*Commit, error)

	// Push sends all committed changes to the remote repository.
	// This is the final step that makes changes visible to others.
	// It will update the reference to point to the last commit.
	Push(ctx context.Context) error

	// Cleanup releases any resources held by the writer and clears all staged changes.
	// This should be called when the writer is no longer needed or to cancel all pending changes.
	// After calling Cleanup, the writer should not be used for further operations.
	Cleanup(ctx context.Context) error
}

// Client defines the interface for interacting with a Git repository.
// It provides methods for repository operations, reference management,
//
//go:generate go run github.com/maxbrunsfeld/counterfeiter/v6 -o mocks/client.go . Client
type Client interface {
	// Repo operations
	IsAuthorized(ctx context.Context) (bool, error)
	RepoExists(ctx context.Context) (bool, error)
	// Ref operations
	ListRefs(ctx context.Context) ([]Ref, error)
	GetRef(ctx context.Context, refName string) (Ref, error)
	CreateRef(ctx context.Context, ref Ref) error
	UpdateRef(ctx context.Context, ref Ref) error
	DeleteRef(ctx context.Context, refName string) error
	// Blob operations
	GetBlob(ctx context.Context, hash hash.Hash) (*Blob, error)
	GetBlobByPath(ctx context.Context, rootHash hash.Hash, path string) (*Blob, error)
	// Tree operations
	GetFlatTree(ctx context.Context, hash hash.Hash) (*FlatTree, error)
	GetTree(ctx context.Context, hash hash.Hash) (*Tree, error)
	GetTreeByPath(ctx context.Context, rootHash hash.Hash, path string) (*Tree, error)
	// Commit operations
	GetCommit(ctx context.Context, hash hash.Hash) (*Commit, error)
	CompareCommits(ctx context.Context, baseCommit, headCommit hash.Hash) ([]CommitFile, error)
	ListCommits(ctx context.Context, startCommit hash.Hash, options ListCommitsOptions) ([]Commit, error)
	// Clone operations
	Clone(ctx context.Context, opts CloneOptions) (*CloneResult, error)
	// Write operations
	NewStagedWriter(ctx context.Context, ref Ref, options ...WriterOption) (StagedWriter, error)
}

// httpClient is the private implementation of the Client interface.
// It implements the Git Smart Protocol version 2 over HTTP/HTTPS transport.
type httpClient struct {
	client.RawClient
}

// NewHTTPClient creates a new Git client for the specified repository URL.
// The client implements the Git Smart Protocol version 2 over HTTP/HTTPS transport.
// It supports both HTTP and HTTPS URLs and can be configured with various options
// for authentication, logging, and HTTP client customization.
//
// Parameters:
//   - repo: Repository URL (must be HTTP or HTTPS)
//   - options: Configuration options for authentication, logging, etc.
//
// Returns:
//   - Client: Configured Git client interface
//   - error: Error if URL is invalid or configuration fails
//
// Example:
//
//	// Create client with basic authentication
//	client, err := nanogit.NewHTTPClient(
//	    "https://github.com/user/repo",
//	    options.WithBasicAuth("username", "password"),
//	    options.WithLogger(logger),
//	)
//	if err != nil {
//	    return err
//	}
func NewHTTPClient(repo string, options ...options.Option) (Client, error) {
	rawClient, err := client.NewRawClient(repo, options...)
	if err != nil {
		return nil, err
	}

	return &httpClient{
		RawClient: rawClient,
	}, nil
}
