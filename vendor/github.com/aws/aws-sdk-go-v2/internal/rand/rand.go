package rand

import (
	"crypto/rand"
	"fmt"
	"io"
	"math/big"
)

func init() {
	Reader = rand.Reader
}

// Reader provides a random reader that can reset during testing.
var Reader io.Reader

var floatMaxBigInt = big.NewInt(1 << 53)

// Float64 returns a float64 read from an io.Reader source. The returned float will be between [0.0, 1.0).
func Float64(reader io.Reader) (float64, error) {
	bi, err := rand.Int(reader, floatMaxBigInt)
	if err != nil {
		return 0, fmt.Errorf("failed to read random value, %v", err)
	}

	return float64(bi.Int64()) / (1 << 53), nil
}

// CryptoRandFloat64 returns a random float64 obtained from the crypto rand
// source.
func CryptoRandFloat64() (float64, error) {
	return Float64(Reader)
}
