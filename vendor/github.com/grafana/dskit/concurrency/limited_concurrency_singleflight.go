package concurrency

import (
	"context"
	"sync"

	"github.com/grafana/dskit/multierror"
)

// LimitedConcurrencySingleFlight ensures that across all concurrent calls to ForEachNotInFlight, only up to maxConcurrent
// tokens are running concurrently. See the docs of ForEachNotInFlight for the uniqueness semantics of tokens.
//
// An example use case for LimitedConcurrencySingleFlight is to run a periodic job concurrently for N users. Sometimes a single user's
// job may take longer than the period. And this will block future scheduled jobs until the first job for that user completes.
// Call LimitedConcurrencySingleFlight.ForEachNotInFlight in its own goroutine with user IDs as tokens.
// This will run the jobs concurrently and make sure that two jobs for the same user don't run concurrently.
type LimitedConcurrencySingleFlight struct {
	inflightTokensMx sync.Mutex
	inflightTokens   map[string]struct{}
	inflightCalls    sync.WaitGroup
	semaphore        chan struct{}
}

func NewLimitedConcurrencySingleFlight(maxConcurrent int) *LimitedConcurrencySingleFlight {
	return &LimitedConcurrencySingleFlight{
		inflightTokensMx: sync.Mutex{},
		inflightTokens:   make(map[string]struct{}),
		inflightCalls:    sync.WaitGroup{},
		semaphore:        make(chan struct{}, maxConcurrent),
	}
}

// Wait returns when there are no in-flight calls to ForEachNotInFlight.
func (w *LimitedConcurrencySingleFlight) Wait() {
	w.inflightCalls.Wait()
}

// ForEachNotInFlight invokes f for every token in tokens that is not in-flight (not still being executed) in a different
// concurrent call to ForEachNotInFlight. ForEachNotInFlight returns when invocations to f for all such tokens have
// returned. Upon context cancellation ForEachNotInFlight stops making new invocations of f for tokens and waits for all
// already started invocations of f to return. ForEachNotInFlight returns the combined errors from all f invocations.
func (w *LimitedConcurrencySingleFlight) ForEachNotInFlight(ctx context.Context, tokens []string, f func(context.Context, string) error) error {
	w.inflightCalls.Add(1)
	defer w.inflightCalls.Done()

	var (
		errs              multierror.MultiError
		errsMx            sync.Mutex
		workers           sync.WaitGroup
		tokensNotInFlight = w.tokensNotInFlight(tokens)
	)

	for _, token := range tokensNotInFlight {
		select {
		case <-ctx.Done():
			w.tokenProcessed(token)
			continue
		case w.semaphore <- struct{}{}:
		}
		select {
		case <-ctx.Done():
			w.tokenProcessed(token)
			<-w.semaphore
			continue
		default:
		}

		workers.Add(1)
		go func(token string) {
			if err := f(ctx, token); err != nil {
				errsMx.Lock()
				errs.Add(err)
				errsMx.Unlock()
			}

			w.tokenProcessed(token)

			<-w.semaphore
			workers.Done()
		}(token)
	}

	workers.Wait()
	return errs.Err()
}

func (w *LimitedConcurrencySingleFlight) tokensNotInFlight(tokens []string) []string {
	notInflightTokens := make([]string, 0, len(tokens))
	w.inflightTokensMx.Lock()
	for _, token := range tokens {
		if _, ok := w.inflightTokens[token]; ok {
			continue
		}
		notInflightTokens = append(notInflightTokens, token)
		w.inflightTokens[token] = struct{}{}
	}
	w.inflightTokensMx.Unlock()
	return notInflightTokens
}

func (w *LimitedConcurrencySingleFlight) tokenProcessed(t string) {
	w.inflightTokensMx.Lock()
	delete(w.inflightTokens, t)
	w.inflightTokensMx.Unlock()
}
