package seed

import (
	crand "crypto/rand"
	"fmt"
	"math"
	"math/big"
	"math/rand"
	"sync"
	"sync/atomic"
	"time"
)

var (
	m      sync.Mutex
	secure int32
	seeded int32
)

func cryptoSeed() error {
	defer atomic.StoreInt32(&seeded, 1)

	var err error
	var n *big.Int
	n, err = crand.Int(crand.Reader, big.NewInt(math.MaxInt64))
	if err != nil {
		rand.Seed(time.Now().UTC().UnixNano())
		return err
	}
	rand.Seed(n.Int64())
	atomic.StoreInt32(&secure, 1)
	return nil
}

// Init provides best-effort seeding (which is better than running with Go's
// default seed of 1).  If `/dev/urandom` is available, Init() will seed Go's
// runtime with entropy from `/dev/urandom` and return true because the runtime
// was securely seeded.  If Init() has already initialized the random number or
// it had failed to securely initialize the random number generation, Init()
// will return false.  See MustInit().
func Init() (seededSecurely bool, err error) {
	if atomic.LoadInt32(&seeded) == 1 {
		return false, nil
	}

	// Slow-path
	m.Lock()
	defer m.Unlock()

	if err := cryptoSeed(); err != nil {
		return false, err
	}

	return true, nil
}

// MustInit provides guaranteed secure seeding.  If `/dev/urandom` is not
// available, MustInit will panic() with an error indicating why reading from
// `/dev/urandom` failed.  MustInit() will upgrade the seed if for some reason a
// call to Init() failed in the past.
func MustInit() {
	if atomic.LoadInt32(&secure) == 1 {
		return
	}

	// Slow-path
	m.Lock()
	defer m.Unlock()

	if err := cryptoSeed(); err != nil {
		panic(fmt.Sprintf("Unable to seed the random number generator: %v", err))
	}
}

// Secure returns true if a cryptographically secure seed was used to
// initialize rand.
func Secure() bool {
	return atomic.LoadInt32(&secure) == 1
}

// Seeded returns true if Init has seeded the random number generator.
func Seeded() bool {
	return atomic.LoadInt32(&seeded) == 1
}
