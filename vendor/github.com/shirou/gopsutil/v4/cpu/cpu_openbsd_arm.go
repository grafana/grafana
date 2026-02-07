// SPDX-License-Identifier: BSD-3-Clause
package cpu

type cpuTimes struct {
	User uint32
	Nice uint32
	Sys  uint32
	Spin uint32
	Intr uint32
	Idle uint32
}
