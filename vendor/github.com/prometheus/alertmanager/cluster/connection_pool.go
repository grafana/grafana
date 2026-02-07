// Copyright 2020 Prometheus Team
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package cluster

import (
	"crypto/tls"
	"errors"
	"fmt"
	"sync"
	"time"

	lru "github.com/hashicorp/golang-lru/v2"
)

const capacity = 1024

type connectionPool struct {
	mtx       sync.Mutex
	cache     *lru.Cache[string, *tlsConn]
	tlsConfig *tls.Config
}

func newConnectionPool(tlsClientCfg *tls.Config) (*connectionPool, error) {
	cache, err := lru.NewWithEvict(
		capacity, func(_ string, conn *tlsConn) {
			conn.Close()
		},
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create new LRU: %w", err)
	}
	return &connectionPool{
		cache:     cache,
		tlsConfig: tlsClientCfg,
	}, nil
}

// borrowConnection returns a *tlsConn from the pool. The connection does not
// need to be returned to the pool because each connection has its own locking.
func (pool *connectionPool) borrowConnection(addr string, timeout time.Duration) (*tlsConn, error) {
	pool.mtx.Lock()
	defer pool.mtx.Unlock()
	if pool.cache == nil {
		return nil, errors.New("connection pool closed")
	}
	key := fmt.Sprintf("%s/%d", addr, int64(timeout))
	conn, exists := pool.cache.Get(key)
	if exists && conn.alive() {
		return conn, nil
	}
	conn, err := dialTLSConn(addr, timeout, pool.tlsConfig)
	if err != nil {
		return nil, err
	}
	pool.cache.Add(key, conn)
	return conn, nil
}

func (pool *connectionPool) shutdown() {
	pool.mtx.Lock()
	defer pool.mtx.Unlock()
	if pool.cache == nil {
		return
	}
	pool.cache.Purge()
	pool.cache = nil
}
