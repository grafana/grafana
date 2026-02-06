package nowtime

import (
	"time"
)

// Getter to get current time.
type Getter func() time.Time

var _ Getter = Get

// Get returns time.Now().
func Get() time.Time {
	return time.Now()
}
