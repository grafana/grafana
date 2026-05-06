package lz4stream

import (
	"encoding/binary"
	"fmt"
	"io"
	"sync"

	"github.com/pierrec/lz4/v4/internal/lz4block"
	"github.com/pierrec/lz4/v4/internal/lz4errors"
	"github.com/pierrec/lz4/v4/internal/xxh32"
)

type Blocks struct {
	Block  *FrameDataBlock
	Blocks chan chan *FrameDataBlock
	mu     sync.Mutex
	err    error
}

func (b *Blocks) initW(f *Frame, dst io.Writer, num int) {
	if num == 1 {
		b.Blocks = nil
		b.Block = NewFrameDataBlock(f)
		return
	}
	b.Block = nil
	if cap(b.Blocks) != num {
		b.Blocks = make(chan chan *FrameDataBlock, num)
	}
	// goroutine managing concurrent block compression goroutines.
	go func() {
		// Process next block compression item.
		for c := range b.Blocks {
			// Read the next compressed block result.
			// Waiting here ensures that the blocks are output in the order they were sent.
			// The incoming channel is always closed as it indicates to the caller that
			// the block has been processed.
			block := <-c
			if block == nil {
				// Notify the block compression routine that we are done with its result.
				// This is used when a sentinel block is sent to terminate the compression.
				close(c)
				return
			}
			// Do not attempt to write the block upon any previous failure.
			if b.err == nil {
				// Write the block.
				if err := block.Write(f, dst); err != nil {
					// Keep the first error.
					b.err = err
					// All pending compression goroutines need to shut down, so we need to keep going.
				}
			}
			close(c)
		}
	}()
}

func (b *Blocks) close(f *Frame, num int) error {
	if num == 1 {
		if b.Block != nil {
			b.Block.Close(f)
		}
		err := b.err
		b.err = nil
		return err
	}
	if b.Blocks == nil {
		err := b.err
		b.err = nil
		return err
	}
	c := make(chan *FrameDataBlock)
	b.Blocks <- c
	c <- nil
	<-c
	err := b.err
	b.err = nil
	return err
}

// ErrorR returns any error set while uncompressing a stream.
func (b *Blocks) ErrorR() error {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.err
}

// initR returns a channel that streams the uncompressed blocks if in concurrent
// mode and no error. When the channel is closed, check for any error with b.ErrorR.
//
// If not in concurrent mode, the uncompressed block is b.Block and the returned error
// needs to be checked.
func (b *Blocks) initR(f *Frame, num int, src io.Reader) (chan []byte, error) {
	size := f.Descriptor.Flags.BlockSizeIndex()
	if num == 1 {
		b.Blocks = nil
		b.Block = NewFrameDataBlock(f)
		return nil, nil
	}
	b.Block = nil
	blocks := make(chan chan []byte, num)
	// data receives the uncompressed blocks.
	data := make(chan []byte)
	// Read blocks from the source sequentially
	// and uncompress them concurrently.

	// In legacy mode, accrue the uncompress sizes in cum.
	var cum uint32
	go func() {
		var cumx uint32
		var err error
		for b.ErrorR() == nil {
			block := NewFrameDataBlock(f)
			cumx, err = block.Read(f, src, 0)
			if err != nil {
				block.Close(f)
				break
			}
			// Recheck for an error as reading may be slow and uncompressing is expensive.
			if b.ErrorR() != nil {
				block.Close(f)
				break
			}
			c := make(chan []byte)
			blocks <- c
			go func() {
				defer block.Close(f)
				data, err := block.Uncompress(f, size.Get(), nil, false)
				if err != nil {
					b.closeR(err)
					// Close the block channel to indicate an error.
					close(c)
				} else {
					c <- data
				}
			}()
		}
		// End the collection loop and the data channel.
		c := make(chan []byte)
		blocks <- c
		c <- nil // signal the collection loop that we are done
		<-c      // wait for the collect loop to complete
		if f.isLegacy() && cum == cumx {
			err = io.EOF
		}
		b.closeR(err)
		close(data)
	}()
	// Collect the uncompressed blocks and make them available
	// on the returned channel.
	go func(leg bool) {
		defer close(blocks)
		skipBlocks := false
		for c := range blocks {
			buf, ok := <-c
			if !ok {
				// A closed channel indicates an error.
				// All remaining channels should be discarded.
				skipBlocks = true
				continue
			}
			if buf == nil {
				// Signal to end the loop.
				close(c)
				return
			}
			if skipBlocks {
				// A previous error has occurred, skipping remaining channels.
				continue
			}
			// Perform checksum now as the blocks are received in order.
			if f.Descriptor.Flags.ContentChecksum() {
				_, _ = f.checksum.Write(buf)
			}
			if leg {
				cum += uint32(len(buf))
			}
			data <- buf
			close(c)
		}
	}(f.isLegacy())
	return data, nil
}

// closeR safely sets the error on b if not already set.
func (b *Blocks) closeR(err error) {
	b.mu.Lock()
	if b.err == nil {
		b.err = err
	}
	b.mu.Unlock()
}

func NewFrameDataBlock(f *Frame) *FrameDataBlock {
	buf := f.Descriptor.Flags.BlockSizeIndex().Get()
	return &FrameDataBlock{Data: buf, data: buf}
}

type FrameDataBlock struct {
	Size     DataBlockSize
	Data     []byte // compressed or uncompressed data (.data or .src)
	Checksum uint32
	data     []byte // buffer for compressed data
	src      []byte // uncompressed data
	err      error  // used in concurrent mode
}

func (b *FrameDataBlock) Close(f *Frame) {
	b.Size = 0
	b.Checksum = 0
	b.err = nil
	if b.data != nil {
		// Block was not already closed.
		lz4block.Put(b.data)
		b.Data = nil
		b.data = nil
		b.src = nil
	}
}

// Block compression errors are ignored since the buffer is sized appropriately.
func (b *FrameDataBlock) Compress(f *Frame, src []byte, level lz4block.CompressionLevel) *FrameDataBlock {
	data := b.data
	if f.isLegacy() {
		data = data[:cap(data)]
	} else {
		data = data[:len(src)] // trigger the incompressible flag in CompressBlock
	}
	var n int
	switch level {
	case lz4block.Fast:
		n, _ = lz4block.CompressBlock(src, data)
	default:
		n, _ = lz4block.CompressBlockHC(src, data, level)
	}
	if n == 0 {
		b.Size.UncompressedSet(true)
		b.Data = src
	} else {
		b.Size.UncompressedSet(false)
		b.Data = data[:n]
	}
	b.Size.sizeSet(len(b.Data))
	b.src = src // keep track of the source for content checksum

	if f.Descriptor.Flags.BlockChecksum() {
		b.Checksum = xxh32.ChecksumZero(b.Data)
	}
	return b
}

func (b *FrameDataBlock) Write(f *Frame, dst io.Writer) error {
	// Write is called in the same order as blocks are compressed,
	// so content checksum must be done here.
	if f.Descriptor.Flags.ContentChecksum() {
		_, _ = f.checksum.Write(b.src)
	}
	buf := f.buf[:]
	binary.LittleEndian.PutUint32(buf, uint32(b.Size))
	if _, err := dst.Write(buf[:4]); err != nil {
		return err
	}

	if _, err := dst.Write(b.Data); err != nil {
		return err
	}

	if b.Checksum == 0 {
		return nil
	}
	binary.LittleEndian.PutUint32(buf, b.Checksum)
	_, err := dst.Write(buf[:4])
	return err
}

// Read updates b with the next block data, size and checksum if available.
func (b *FrameDataBlock) Read(f *Frame, src io.Reader, cum uint32) (uint32, error) {
	x, err := f.readUint32(src)
	if err != nil {
		return 0, err
	}
	if f.isLegacy() {
		switch x {
		case frameMagicLegacy:
			// Concatenated legacy frame.
			return b.Read(f, src, cum)
		case cum:
			// Only works in non concurrent mode, for concurrent mode
			// it is handled separately.
			// Linux kernel format appends the total uncompressed size at the end.
			return 0, io.EOF
		}
	} else if x == 0 {
		// Marker for end of stream.
		return 0, io.EOF
	}
	b.Size = DataBlockSize(x)

	size := b.Size.size()
	if size > cap(b.data) {
		return x, lz4errors.ErrOptionInvalidBlockSize
	}
	b.data = b.data[:size]
	if _, err := io.ReadFull(src, b.data); err != nil {
		return x, err
	}
	if f.Descriptor.Flags.BlockChecksum() {
		sum, err := f.readUint32(src)
		if err != nil {
			return 0, err
		}
		b.Checksum = sum
	}
	return x, nil
}

func (b *FrameDataBlock) Uncompress(f *Frame, dst, dict []byte, sum bool) ([]byte, error) {
	if b.Size.Uncompressed() {
		n := copy(dst, b.data)
		dst = dst[:n]
	} else {
		n, err := lz4block.UncompressBlock(b.data, dst, dict)
		if err != nil {
			return nil, err
		}
		dst = dst[:n]
	}
	if f.Descriptor.Flags.BlockChecksum() {
		if c := xxh32.ChecksumZero(b.data); c != b.Checksum {
			err := fmt.Errorf("%w: got %x; expected %x", lz4errors.ErrInvalidBlockChecksum, c, b.Checksum)
			return nil, err
		}
	}
	if sum && f.Descriptor.Flags.ContentChecksum() {
		_, _ = f.checksum.Write(dst)
	}
	return dst, nil
}

func (f *Frame) readUint32(r io.Reader) (x uint32, err error) {
	if _, err = io.ReadFull(r, f.buf[:4]); err != nil {
		return
	}
	x = binary.LittleEndian.Uint32(f.buf[:4])
	return
}
