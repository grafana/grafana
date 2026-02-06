// SPDX-FileCopyrightText: Copyright 2015-2025 go-swagger maintainers
// SPDX-License-Identifier: Apache-2.0

package strfmt

type strfmtError string

// ErrFormat is an error raised by the strfmt package
const ErrFormat strfmtError = "format error"

func (e strfmtError) Error() string {
	return string(e)
}
