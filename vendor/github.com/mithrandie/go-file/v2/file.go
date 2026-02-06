package file

import (
	"context"
	"os"
	"time"
)

// Opens the file with shared lock. This function is the same as Open(path, os.O_RDONLY, RLock)
func OpenToRead(path string) (*os.File, error) {
	return Open(path, os.O_RDONLY, RLock)
}

// Tries to lock and opens the file with shared lock. This function is the same as Open(path, os.O_RDONLY, TryRLock)
func TryOpenToRead(path string) (*os.File, error) {
	return Open(path, os.O_RDONLY, TryRLock)
}

// Opens the file with exclusive lock. This function is the same as Open(path, os.O_RDWR, Lock)
func OpenToUpdate(path string) (*os.File, error) {
	return Open(path, os.O_RDWR, Lock)
}

// Tries to lock and opens the file with exclusive lock. This function is the same as Open(path, os.O_RDWR, TryLock)
func TryOpenToUpdate(path string) (*os.File, error) {
	return Open(path, os.O_RDWR, TryLock)
}

// Opens the file with exclusive locking. This function is the same as Open(path, os.O_CREATE|os.O_EXCL|os.O_RDWR, TryLock)
func Create(path string) (*os.File, error) {
	return Open(path, os.O_CREATE|os.O_EXCL|os.O_RDWR, TryLock)
}

// Opens the file with shared lock. If the file is already locked, tries to lock repeatedly until the conditions is met. This function is the same as OpenContext(ctx, retryDelay, path, RLockContext)
func OpenToReadContext(ctx context.Context, retryDelay time.Duration, path string) (*os.File, error) {
	return OpenContext(ctx, retryDelay, path, os.O_RDONLY, RLockContext)
}

// Opens the file with exclusive lock. If the file is already locked, tries to lock repeatedly until the conditions is met. This function is the same as OpenContext(ctx, retryDelay, path, LockContext)
func OpenToUpdateContext(ctx context.Context, retryDelay time.Duration, path string) (*os.File, error) {
	return OpenContext(ctx, retryDelay, path, os.O_RDWR, LockContext)
}

// Opens the file with passed locking function.
func Open(path string, flag int, fn func(*os.File) error) (*os.File, error) {
	fp, err := openFile(path, flag)
	if err != nil {
		return nil, err
	}

	err = lock(fp, fn)

	if err != nil {
		_ = fp.Close()
	}
	return fp, err
}

// Opens the file with passed locking function. If failed, try to lock repeatedly until the conditions is met.
func OpenContext(ctx context.Context, retryDelay time.Duration, path string, flag int, fn func(context.Context, time.Duration, *os.File) error) (*os.File, error) {
	fp, err := openFile(path, flag)
	if err != nil {
		return nil, err
	}

	err = fn(ctx, retryDelay, fp)

	if err != nil {
		_ = fp.Close()
	}
	return fp, err
}

func openFile(path string, flag int) (*os.File, error) {
	var perm os.FileMode = 0600
	if flag == os.O_RDONLY {
		perm = 0400
	}
	fp, err := os.OpenFile(path, flag, perm)
	if err != nil {
		return nil, NewIOError(err.Error())
	}
	return fp, nil
}

// Places the exclusive lock on the file. If the file is already locked, waits until the file is released.
func Lock(fp *os.File) error {
	return lock(fp, LockEX)
}

// Places the shared lock on the file. If the file is already locked, waits until the file is released.
func RLock(fp *os.File) error {
	return lock(fp, LockSH)
}

// Places the exclusive lock on the file. If the file is already locked, returns an error immediately.
func TryLock(fp *os.File) error {
	return lock(fp, TryLockEX)
}

// Places the shared lock on the file. If the file is already locked, returns an error immediately.
func TryRLock(fp *os.File) error {
	return lock(fp, TryLockSH)
}

func lock(fp *os.File, fn func(*os.File) error) error {
	if err := fn(fp); err != nil {
		return NewLockError(err.Error())
	}
	return nil
}

// Places the exclusive lock on the file. If the file is already locked, tries to lock repeatedly until the conditions is met.
func LockContext(ctx context.Context, retryDelay time.Duration, fp *os.File) error {
	return lockContext(ctx, retryDelay, fp, TryLock)
}

// Places the shared lock on the file. If the file is already locked, tries to lock repeatedly until the conditions is met.
func RLockContext(ctx context.Context, retryDelay time.Duration, fp *os.File) error {
	return lockContext(ctx, retryDelay, fp, TryRLock)
}

func lockContext(ctx context.Context, retryDelay time.Duration, fp *os.File, fn func(*os.File) error) error {
	if ctx.Err() != nil {
		if ctx.Err() == context.Canceled {
			return NewContextCanceled(ctx.Err().Error())
		}
		return NewContextDone(ctx.Err().Error())
	}

	for {
		if err := fn(fp); err == nil {
			return nil
		}

		select {
		case <-ctx.Done():
			if ctx.Err() == context.Canceled {
				return NewContextCanceled(ctx.Err().Error())
			}
			return NewTimeoutError(fp.Name())
		case <-time.After(retryDelay):
			// try again
		}
	}
}

// Unlocks and closes the file
func Close(fp *os.File) (err error) {
	defer func() { _ = fp.Close() }()

	if err = Unlock(fp); err != nil {
		return NewLockError(err.Error())
	}
	return nil
}
