package util

import (
	"context"
	"sync"
	"time"

	"github.com/grafana/dskit/services"
	"go.uber.org/atomic"
)

// ActiveUsers keeps track of latest user's activity timestamp,
// and allows purging users that are no longer active.
type ActiveUsers struct {
	mu         sync.RWMutex
	timestamps map[string]*atomic.Int64 // As long as unit used by Update and Purge is the same, it doesn't matter what it is.
}

func NewActiveUsers() *ActiveUsers {
	return &ActiveUsers{
		timestamps: map[string]*atomic.Int64{},
	}
}

func (m *ActiveUsers) UpdateUserTimestamp(userID string, ts int64) {
	m.mu.RLock()
	u := m.timestamps[userID]
	m.mu.RUnlock()

	if u != nil {
		u.Store(ts)
		return
	}

	// Pre-allocate new atomic to avoid doing allocation with lock held.
	newAtomic := atomic.NewInt64(ts)

	// We need RW lock to create new entry.
	m.mu.Lock()
	u = m.timestamps[userID]

	if u != nil {
		// Unlock first to reduce contention.
		m.mu.Unlock()

		u.Store(ts)
		return
	}

	m.timestamps[userID] = newAtomic
	m.mu.Unlock()
}

// PurgeInactiveUsers removes users that were last active before given deadline, and returns removed users.
func (m *ActiveUsers) PurgeInactiveUsers(deadline int64) []string {
	// Find inactive users with read-lock.
	m.mu.RLock()
	inactive := make([]string, 0, len(m.timestamps))

	for userID, ts := range m.timestamps {
		if ts.Load() <= deadline {
			inactive = append(inactive, userID)
		}
	}
	m.mu.RUnlock()

	if len(inactive) == 0 {
		return nil
	}

	// Cleanup inactive users.
	for ix := 0; ix < len(inactive); {
		userID := inactive[ix]
		deleted := false

		m.mu.Lock()
		u := m.timestamps[userID]
		if u != nil && u.Load() <= deadline {
			delete(m.timestamps, userID)
			deleted = true
		}
		m.mu.Unlock()

		if deleted {
			// keep it in the output
			ix++
		} else {
			// not really inactive, remove it from output
			inactive = append(inactive[:ix], inactive[ix+1:]...)
		}
	}

	return inactive
}

// ActiveUsersCleanupService tracks active users, and periodically purges inactive ones while running.
type ActiveUsersCleanupService struct {
	services.Service

	activeUsers     *ActiveUsers
	cleanupFunc     func(string)
	inactiveTimeout time.Duration
}

func NewActiveUsersCleanupWithDefaultValues(cleanupFn func(string)) *ActiveUsersCleanupService {
	return NewActiveUsersCleanupService(3*time.Minute, 15*time.Minute, cleanupFn)
}

func NewActiveUsersCleanupService(cleanupInterval, inactiveTimeout time.Duration, cleanupFn func(string)) *ActiveUsersCleanupService {
	s := &ActiveUsersCleanupService{
		activeUsers:     NewActiveUsers(),
		cleanupFunc:     cleanupFn,
		inactiveTimeout: inactiveTimeout,
	}

	s.Service = services.NewTimerService(cleanupInterval, nil, s.iteration, nil).WithName("active users cleanup")
	return s
}

func (s *ActiveUsersCleanupService) UpdateUserTimestamp(user string, now time.Time) {
	s.activeUsers.UpdateUserTimestamp(user, now.UnixNano())
}

func (s *ActiveUsersCleanupService) iteration(_ context.Context) error {
	inactiveUsers := s.activeUsers.PurgeInactiveUsers(time.Now().Add(-s.inactiveTimeout).UnixNano())
	for _, userID := range inactiveUsers {
		s.cleanupFunc(userID)
	}
	return nil
}
