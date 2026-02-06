// +build go1.10

package sqlhooks

import (
	"context"
	"database/sql/driver"
)

func isSessionResetter(conn driver.Conn) bool {
	_, ok := conn.(driver.SessionResetter)
	return ok
}

func (s *SessionResetter) ResetSession(ctx context.Context) error {
	c := s.Conn.Conn.(driver.SessionResetter)
	return c.ResetSession(ctx)
}
