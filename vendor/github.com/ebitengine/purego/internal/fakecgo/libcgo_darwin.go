// SPDX-License-Identifier: Apache-2.0
// SPDX-FileCopyrightText: 2022 The Ebitengine Authors

//go:build !cgo

package fakecgo

type (
	pthread_mutex_t struct {
		sig    int64
		opaque [56]byte
	}
	pthread_cond_t struct {
		sig    int64
		opaque [40]byte
	}
)

var (
	PTHREAD_COND_INITIALIZER  = pthread_cond_t{sig: 0x3CB0B1BB}
	PTHREAD_MUTEX_INITIALIZER = pthread_mutex_t{sig: 0x32AAABA7}
)
