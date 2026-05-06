//go:build go1.15
// +build go1.15

package pq

import "database/sql/driver"

var _ driver.Validator = &conn{}
