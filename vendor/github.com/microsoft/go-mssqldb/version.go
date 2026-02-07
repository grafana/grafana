package mssql

import "fmt"

// Update this variable with the release tag before pushing the tag
// This value is written to the prelogin and login7 packets during a new connection
const driverVersion = "v1.9.2"

func getDriverVersion(ver string) uint32 {
	var majorVersion uint32
	var minorVersion uint32
	var rev uint32
	_, _ = fmt.Sscanf(ver, "v%d.%d.%d", &majorVersion, &minorVersion, &rev)
	return (majorVersion << 24) | (minorVersion << 16) | rev
}
