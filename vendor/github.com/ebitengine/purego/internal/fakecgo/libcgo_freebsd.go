// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2022 The Ebitengine Authors

//go:build !cgo

package fakecgo

type (
	pthread_cond_t  uintptr
	pthread_mutex_t uintptr
)

var (
	PTHREAD_COND_INITIALIZER  = pthread_cond_t(0)
	PTHREAD_MUTEX_INITIALIZER = pthread_mutex_t(0)
)
