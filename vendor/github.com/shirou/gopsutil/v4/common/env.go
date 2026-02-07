// SPDX-License-Identifier: BSD-3-Clause
package common

type EnvKeyType string

// EnvKey is a context key that can be used to set programmatically the environment
// gopsutil relies on to perform calls against the OS.
// Example of use:
//
//	ctx := context.WithValue(context.Background(), common.EnvKey, EnvMap{common.HostProcEnvKey: "/myproc"})
//	avg, err := load.AvgWithContext(ctx)
var EnvKey = EnvKeyType("env")

const (
	HostProcEnvKey    EnvKeyType = "HOST_PROC"
	HostSysEnvKey     EnvKeyType = "HOST_SYS"
	HostEtcEnvKey     EnvKeyType = "HOST_ETC"
	HostVarEnvKey     EnvKeyType = "HOST_VAR"
	HostRunEnvKey     EnvKeyType = "HOST_RUN"
	HostDevEnvKey     EnvKeyType = "HOST_DEV"
	HostRootEnvKey    EnvKeyType = "HOST_ROOT"
	HostProcMountinfo EnvKeyType = "HOST_PROC_MOUNTINFO"
)

type EnvMap map[EnvKeyType]string
