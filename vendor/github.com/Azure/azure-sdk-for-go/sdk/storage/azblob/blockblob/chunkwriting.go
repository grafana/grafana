//go:build go1.18
// +build go1.18

// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License. See License.txt in the project root for license information.

package blockblob

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/binary"
	"errors"
	"io"
	"sync"
	"sync/atomic"

	"github.com/Azure/azure-sdk-for-go/sdk/azcore/streaming"
	"github.com/Azure/azure-sdk-for-go/sdk/internal/uuid"
	"github.com/Azure/azure-sdk-for-go/sdk/storage/azblob/internal/shared"
)

// blockWriter provides methods to upload blocks that represent a file to a server and commit them.
// This allows us to provide a local implementation that fakes the server for hermetic testing.
type blockWriter interface {
	StageBlock(context.Context, string, io.ReadSeekCloser, *StageBlockOptions) (StageBlockResponse, error)
	Upload(context.Context, io.ReadSeekCloser, *UploadOptions) (UploadResponse, error)
	CommitBlockList(context.Context, []string, *CommitBlockListOptions) (CommitBlockListResponse, error)
}

// copyFromReader copies a source io.Reader to blob storage using concurrent uploads.
func copyFromReader[T ~[]byte](ctx context.Context, src io.Reader, dst blockWriter, options UploadStreamOptions, getBufferManager func(maxBuffers int, bufferSize int64) shared.BufferManager[T]) (CommitBlockListResponse, error) {
	options.setDefaults()

	wg := sync.WaitGroup{}       // Used to know when all outgoing blocks have finished processing
	errCh := make(chan error, 1) // contains the first error encountered during processing

	buffers := getBufferManager(options.Concurrency, options.BlockSize)
	defer buffers.Free()

	// this controls the lifetime of the uploading goroutines.
	// if an error is encountered, cancel() is called which will terminate all uploads.
	// NOTE: the ordering is important here.  cancel MUST execute before
	// cleaning up the buffers so that any uploading goroutines exit first,
	// releasing their buffers back to the pool for cleanup.
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	// all blocks have IDs that start with a random UUID
	blockIDPrefix, err := uuid.New()
	if err != nil {
		return CommitBlockListResponse{}, err
	}
	tracker := blockTracker{
		blockIDPrefix: blockIDPrefix,
		options:       options,
	}

	// This goroutine grabs a buffer, reads from the stream into the buffer,
	// then creates a goroutine to upload/stage the block.
	for blockNum := uint32(0); true; blockNum++ {
		var buffer T
		select {
		case buffer = <-buffers.Acquire():
			// got a buffer
		default:
			// no buffer available; allocate a new buffer if possible
			if _, err := buffers.Grow(); err != nil {
				return CommitBlockListResponse{}, err
			}

			// either grab the newly allocated buffer or wait for one to become available
			buffer = <-buffers.Acquire()
		}

		var n int
		n, err = shared.ReadAtLeast(src, buffer, len(buffer))

		if n > 0 {
			// some data was read, upload it
			wg.Add(1) // We're posting a buffer to be sent

			// NOTE: we must pass blockNum as an arg to our goroutine else
			// it's captured by reference and can change underneath us!
			go func(blockNum uint32) {
				// Upload the outgoing block, matching the number of bytes read
				err := tracker.uploadBlock(ctx, dst, blockNum, buffer[:n])
				if err != nil {
					select {
					case errCh <- err:
						// error was set
					default:
						// some other error is already set
					}
					cancel()
				}
				buffers.Release(buffer) // The goroutine reading from the stream can reuse this buffer now

				// signal that the block has been staged.
				// we MUST do this after attempting to write to errCh
				// to avoid it racing with the reading goroutine.
				wg.Done()
			}(blockNum)
		} else {
			// nothing was read so the buffer is empty, send it back for reuse/clean-up.
			buffers.Release(buffer)
		}

		if err != nil { // The reader is done, no more outgoing buffers
			if errors.Is(err, io.EOF) {
				// these are expected errors, we don't surface those
				err = nil
			} else {
				// some other error happened, terminate any outstanding uploads
				cancel()
			}
			break
		}
	}

	wg.Wait() // Wait for all outgoing blocks to complete

	if err != nil {
		// there was an error reading from src, favor this error over any error during staging
		return CommitBlockListResponse{}, err
	}

	select {
	case err = <-errCh:
		// there was an error during staging
		return CommitBlockListResponse{}, err
	default:
		// no error was encountered
	}

	// If no error, after all blocks uploaded, commit them to the blob & return the result
	return tracker.commitBlocks(ctx, dst)
}

// used to manage the uploading and committing of blocks
type blockTracker struct {
	blockIDPrefix uuid.UUID // UUID used with all blockIDs
	maxBlockNum   uint32    // defaults to 0
	firstBlock    []byte    // Used only if maxBlockNum is 0
	options       UploadStreamOptions
}

func (bt *blockTracker) uploadBlock(ctx context.Context, to blockWriter, num uint32, buffer []byte) error {
	if num == 0 {
		bt.firstBlock = buffer

		// If whole payload fits in 1 block, don't stage it; End will upload it with 1 I/O operation
		// If the payload is exactly the same size as the buffer, there may be more content coming in.
		if len(buffer) < int(bt.options.BlockSize) {
			return nil
		}
	} else {
		// Else, upload a staged block...
		atomicMorphUint32(&bt.maxBlockNum, func(startVal uint32) (val uint32, morphResult uint32) {
			// Atomically remember (in t.numBlocks) the maximum block num we've ever seen
			if startVal < num {
				return num, 0
			}
			return startVal, 0
		})
	}

	blockID := newUUIDBlockID(bt.blockIDPrefix).WithBlockNumber(num).ToBase64()
	_, err := to.StageBlock(ctx, blockID, streaming.NopCloser(bytes.NewReader(buffer)), bt.options.getStageBlockOptions())
	return err
}

func (bt *blockTracker) commitBlocks(ctx context.Context, to blockWriter) (CommitBlockListResponse, error) {
	// If the first block had the exact same size as the buffer
	// we would have staged it as a block thinking that there might be more data coming
	if bt.maxBlockNum == 0 && len(bt.firstBlock) < int(bt.options.BlockSize) {
		// If whole payload fits in 1 block (block #0), upload it with 1 I/O operation
		up, err := to.Upload(ctx, streaming.NopCloser(bytes.NewReader(bt.firstBlock)), bt.options.getUploadOptions())
		if err != nil {
			return CommitBlockListResponse{}, err
		}

		// convert UploadResponse to CommitBlockListResponse
		return CommitBlockListResponse{
			ClientRequestID:     up.ClientRequestID,
			ContentMD5:          up.ContentMD5,
			Date:                up.Date,
			ETag:                up.ETag,
			EncryptionKeySHA256: up.EncryptionKeySHA256,
			EncryptionScope:     up.EncryptionScope,
			IsServerEncrypted:   up.IsServerEncrypted,
			LastModified:        up.LastModified,
			RequestID:           up.RequestID,
			Version:             up.Version,
			VersionID:           up.VersionID,
			//ContentCRC64:     up.ContentCRC64, doesn't exist on UploadResponse
		}, nil
	}

	// Multiple blocks staged, commit them all now
	blockID := newUUIDBlockID(bt.blockIDPrefix)
	blockIDs := make([]string, bt.maxBlockNum+1)
	for bn := uint32(0); bn < bt.maxBlockNum+1; bn++ {
		blockIDs[bn] = blockID.WithBlockNumber(bn).ToBase64()
	}

	return to.CommitBlockList(ctx, blockIDs, bt.options.getCommitBlockListOptions())
}

// AtomicMorpherUint32 identifies a method passed to and invoked by the AtomicMorph function.
// The AtomicMorpher callback is passed a startValue and based on this value it returns
// what the new value should be and the result that AtomicMorph should return to its caller.
type atomicMorpherUint32 func(startVal uint32) (val uint32, morphResult uint32)

// AtomicMorph atomically morphs target in to new value (and result) as indicated bythe AtomicMorpher callback function.
func atomicMorphUint32(target *uint32, morpher atomicMorpherUint32) uint32 {
	for {
		currentVal := atomic.LoadUint32(target)
		desiredVal, morphResult := morpher(currentVal)
		if atomic.CompareAndSwapUint32(target, currentVal, desiredVal) {
			return morphResult
		}
	}
}

type blockID [64]byte

func (blockID blockID) ToBase64() string {
	return base64.StdEncoding.EncodeToString(blockID[:])
}

type uuidBlockID blockID

func newUUIDBlockID(u uuid.UUID) uuidBlockID {
	ubi := uuidBlockID{}     // Create a new uuidBlockID
	copy(ubi[:len(u)], u[:]) // Copy the specified UUID into it
	// Block number defaults to 0
	return ubi
}

func (ubi uuidBlockID) WithBlockNumber(blockNumber uint32) uuidBlockID {
	binary.BigEndian.PutUint32(ubi[len(uuid.UUID{}):], blockNumber) // Put block number after UUID
	return ubi                                                      // Return the passed-in copy
}

func (ubi uuidBlockID) ToBase64() string {
	return blockID(ubi).ToBase64()
}
