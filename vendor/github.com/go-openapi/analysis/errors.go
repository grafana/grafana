// SPDX-FileCopyrightText: Copyright 2015-2025 go-swagger maintainers
// SPDX-License-Identifier: Apache-2.0

package analysis

import (
	"errors"
	"fmt"
)

type analysisError string

const (
	ErrAnalysis analysisError = "analysis error"
	ErrNoSchema analysisError = "no schema to analyze"
)

func (e analysisError) Error() string {
	return string(e)
}

func ErrAtKey(key string, err error) error {
	return errors.Join(
		fmt.Errorf("key %s: %w", key, err),
		ErrAnalysis,
	)
}

func ErrInvalidRef(key string) error {
	return fmt.Errorf("invalid reference: %q: %w", key, ErrAnalysis)
}

func ErrInvalidParameterRef(key string) error {
	return fmt.Errorf("resolved reference is not a parameter: %q: %w", key, ErrAnalysis)
}

func ErrResolveSchema(err error) error {
	return errors.Join(
		fmt.Errorf("could not resolve schema: %w", err),
		ErrAnalysis,
	)
}

func ErrRewriteRef(key string, target any, err error) error {
	return errors.Join(
		fmt.Errorf("failed to rewrite ref for key %q at %v: %w", key, target, err),
		ErrAnalysis,
	)
}

func ErrInlineDefinition(key string, err error) error {
	return errors.Join(
		fmt.Errorf("error while creating definition %q from inline schema: %w", key, err),
		ErrAnalysis,
	)
}
