// +build js

package testing

import (
	"bytes"
	"io"
	"os"
	"strconv"
	"sync"
	"time"
)

var rand uint32
var randmu sync.Mutex

func reseed() uint32 {
	return uint32(time.Now().UnixNano() + int64(os.Getpid()))
}

func nextSuffix() string {
	randmu.Lock()
	r := rand
	if r == 0 {
		r = reseed()
	}
	r = r*1664525 + 1013904223 // constants from Numerical Recipes
	rand = r
	randmu.Unlock()
	return strconv.Itoa(int(1e9 + r%1e9))[1:]
}

// A functional copy of ioutil.TempFile, to avoid extra imports.
func tempFile(prefix string) (f *os.File, err error) {
	dir := os.TempDir()

	nconflict := 0
	for i := 0; i < 10000; i++ {
		name := dir + string(os.PathSeparator) + prefix + nextSuffix()
		f, err = os.OpenFile(name, os.O_RDWR|os.O_CREATE|os.O_EXCL, 0600)
		if os.IsExist(err) {
			if nconflict++; nconflict > 10 {
				randmu.Lock()
				rand = reseed()
				randmu.Unlock()
			}
			continue
		}
		break
	}
	return
}

func readFile(filename string) (string, error) {
	f, err := os.Open(filename)
	if err != nil {
		return "", err
	}
	defer f.Close()
	var buf bytes.Buffer
	_, err = io.Copy(&buf, f)
	if err != nil {
		return "", err
	}
	return buf.String(), nil
}
