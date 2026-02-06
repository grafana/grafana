package file

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/mithrandie/go-file/v2"
)

type OpenType int

const (
	ForRead OpenType = iota
	ForCreate
	ForUpdate
)

type Handler struct {
	path string
	fp   *os.File

	openType OpenType

	rlockFile *ControlFile
	lockFile  *ControlFile
	tempFile  *ControlFile

	closed bool
}

func NewHandlerWithoutLock(ctx context.Context, path string, defaultWaitTimeout time.Duration, retryDelay time.Duration) (*Handler, error) {
	tctx, cancel := GetTimeoutContext(ctx, defaultWaitTimeout)
	defer cancel()

	h := &Handler{
		path:     path,
		openType: ForRead,
	}

	if !Exists(h.path) {
		return h, NewNotExistError(fmt.Sprintf("file %s does not exist", h.path))
	}

	fp, err := file.OpenToReadContext(tctx, retryDelay, h.path)
	if err != nil {
		return h, closeIsolatedHandler(h, err)
	}
	h.fp = fp
	return h, nil
}

func NewHandlerForRead(ctx context.Context, path string, defaultWaitTimeout time.Duration, retryDelay time.Duration) (*Handler, error) {
	tctx, cancel := GetTimeoutContext(ctx, defaultWaitTimeout)
	defer cancel()

	h := &Handler{
		path:     path,
		openType: ForRead,
	}

	if !Exists(h.path) {
		return h, NewNotExistError(fmt.Sprintf("file %s does not exist", h.path))
	}

	if err := h.CreateControlFileContext(tctx, RLock, retryDelay); err != nil {
		return h, closeIsolatedHandler(h, err)
	}

	fp, err := file.OpenToReadContext(tctx, retryDelay, h.path)
	if err != nil {
		return h, closeIsolatedHandler(h, err)
	}
	h.fp = fp
	return h, nil
}

func newHandlerForCreate(_ context.Context, path string, _ time.Duration, _ time.Duration) (*Handler, error) {
	return NewHandlerForCreate(path)
}

func NewHandlerForCreate(path string) (*Handler, error) {
	h := &Handler{
		path:     path,
		openType: ForCreate,
	}

	if Exists(h.path) {
		return h, NewAlreadyExistError(fmt.Sprintf("file %s already exists", h.path))
	}

	if h.lockFile != nil {
		return nil, NewLockError(fmt.Sprintf("%s file for %s is already created", Lock, h.path))
	}
	lockFile, err := TryCreateLockFile(h.path)
	if err != nil {
		return h, closeIsolatedHandler(h, err)
	}
	h.lockFile = lockFile

	fp, err := file.Create(h.path)
	if err != nil {
		return h, closeIsolatedHandler(h, err)
	}
	h.fp = fp
	return h, nil
}

func NewHandlerForUpdate(ctx context.Context, path string, defaultWaitTimeout time.Duration, retryDelay time.Duration) (*Handler, error) {
	tctx, cancel := GetTimeoutContext(ctx, defaultWaitTimeout)
	defer cancel()

	h := &Handler{
		path:     path,
		openType: ForUpdate,
	}

	if !Exists(h.path) {
		return h, NewNotExistError(fmt.Sprintf("file %s does not exist", h.path))
	}

	if err := h.CreateControlFileContext(tctx, Lock, retryDelay); err != nil {
		return h, closeIsolatedHandler(h, err)
	}

	fp, err := file.OpenToUpdateContext(tctx, retryDelay, path)
	if err != nil {
		return h, closeIsolatedHandler(h, err)
	}
	h.fp = fp

	if err := h.CreateControlFileContext(tctx, Temporary, retryDelay); err != nil {
		return h, closeIsolatedHandler(h, err)
	}
	return h, nil
}

func closeIsolatedHandler(h *Handler, err error) error {
	return NewCompositeError(ParseError(err), h.closeWithErrors())
}

func (h *Handler) Path() string {
	return h.path
}

func (h *Handler) File() *os.File {
	return h.fp
}

func (h *Handler) FileForUpdate() (*os.File, error) {
	switch h.openType {
	case ForUpdate:
		return h.tempFile.fp, nil
	case ForCreate:
		return h.fp, nil
	}
	return nil, fmt.Errorf("file %s cannot be updated", h.path)
}

func (h *Handler) close() error {
	if h.closed {
		return nil
	}

	if h.fp != nil {
		if err := file.Close(h.fp); err != nil {
			return err
		}
		h.fp = nil
	}

	if h.openType == ForCreate && Exists(h.path) {
		if err := os.Remove(h.path); err != nil {
			return err
		}
	}

	if err := h.tempFile.Close(); err != nil {
		return err
	}
	h.tempFile = nil

	if err := h.lockFile.Close(); err != nil {
		return err
	}
	h.lockFile = nil

	if err := h.rlockFile.Close(); err != nil {
		return err
	}
	h.rlockFile = nil

	h.closed = true
	return nil
}

func (h *Handler) commit() error {
	if h.closed {
		return nil
	}

	if h.fp != nil {
		if err := file.Close(h.fp); err != nil {
			return err
		}
		h.fp = nil
	}

	if h.openType == ForUpdate {
		if h.tempFile.fp != nil {
			if err := file.Close(h.tempFile.fp); err != nil {
				return err
			}
			h.tempFile.fp = nil
		}

		if Exists(h.path) {
			if err := os.Remove(h.path); err != nil {
				return err
			}
		}

		if err := os.Rename(h.tempFile.path, h.path); err != nil {
			return err
		}
	} else {
		if err := h.tempFile.Close(); err != nil {
			return err
		}
		h.tempFile = nil
	}

	if err := h.lockFile.Close(); err != nil {
		return err
	}
	h.lockFile = nil

	if err := h.rlockFile.Close(); err != nil {
		return err
	}
	h.rlockFile = nil

	h.closed = true
	return nil
}

func (h *Handler) closeWithErrors() error {
	if h.closed {
		return nil
	}

	var errs []error

	if h.fp != nil {
		if err := file.Close(h.fp); err != nil {
			errs = append(errs, err)
		} else {
			h.fp = nil
		}
	}

	if h.openType == ForCreate && Exists(h.path) {
		if err := os.Remove(h.path); err != nil {
			errs = append(errs, err)
		}
	}

	if cerrs := h.tempFile.CloseWithErrors(); cerrs != nil {
		errs = append(errs, cerrs...)
	} else {
		h.tempFile = nil
	}

	if cerrs := h.lockFile.CloseWithErrors(); cerrs != nil {
		errs = append(errs, cerrs...)
	} else {
		h.lockFile = nil
	}

	if cerrs := h.rlockFile.CloseWithErrors(); cerrs != nil {
		errs = append(errs, cerrs...)
	} else {
		h.rlockFile = nil
	}

	return NewForcedUnlockError(errs)
}

func (h *Handler) CreateControlFileContext(ctx context.Context, fileType ControlFileType, retryDelay time.Duration) error {
	switch fileType {
	case Lock:
		if h.lockFile != nil {
			return NewLockError(fmt.Sprintf("%s file for %s is already created", Lock, h.path))
		}
	case Temporary:
		if h.tempFile != nil {
			return NewLockError(fmt.Sprintf("%s file for %s is already created", Temporary, h.path))
		}
	default: //RLock
		if h.rlockFile != nil {
			return NewLockError(fmt.Sprintf("%s file for %s is already created", RLock, h.path))
		}
	}

	f, err := CreateControlFileContext(ctx, h.path, fileType, retryDelay)
	if err != nil {
		return err
	}

	switch fileType {
	case Lock:
		h.lockFile = f
	case Temporary:
		h.tempFile = f
	default: //RLock
		h.rlockFile = f
	}
	return nil
}
