package mssql

import "time"

func getTimezone(c *Conn) *time.Location {
	if c != nil && c.sess != nil {
		return c.sess.encoding.GetTimezone()
	}
	return time.UTC
}
