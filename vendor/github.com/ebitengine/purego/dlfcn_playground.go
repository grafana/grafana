// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2024 The Ebitengine Authors

//go:build faketime

package purego

import "errors"

func Dlopen(path string, mode int) (uintptr, error) {
	return 0, errors.New("Dlopen is not supported in the playground")
}

func Dlsym(handle uintptr, name string) (uintptr, error) {
	return 0, errors.New("Dlsym is not supported in the playground")
}

func Dlclose(handle uintptr) error {
	return errors.New("Dlclose is not supported in the playground")
}

func loadSymbol(handle uintptr, name string) (uintptr, error) {
	return Dlsym(handle, name)
}
