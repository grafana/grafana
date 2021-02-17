// +build go1.7

package redisc

import (
	"context"

	"github.com/gomodule/redigo/redis"
)

// get connection from the pool.
// use GetContext if PoolWaitTime > 0
func (c *Cluster) getFromPool(p *redis.Pool) (redis.Conn, error) {
	if c.PoolWaitTime <= 0 {
		conn := p.Get()
		return conn, conn.Err()
	}

	ctx, cancel := context.WithTimeout(context.Background(), c.PoolWaitTime)
	defer cancel()

	return p.GetContext(ctx)
}
