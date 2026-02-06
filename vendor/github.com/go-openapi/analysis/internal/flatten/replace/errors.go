// SPDX-FileCopyrightText: Copyright 2015-2025 go-swagger maintainers
// SPDX-License-Identifier: Apache-2.0

package replace

import (
	"errors"
	"fmt"
)

type replaceError string

const (
	ErrReplace        replaceError = "flatten replace error"
	ErrUnexpectedType replaceError = "unexpected type used in getPointerFromKey"
)

func (e replaceError) Error() string {
	return string(e)
}

func ErrNoSchemaWithRef(key string, value any) error {
	return fmt.Errorf("no schema with ref found at %s for %T: %w", key, value, ErrReplace)
}

func ErrNoSchema(key string) error {
	return fmt.Errorf("no schema found at %s: %w", key, ErrReplace)
}

func ErrNotANumber(key string, err error) error {
	return errors.Join(
		ErrReplace,
		fmt.Errorf("%s not a number: %w", key, err),
	)
}

func ErrUnhandledParentRewrite(key string, value any) error {
	return fmt.Errorf("unhandled parent schema rewrite %s: %T: %w", key, value, ErrReplace)
}

func ErrUnhandledParentType(key string, value any) error {
	return fmt.Errorf("unhandled type for parent of %s: %T: %w", key, value, ErrReplace)
}

func ErrNoParent(key string, err error) error {
	return errors.Join(
		fmt.Errorf("can't get parent for %s: %w", key, err),
		ErrReplace,
	)
}

func ErrUnhandledContainerType(key string, value any) error {
	return fmt.Errorf("unhandled container type at %s: %T: %w", key, value, ErrReplace)
}

func ErrCyclicChain(key string) error {
	return fmt.Errorf("cannot resolve cyclic chain of pointers under %s: %w", key, ErrReplace)
}

func ErrInvalidPointerType(key string, value any, err error) error {
	return fmt.Errorf("invalid type for resolved JSON pointer %s. Expected a schema a, got: %T (%v): %w",
		key, value, err, ErrReplace,
	)
}
