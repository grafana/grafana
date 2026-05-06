// Package file is a Go library to open files with file locking depending on the system.
//
// Currently file locking on the following systems are supported.
//
/*
  darwin dragonfly freebsd linux netbsd openbsd solaris:
          Advisory Lock

  windows:
          Mandatory Lock

  android nacl plan9 zos:
          Not Supported
*/
package file
