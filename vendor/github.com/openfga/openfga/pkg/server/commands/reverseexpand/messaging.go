package reverseexpand

import (
	"context"
	"iter"
	"sync"
)

type message[T any] struct {
	Value  T
	finite func()
}

func (m *message[T]) done() {
	if m.finite != nil {
		m.finite()
	}
}

type producer[T any] interface {
	recv(context.Context) (message[T], bool)
	seq(context.Context) iter.Seq[message[T]]
}

type consumer[T any] interface {
	send(T)
	close()
	cancel()
}

const maxPipeSize int = 100

type pipe struct {
	data   [maxPipeSize]group
	head   int
	tail   int
	count  int
	done   bool
	mu     sync.Mutex
	full   *sync.Cond
	empty  *sync.Cond
	closed *sync.Cond
	trk    tracker
}

func newPipe(trk tracker) *pipe {
	p := pipe{
		trk: trk,
	}

	p.full = sync.NewCond(&p.mu)
	p.empty = sync.NewCond(&p.mu)
	p.closed = sync.NewCond(&p.mu)

	return &p
}

func (p *pipe) seq(ctx context.Context) iter.Seq[message[group]] {
	return func(yield func(message[group]) bool) {
		defer p.cancel()

		for {
			msg, ok := p.recv(ctx)
			if !ok {
				break
			}

			if !yield(msg) {
				break
			}
		}
	}
}

func (p *pipe) send(item group) {
	p.mu.Lock()
	defer p.mu.Unlock()

	if p.done {
		return
	}

	p.trk.Add(1)

	// Wait if the buffer is full.
	for p.count == maxPipeSize && !p.done {
		p.full.Wait()
	}

	if p.done {
		p.trk.Add(-1)
		return
	}

	p.data[p.head] = item
	p.head = (p.head + 1) % maxPipeSize
	p.count++

	// Signal that the buffer is no longer empty.
	p.empty.Signal()
}

func (p *pipe) recv(ctx context.Context) (message[group], bool) {
	p.mu.Lock()

	// Wait while the buffer is empty and the pipe is not yet done.
	for p.count == 0 && !p.done && ctx.Err() == nil {
		p.empty.Wait()
	}

	if (p.count == 0 && p.done) || ctx.Err() != nil {
		p.mu.Unlock()
		return message[group]{}, false
	}

	item := p.data[p.tail]
	p.tail = (p.tail + 1) % maxPipeSize
	p.count--

	// Signal that the buffer is no longer full.
	p.full.Signal()

	if p.count == 0 {
		p.closed.Broadcast()
	}

	p.mu.Unlock()

	fn := func() {
		p.trk.Add(-1)
	}
	return message[group]{Value: item, finite: sync.OnceFunc(fn)}, true
}

func (p *pipe) close() {
	p.mu.Lock()
	defer p.mu.Unlock()

	p.done = true

	p.empty.Broadcast()
	p.full.Broadcast()

	for p.count > 0 {
		p.closed.Wait()
	}
}

func (p *pipe) cancel() {
	p.mu.Lock()

	if p.done {
		p.mu.Unlock()
		return
	}

	p.done = true

	p.empty.Broadcast()
	p.full.Broadcast()

	p.mu.Unlock()

	m, ok := p.recv(context.Background())

	for ok {
		m.done()
		m, ok = p.recv(context.Background())
	}
}

type staticProducer struct {
	mu     sync.Mutex
	groups []group
	pos    int
	trk    tracker
}

func (p *staticProducer) recv(ctx context.Context) (message[group], bool) {
	p.mu.Lock()
	defer p.mu.Unlock()

	if ctx.Err() != nil {
		return message[group]{}, false
	}

	if p.pos == len(p.groups) {
		return message[group]{}, false
	}

	value := p.groups[p.pos]
	p.pos++

	fn := func() {
		p.trk.Add(-1)
	}

	return message[group]{Value: value, finite: sync.OnceFunc(fn)}, true
}

func (p *staticProducer) close() {
	p.mu.Lock()
	defer p.mu.Unlock()

	p.pos = len(p.groups)
}

func (p *staticProducer) seq(ctx context.Context) iter.Seq[message[group]] {
	return func(yield func(message[group]) bool) {
		defer p.close()

		for {
			msg, ok := p.recv(ctx)
			if !ok {
				break
			}

			if !yield(msg) {
				break
			}
		}
	}
}

func newStaticProducer(trk tracker, groups ...group) producer[group] {
	if trk != nil {
		trk.Add(int64(len(groups)))
	}

	return &staticProducer{
		groups: groups,
		trk:    trk,
	}
}
