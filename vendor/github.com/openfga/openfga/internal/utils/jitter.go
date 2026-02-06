package utils

import (
	"math/rand"
	"time"
)

func JitterDuration(baseDuration, maxJitter time.Duration) time.Duration {
	if maxJitter <= 0 {
		return baseDuration
	}
	jitter := time.Duration(rand.Int63n(int64(maxJitter)))
	return baseDuration + jitter
}
