package file

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"
)

type Container struct {
	m map[string]*Handler
}

func NewContainer() *Container {
	return &Container{
		m: make(map[string]*Handler),
	}
}

func (c *Container) Keys() []string {
	l := make([]string, 0, len(c.m))
	for k := range c.m {
		l = append(l, k)
	}
	return l
}

func (c *Container) Add(path string, handler *Handler) error {
	key := strings.ToUpper(path)
	if _, ok := c.m[key]; ok {
		return errors.New(fmt.Sprintf("file %s already opened", path))
	}
	c.m[key] = handler
	return nil
}

func (c *Container) Remove(path string) {
	key := strings.ToUpper(path)
	if _, ok := c.m[key]; ok {
		delete(c.m, key)
	}
}

func (c *Container) CreateHandlerWithoutLock(ctx context.Context, path string, defaultWaitTimeout time.Duration, retryDelay time.Duration) (*Handler, error) {
	return c.createHandler(ctx, path, defaultWaitTimeout, retryDelay, NewHandlerWithoutLock)
}

func (c *Container) CreateHandlerForRead(ctx context.Context, path string, defaultWaitTimeout time.Duration, retryDelay time.Duration) (*Handler, error) {
	return c.createHandler(ctx, path, defaultWaitTimeout, retryDelay, NewHandlerForRead)
}

func (c *Container) CreateHandlerForCreate(path string) (*Handler, error) {
	return c.createHandler(nil, path, DefaultWaitTimeout, DefaultRetryDelay, newHandlerForCreate)
}

func (c *Container) CreateHandlerForUpdate(ctx context.Context, path string, defaultWaitTimeout time.Duration, retryDelay time.Duration) (*Handler, error) {
	return c.createHandler(ctx, path, defaultWaitTimeout, retryDelay, NewHandlerForUpdate)
}

func (c *Container) createHandler(ctx context.Context, path string, defaultWaitTimeout time.Duration, retryDelay time.Duration, fn func(context.Context, string, time.Duration, time.Duration) (*Handler, error)) (*Handler, error) {
	h, err := fn(ctx, path, defaultWaitTimeout, retryDelay)
	if err != nil {
		return nil, err
	}

	if err := c.Add(h.path, h); err != nil {
		return h, closeIsolatedHandler(h, err)
	}
	return h, nil
}

func (c *Container) Close(h *Handler) error {
	if h == nil {
		return nil
	}

	key := strings.ToUpper(h.Path())
	if _, ok := c.m[key]; ok {
		if err := c.m[key].close(); err != nil {
			return err
		}
		c.Remove(h.Path())
	}
	return nil
}

func (c *Container) Commit(h *Handler) error {
	if h == nil {
		return nil
	}

	key := strings.ToUpper(h.Path())
	if _, ok := c.m[key]; ok {
		if err := c.m[key].commit(); err != nil {
			return err
		}
		c.Remove(h.Path())
	}
	return nil
}

func (c *Container) CloseWithErrors(h *Handler) (err error) {
	if h == nil {
		return nil
	}

	key := strings.ToUpper(h.Path())
	if _, ok := c.m[key]; ok {
		err = c.m[key].closeWithErrors()
		c.Remove(h.Path())
	}
	return
}

func (c *Container) CloseAll() error {
	for k := range c.m {
		if err := c.Close(c.m[k]); err != nil {
			return err
		}
	}
	return nil
}

func (c *Container) CloseAllWithErrors() error {
	var errs []error
	for k := range c.m {
		if err := c.CloseWithErrors(c.m[k]); err != nil {
			errs = append(errs, err.(*ForcedUnlockError).Errors...)
		}
	}

	return NewForcedUnlockError(errs)
}
