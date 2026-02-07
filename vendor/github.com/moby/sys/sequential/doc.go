// Package sequential provides a set of functions for managing sequential
// files on Windows.
//
// The origin of these functions are the golang OS and windows packages,
// slightly modified to only cope with files, not directories due to the
// specific use case.
//
// The alteration is to allow a file on Windows to be opened with
// FILE_FLAG_SEQUENTIAL_SCAN (particular for docker load), to avoid eating
// the standby list, particularly when accessing large files such as layer.tar.
//
// For non-Windows platforms, the package provides wrappers for the equivalents
// in the os packages. They are passthrough on Unix platforms, and only relevant
// on Windows.
package sequential
