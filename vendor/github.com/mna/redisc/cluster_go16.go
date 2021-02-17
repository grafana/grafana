// +build !go1.7

package redisc

import (
	"github.com/gomodule/redigo/redis"
)

// get connection from the pool
// pre go1.7, Pool has no GetContext method, so it always
// calls Get.
func (c *Cluster) getFromPool(p *redis.Pool) (redis.Conn, error) {
	conn := p.Get()
	return conn, conn.Err()
}
