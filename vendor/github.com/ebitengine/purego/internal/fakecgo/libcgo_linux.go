// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2022 The Ebitengine Authors

//go:build !cgo

package fakecgo

type (
	pthread_cond_t  [48]byte
	pthread_mutex_t [48]byte
)

var (
	PTHREAD_COND_INITIALIZER  = pthread_cond_t{}
	PTHREAD_MUTEX_INITIALIZER = pthread_mutex_t{}
)
