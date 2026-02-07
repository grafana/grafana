// Copyright 2021 Dolthub, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package sql

import (
	"context"
	"errors"
	"sync"
)

var ErrCannotAddToClosedBackgroundThreads = errors.New("cannot add to a close background threads instance")

type BackgroundThreads struct {
	wg           *sync.WaitGroup
	mu           *sync.Mutex
	parentCtx    context.Context
	parentCancel context.CancelFunc
	nameToCancel map[string]context.CancelFunc
	nameToCtx    map[string]context.Context
}

func NewBackgroundThreads() *BackgroundThreads {
	ctx, cancel := context.WithCancel(context.Background())
	return &BackgroundThreads{
		wg:           &sync.WaitGroup{},
		parentCtx:    ctx,
		parentCancel: cancel,
		mu:           &sync.Mutex{},
		nameToCancel: make(map[string]context.CancelFunc),
		nameToCtx:    make(map[string]context.Context),
	}
}

// Add starts a background goroutine wrapped by a top-level sync.WaitGroup.
// [f] must return when its [ctx] argument is cancelled, otherwise
// Shutdown will hang.
func (bt *BackgroundThreads) Add(name string, f func(ctx context.Context)) error {
	select {
	case <-bt.parentCtx.Done():
		return ErrCannotAddToClosedBackgroundThreads
	default:
	}

	threadCtx, threadCancel := context.WithCancel(bt.parentCtx)

	bt.mu.Lock()
	defer bt.mu.Unlock()

	bt.nameToCancel[name] = threadCancel
	bt.nameToCtx[name] = threadCtx
	bt.wg.Add(1)

	go func() {
		defer bt.wg.Done()
		f(threadCtx)
	}()

	return nil
}

// Shutdown cancels the parent context for every async thread,
// and waits for each goroutine to drain and return before exiting.
func (bt *BackgroundThreads) Shutdown() error {
	bt.parentCancel()
	bt.wg.Wait()
	return bt.parentCtx.Err()
}
