package file

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/mithrandie/go-file/v2"
)

type ControlFileType int

const (
	RLock ControlFileType = iota
	Lock
	Temporary
)

var controlFileTypeLit = map[ControlFileType]string{
	RLock:     "read lock",
	Lock:      "lock",
	Temporary: "temporary",
}

func (t ControlFileType) String() string {
	return controlFileTypeLit[t]
}

type ControlFile struct {
	path string
	fp   *os.File
}

func NewControlFile(path string, fp *os.File) *ControlFile {
	return &ControlFile{
		path: path,
		fp:   fp,
	}
}

func (m *ControlFile) Close() error {
	if m != nil {
		if m.fp != nil {
			if err := file.Close(m.fp); err != nil {
				return err
			}
		}

		if Exists(m.path) {
			if err := os.Remove(m.path); err != nil {
				return err
			}
		}
	}
	return nil
}

func (m *ControlFile) CloseWithErrors() []error {
	var errs []error
	if m != nil {
		if m.fp != nil {
			if err := file.Close(m.fp); err != nil {
				errs = append(errs, err)
			}
		}

		if Exists(m.path) {
			if err := os.Remove(m.path); err != nil {
				errs = append(errs, err)
			}
		}
	}
	return errs
}

func CreateControlFileContext(ctx context.Context, filePath string, fileType ControlFileType, retryDelay time.Duration) (*ControlFile, error) {
	if ctx.Err() != nil {
		if ctx.Err() == context.Canceled {
			return nil, NewContextCanceled()
		}
		return nil, NewContextDone(ctx.Err().Error())
	}

	for {
		f, err := tryCreateControlFile(filePath, fileType)
		if err == nil {
			return f, nil
		}
		if _, ok := err.(*LockError); !ok {
			return nil, err
		}

		select {
		case <-ctx.Done():
			if ctx.Err() == context.Canceled {
				return nil, NewContextCanceled()
			}
			return nil, NewTimeoutError(filePath)
		case <-time.After(retryDelay):
			// try again
		}
	}
}

func tryCreateControlFile(filePath string, fileType ControlFileType) (*ControlFile, error) {
	if len(filePath) < 1 {
		return nil, NewLockError("filename not specified")
	}

	switch fileType {
	case Lock:
		return TryCreateLockFile(filePath)
	case Temporary:
		return TryCreateTempFile(filePath)
	default: //RLock
		return TryCreateRLockFile(filePath)
	}
}

func TryCreateRLockFile(filePath string) (controlFile *ControlFile, err error) {
	if LockExists(filePath) {
		return nil, NewLockError(fmt.Sprintf("failed to create %s file for %q", RLock, filePath))
	}

	lockFilePath := LockFilePath(filePath)
	lfp, err := file.Create(lockFilePath)
	if err != nil {
		return nil, NewLockError(fmt.Sprintf("failed to create %s file for %q", RLock, filePath))
	}
	lockFile := NewControlFile(lockFilePath, lfp)
	defer func() {
		err = NewCompositeError(err, lockFile.Close())
	}()

	rlockFilePath := RLockFilePath(filePath)
	fp, e := file.Create(rlockFilePath)
	if e != nil {
		return nil, NewLockError(fmt.Sprintf("failed to create %s file for %q", RLock, filePath))
	}

	return NewControlFile(rlockFilePath, fp), nil
}

func TryCreateLockFile(filePath string) (*ControlFile, error) {
	if LockExists(filePath) || RLockExists(filePath) {
		return nil, NewLockError(fmt.Sprintf("failed to create %s file for %q", Lock, filePath))
	}

	lockFilePath := LockFilePath(filePath)
	fp, err := file.Create(lockFilePath)
	if err != nil {
		return nil, NewLockError(fmt.Sprintf("failed to create %s file for %q", Lock, filePath))
	}
	lockFile := NewControlFile(lockFilePath, fp)

	if RLockExists(filePath) {
		err := NewLockError(fmt.Sprintf("failed to create %s file for %q", Lock, filePath))
		err = NewCompositeError(err, lockFile.Close())
		return nil, err
	}

	return lockFile, nil
}

func TryCreateTempFile(filePath string) (*ControlFile, error) {
	tempFilePath := TempFilePath(filePath)
	fp, err := file.Create(tempFilePath)
	if err != nil {
		return nil, NewLockError(fmt.Sprintf("failed to create %s file for %q", Temporary, filePath))
	}

	return NewControlFile(tempFilePath, fp), nil
}
