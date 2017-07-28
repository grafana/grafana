package trace

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"io"
	"strconv"
	"sync"
	"unsafe"
)

const (
	idSize  = aes.BlockSize / 2 // 64 bits
	keySize = aes.BlockSize     // 128 bits
)

var (
	ctr []byte
	n   int
	b   []byte
	c   cipher.Block
	m   sync.Mutex
)

func init() {
	buf := make([]byte, keySize+aes.BlockSize)
	_, err := io.ReadFull(rand.Reader, buf)
	if err != nil {
		// /dev/urandom had better work
		panic(err)
	}
	c, err = aes.NewCipher(buf[:keySize])
	if err != nil {
		// AES had better work
		panic(err)
	}
	n = aes.BlockSize
	ctr = buf[keySize:]
	b = make([]byte, aes.BlockSize)

	generateID = func() ID {
		m.Lock()
		if n == aes.BlockSize {
			c.Encrypt(b, ctr)
			// increment ctr
			for i := aes.BlockSize - 1; i >= 0; i-- {
				ctr[i]++
				if ctr[i] != 0 {
					break
				}
			}
			n = 0
		}
		// zero-copy b/c we're arch-neutral
		id := *(*ID)(unsafe.Pointer(&b[n]))
		n += idSize
		m.Unlock()
		return id
	}
}

type ID uint64

func (id ID) String() string {
	return strconv.FormatUint(uint64(id), 16)
}

var generateID = func() ID {
	return 0
}

// ParseID parses the given string as a hexadecimal string.
func ParseID(s string) (ID, error) {
	i, err := strconv.ParseUint(s, 16, 64)
	if err != nil {
		return 0, err
	}
	return ID(i), nil
}
