// Copyright 2020-2021 Dolthub, Inc.
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
	"sync"
	"sync/atomic"
	"time"
	"unsafe"

	"gopkg.in/src-d/go-errors.v1"
)

// ErrLockTimeout is the kind of error returned when acquiring a lock takes longer than the user specified timeout
var ErrLockTimeout = errors.NewKind("Timeout acquiring lock '%s'.")

// ErrLockDoesNotExist is the kind of error returned when a named lock does not exist and the operation does not created it
var ErrLockDoesNotExist = errors.NewKind("Lock '%s' does not exist.")

// ErrLockNotOwned is the kind of error returned when attempting an operation against a lock that the given context does not own.
var ErrLockNotOwned = errors.NewKind("Operation '%s' failed as the lock '%s' has a different owner.")

type ownedLock struct {
	Owner int64
	Count int64
}

// LockSubsystem manages reentrant named locks
type LockSubsystem struct {
	lockLock *sync.RWMutex
	locks    map[string]**ownedLock
}

// NewLockSubsystem creates a LockSubsystem object
func NewLockSubsystem() *LockSubsystem {
	return &LockSubsystem{&sync.RWMutex{}, make(map[string]**ownedLock)}
}

func (ls *LockSubsystem) getNamedLock(name string) **ownedLock {
	ls.lockLock.RLock()
	defer ls.lockLock.RUnlock()

	return ls.locks[name]
}

func (ls *LockSubsystem) createLock(name string) **ownedLock {
	ls.lockLock.Lock()
	defer ls.lockLock.Unlock()

	nl, ok := ls.locks[name]

	if !ok {
		newLock := &ownedLock{}
		ls.locks[name] = &newLock
		nl = &newLock
	}

	return nl
}

// Lock attempts to acquire a lock with a given name for the Id associated with the given ctx.Session within the given
// timeout
func (ls *LockSubsystem) Lock(ctx *Context, name string, timeout time.Duration) error {
	nl := ls.getNamedLock(name)

	if nl == nil {
		nl = ls.createLock(name)
	}

	userId := int64(ctx.Session.ID())
	for i, start := 0, time.Now(); i == 0 || timeout < 0 || time.Since(start) < timeout; i++ {
		dest := (*unsafe.Pointer)(unsafe.Pointer(nl))
		curr := atomic.LoadPointer(dest)
		currLock := *(*ownedLock)(curr)

		if currLock.Owner == 0 {
			newVal := &ownedLock{userId, 1}
			if atomic.CompareAndSwapPointer(dest, curr, unsafe.Pointer(newVal)) {
				return ctx.Session.AddLock(name)
			}
		} else if currLock.Owner == userId {
			newVal := &ownedLock{userId, currLock.Count + 1}
			if atomic.CompareAndSwapPointer(dest, curr, unsafe.Pointer(newVal)) {
				return nil
			}
		}

		time.Sleep(100 * time.Microsecond)
	}

	return ErrLockTimeout.New(name)
}

// Unlock releases a lock with a given name for the ID associated with the given ctx.Session
func (ls *LockSubsystem) Unlock(ctx *Context, name string) error {
	nl := ls.getNamedLock(name)

	if nl == nil {
		return ErrLockDoesNotExist.New(name)
	}

	userId := int64(ctx.Session.ID())
	for {
		dest := (*unsafe.Pointer)(unsafe.Pointer(nl))
		curr := atomic.LoadPointer(dest)
		currLock := *(*ownedLock)(curr)

		if currLock.Owner != userId {
			return ErrLockNotOwned.New("unlock", name)
		}

		newVal := &ownedLock{}
		if currLock.Count > 1 {
			newVal = &ownedLock{userId, currLock.Count - 1}
		}

		if atomic.CompareAndSwapPointer(dest, curr, unsafe.Pointer(newVal)) {
			if newVal.Count == 0 {
				return ctx.Session.DelLock(name)
			}

			return nil
		}
	}
}

// ReleaseAll releases all locks the ID associated with the given ctx.Session, and returns the number of locks that were
// succeessfully released.
func (ls *LockSubsystem) ReleaseAll(ctx *Context) (int, error) {
	releaseCount := 0
	_ = ctx.Session.IterLocks(func(name string) error {
		nl := ls.getNamedLock(name)

		if nl != nil {
			userId := ctx.Session.ID()
			for {
				dest := (*unsafe.Pointer)(unsafe.Pointer(nl))
				curr := atomic.LoadPointer(dest)
				currLock := *(*ownedLock)(curr)

				if currLock.Owner != int64(userId) {
					break
				}

				if atomic.CompareAndSwapPointer(dest, curr, unsafe.Pointer(&ownedLock{})) {
					releaseCount++
					break
				}
			}
		}

		return nil
	})

	return releaseCount, nil
}

// LockState represents the different states a lock can be in
type LockState int

const (
	// LockDoesNotExist is the state where a lock has never been created
	LockDoesNotExist LockState = iota
	// LockInUse is the state where a lock has been acquired by a user
	LockInUse
	// LockFree is the state where a lock has been created, but is not currently owned by any user
	LockFree
)

// GetLockState returns the LockState and owner ID for a lock with a given name.
func (ls *LockSubsystem) GetLockState(name string) (state LockState, owner uint32) {
	nl := ls.getNamedLock(name)

	if nl == nil {
		return LockDoesNotExist, 0
	}

	dest := (*unsafe.Pointer)(unsafe.Pointer(nl))
	curr := atomic.LoadPointer(dest)
	currLock := *(*ownedLock)(curr)

	if currLock.Owner == 0 {
		return LockFree, 0
	} else {
		return LockInUse, uint32(currLock.Owner)
	}
}
