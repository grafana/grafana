package nanogit

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/grafana/nanogit/log"
	"github.com/grafana/nanogit/protocol"
	"github.com/grafana/nanogit/protocol/client"
	"github.com/grafana/nanogit/protocol/hash"
	"github.com/grafana/nanogit/storage"
)

// GetBlob retrieves a blob (file content) from the repository by its hash.
// This method fetches the raw content of a file stored in the Git object database.
//
// Parameters:
//   - ctx: Context for the operation
//   - blobID: SHA-1 hash of the blob object to retrieve
//
// Returns:
//   - *Blob: The blob object containing hash and file content
//   - error: Error if the blob is not found or cannot be retrieved
//
// Example:
//
//	blob, err := client.GetBlob(ctx, blobHash)
//	if err != nil {
//	    return err
//	}
//	fmt.Printf("File content: %s\n", string(blob.Content))
func (c *httpClient) GetBlob(ctx context.Context, blobID hash.Hash) (*Blob, error) {
	logger := log.FromContext(ctx)
	logger.Debug("Get blob",
		"blob_hash", blobID.String())

	objects, err := c.Fetch(ctx, client.FetchOptions{
		NoProgress:     true,
		Want:           []hash.Hash{blobID},
		Done:           true,
		NoExtraObjects: true, // we only need that single blob
	})
	if err != nil {
		// TODO: handle this at the client level
		if strings.Contains(err.Error(), "not our ref") {
			return nil, NewObjectNotFoundError(blobID)
		}

		return nil, fmt.Errorf("fetch blob %s: %w", blobID.String(), err)
	}

	var foundObj *protocol.PackfileObject
	for _, obj := range objects {
		if obj.Type != protocol.ObjectTypeBlob {
			return nil, NewUnexpectedObjectTypeError(blobID, protocol.ObjectTypeBlob, obj.Type)
		}

		// we got more blobs than expected
		if foundObj != nil {
			return nil, NewUnexpectedObjectCountError(1, []*protocol.PackfileObject{foundObj, obj})
		}

		if obj.Hash.Is(blobID) {
			foundObj = obj
		}
	}

	if foundObj != nil {
		logger.Debug("Blob found",
			"blob_hash", blobID.String(),
			"content_size", len(foundObj.Data))
		return &Blob{
			Hash:    blobID,
			Content: foundObj.Data,
		}, nil
	}

	return nil, NewObjectNotFoundError(blobID)
}

// Blob represents a Git blob object, which stores the content of a file.
// In Git, all file content is stored as blob objects in the object database.
type Blob struct {
	// Hash is the SHA-1 hash of the blob object
	Hash hash.Hash
	// Content is the raw file content as bytes
	Content []byte
}

// GetBlobByPath retrieves a file from the repository by navigating through
// the directory structure to the specified path. This method efficiently
// traverses the tree hierarchy to locate and fetch the file content.
//
// The path should use forward slashes ("/") as separators, similar to Unix paths.
// The method navigates through directory trees to find the target file.
//
// Parameters:
//   - ctx: Context for the operation
//   - rootHash: Hash of the root tree to start navigation from
//   - path: File path to retrieve (e.g., "src/main.go" or "docs/readme.md")
//
// Returns:
//   - *Blob: The blob object containing the file content
//   - error: Error if path doesn't exist, contains non-files, or retrieval fails
//
// Example:
//
//	// Get the content of a specific file
//	blob, err := client.GetBlobByPath(ctx, rootTreeHash, "src/main.go")
//	if err != nil {
//	    return fmt.Errorf("file not found: %w", err)
//	}
//	fmt.Printf("File content: %s\n", string(blob.Content))
func (c *httpClient) GetBlobByPath(ctx context.Context, rootHash hash.Hash, path string) (*Blob, error) {
	if path == "" {
		return nil, ErrEmptyPath
	}

	if strings.HasSuffix(path, "/") {
		return nil, errors.New("invalid path: ends with slash")
	}

	logger := log.FromContext(ctx)
	logger.Debug("Get blob by path",
		"root_hash", rootHash.String(),
		"path", path)

	// Add in-memory storage as it's a complex operation with multiple calls
	// and we may get more objects in the same request than expected in some responses
	ctx, _ = storage.FromContextOrInMemory(ctx)

	// Split the path into parts
	parts := strings.Split(path, "/")
	currentHash := rootHash

	// Navigate through all but the last part (directories)
	for i, part := range parts[:len(parts)-1] {
		if part == "" {
			continue // Skip empty parts (e.g., from leading/trailing slashes)
		}

		logger.Debug("Navigate directory",
			"depth", i+1,
			"dir_name", part)

		// Get the current tree
		currentTree, err := c.GetTree(ctx, currentHash)
		if err != nil {
			return nil, fmt.Errorf("get tree at %q: %w", strings.Join(parts[:i+1], "/"), err)
		}

		// Find the entry with the matching name
		found := false
		for _, entry := range currentTree.Entries {
			if entry.Name == part {
				if entry.Type != protocol.ObjectTypeTree {
					return nil, NewUnexpectedObjectTypeError(entry.Hash, protocol.ObjectTypeTree, entry.Type)
				}

				currentHash = entry.Hash
				found = true
				break
			}
		}

		if !found {
			return nil, NewPathNotFoundError(path)
		}
	}

	// Get the final tree containing the target file
	finalTree, err := c.GetTree(ctx, currentHash)
	if err != nil {
		return nil, fmt.Errorf("get final tree %s: %w", currentHash.String(), err)
	}

	// Find the target file (last part of path)
	fileName := parts[len(parts)-1]
	logger.Debug("Search for file",
		"file_name", fileName,
		"dir_hash", currentHash.String())

	for _, entry := range finalTree.Entries {
		if entry.Name == fileName {
			if entry.Type != protocol.ObjectTypeBlob {
				return nil, NewUnexpectedObjectTypeError(entry.Hash, protocol.ObjectTypeBlob, entry.Type)
			}

			blob, err := c.GetBlob(ctx, entry.Hash)
			if err != nil {
				return nil, fmt.Errorf("get blob %s at %q: %w", entry.Hash.String(), path, err)
			}

			logger.Debug("Blob found by path",
				"path", path,
				"blob_hash", blob.Hash.String(),
				"content_size", len(blob.Content))
			return blob, nil
		}
	}

	return nil, NewPathNotFoundError(path)
}
