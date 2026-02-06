package file

import (
	"context"
	"math/rand"
	"os"
	"path/filepath"
	"sync"
	"time"
)

const rlockFileSuffixLen = 12

var dummyCancelFunc = func() {}

var (
	letterRunes    = []rune("1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ")
	randForLock    *rand.Rand
	getRandForLock sync.Once
)

func randStrForLock() *rand.Rand {
	getRandForLock.Do(func() {
		randForLock = rand.New(rand.NewSource(time.Now().UnixNano()))
	})
	return randForLock
}

func RandomString(length int) string {
	r := make([]rune, length)
	for i := 0; i < length; i++ {
		r[i] = letterRunes[randStrForLock().Intn(len(letterRunes))]
	}
	return string(r)
}

func rlockFileSuffix() string {
	return "." + RandomString(rlockFileSuffixLen) + RLockFileSuffix
}

func GetTimeoutContext(ctx context.Context, waitTimeOut time.Duration) (context.Context, context.CancelFunc) {
	if ctx.Err() != nil {
		return ctx, dummyCancelFunc
	}
	if _, ok := ctx.Deadline(); ok {
		return ctx, dummyCancelFunc
	}

	return context.WithTimeout(ctx, waitTimeOut)
}

func RLockFilePath(path string) string {
	var fpath string
	for i := 0; i < 10; i++ {
		fpath = getFilePath(path, rlockFileSuffix())
		if !Exists(fpath) {
			break
		}
	}
	return fpath
}

func LockFilePath(path string) string {
	return getFilePath(path, LockFileSuffix)
}

func TempFilePath(path string) string {
	return getFilePath(path, TempFileSuffix)
}

func getFilePath(path string, suffix string) string {
	dir := filepath.Dir(path)
	basename := filepath.Base(path)
	return filepath.Join(dir, "."+basename+suffix)
}

func RLockExists(path string) bool {
	dir := filepath.Dir(path)
	basename := filepath.Base(path)
	match, _ := filepath.Glob(filepath.Join(dir, "."+basename) + ".*" + RLockFileSuffix)
	return match != nil
}

func LockExists(path string) bool {
	return Exists(LockFilePath(path))
}

func Exists(path string) bool {
	if _, err := os.Stat(path); err == nil {
		return true
	}
	return false
}
