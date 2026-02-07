package iterator

import (
	"context"
	"sync"

	"github.com/openfga/openfga/internal/concurrency"
)

func Drain(ch <-chan *Msg) *sync.WaitGroup {
	wg := &sync.WaitGroup{}
	wg.Add(1)
	go func() {
		for msg := range ch {
			if msg.Iter != nil {
				msg.Iter.Stop()
			}
		}
		wg.Done()
	}()
	return wg
}

func FanInIteratorChannels(ctx context.Context, chans []<-chan *Msg) <-chan *Msg {
	limit := len(chans)

	out := make(chan *Msg, limit)

	if limit == 0 {
		close(out)
		return out
	}

	pool := concurrency.NewPool(ctx, limit)

	for _, c := range chans {
		pool.Go(func(ctx context.Context) error {
			for v := range c {
				if !concurrency.TrySendThroughChannel(ctx, v, out) {
					if v.Iter != nil {
						v.Iter.Stop()
					}
				}
			}
			return nil
		})
	}

	go func() {
		// NOTE: the consumer of this channel will block waiting for it to close
		_ = pool.Wait()
		close(out)
	}()

	return out
}
