package iterator

import (
	"context"
	"fmt"
	"slices"

	"github.com/openfga/openfga/pkg/storage"
	"github.com/openfga/openfga/pkg/tuple"
)

type Msg struct {
	Iter storage.Iterator[string]
	Err  error
}

// Stream aggregates multiple iterators that are sent to a source channel into one iterator.
type Stream struct {
	idx            int
	buffer         storage.Iterator[string]
	sourceIsClosed bool // sourceIsClosed is set when the buffer is Done and all the source are exhausted
	source         chan *Msg
}

func NewStream(idx int, source chan *Msg) *Stream {
	return &Stream{
		idx:    idx,
		source: source,
	}
}

func (s *Stream) Idx() int {
	return s.idx
}

// Head returns the first item in the buffer.  If the Head is sourceIsClosed or
// cancelled, it will stop the buffer and set the buffer to nil.
func (s *Stream) Head(ctx context.Context) (string, error) {
	if s.buffer == nil {
		return "", storage.ErrIteratorDone
	}
	t, err := s.buffer.Head(ctx)
	if err != nil {
		if storage.IterIsDoneOrCancelled(err) {
			s.buffer.Stop()
			s.buffer = nil
		}
		return "", err
	}
	return t, nil
}

func (s *Stream) Next(ctx context.Context) (string, error) {
	if s.buffer == nil {
		return "", storage.ErrIteratorDone
	}
	t, err := s.buffer.Next(ctx)
	if err != nil {
		if storage.IterIsDoneOrCancelled(err) {
			s.buffer.Stop()
			s.buffer = nil
		}
		return "", err
	}
	return t, nil
}

func (s *Stream) Stop() {
	if s.buffer != nil {
		s.buffer.Stop()
	}
	for msg := range s.source {
		if msg.Iter != nil {
			msg.Iter.Stop()
		}
	}
}

// SkipToTargetObject moves the buffer until the buffer's head object is >= target object.
// If the buffer is drained and no more items, it will set to stop and buffer will be nil.
func (s *Stream) SkipToTargetObject(ctx context.Context, target string) error {
	if !tuple.IsValidObject(target) {
		return fmt.Errorf("invalid target object: %s", target)
	}

	t, err := s.Head(ctx)
	if err != nil {
		if storage.IterIsDoneOrCancelled(err) {
			return nil
		}
		return err
	}
	tmpKey := t
	for tmpKey < target {
		_, _ = s.Next(ctx)
		t, err = s.Head(ctx)
		if err != nil {
			if storage.IterIsDoneOrCancelled(err) {
				break
			}
			return err
		}
		tmpKey = t
	}
	return nil
}

// Drain all item in the stream's buffer and return these items.
func (s *Stream) Drain(ctx context.Context) ([]string, error) {
	var batch []string
	for {
		t, err := s.Next(ctx)
		if err != nil {
			if storage.IterIsDoneOrCancelled(err) {
				break
			}
			return nil, err
		}
		batch = append(batch, t)
	}
	return batch, nil
}

func (s *Stream) fetchSource(ctx context.Context) error {
	if s.buffer != nil || s.sourceIsClosed {
		// no need to poll further
		return nil
	}

	select {
	case <-ctx.Done():
		return ctx.Err()
	case i, ok := <-s.source:
		if !ok {
			s.sourceIsClosed = true
			break
		}
		if i.Err != nil {
			return i.Err
		}
		s.buffer = i.Iter
	}
	return nil
}

func (s *Stream) isDone() bool {
	return s.sourceIsClosed && s.buffer == nil
}

// NextItemInSliceStreams will advance all streamSlices specified in streamToProcess and return the item advanced.
// Assumption is that the stream slices first item is identical, and we want to advance all these streams.
func NextItemInSliceStreams(ctx context.Context, streamSlices []*Stream, streamToProcess []int) (string, error) {
	var item string
	var err error
	for _, iterIdx := range streamToProcess {
		item, err = streamSlices[iterIdx].Next(ctx)
		if err != nil {
			return "", err
		}
	}
	return item, nil
}

type Streams struct {
	streams []*Stream
}

func NewStreams(streams []*Stream) *Streams {
	return &Streams{
		streams: streams,
	}
}

// GetActiveStreamsCount will return the active streams from the last time CleanDone was called.
func (s *Streams) GetActiveStreamsCount() int {
	return len(s.streams)
}

// Stop will Drain all streams completely to avoid leaving dangling resources
// NOTE: caller should consider running this in a goroutine to not block.
func (s *Streams) Stop() {
	for _, stream := range s.streams {
		stream.Stop()
	}
}

// CleanDone will clean up the sourceIsClosed iterator streams and return a list of the remaining active streams.
// To be considered active your source channel must still be open.
func (s *Streams) CleanDone(ctx context.Context) ([]*Stream, error) {
	for _, stream := range s.streams {
		err := stream.fetchSource(ctx)
		if err != nil {
			return nil, err
		}
	}

	// clean up all empty entries that are both sourceIsClosed and drained
	s.streams = slices.DeleteFunc(s.streams, func(entry *Stream) bool {
		return entry.isDone()
	})
	return s.streams, nil
}
