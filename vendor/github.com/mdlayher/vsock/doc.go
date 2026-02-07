// Package vsock provides access to Linux VM sockets (AF_VSOCK) for
// communication between a hypervisor and its virtual machines.
//
// The types in this package implement interfaces provided by package net and
// may be used in applications that expect a net.Listener or net.Conn.
//
//   - *Addr implements net.Addr
//   - *Conn implements net.Conn
//   - *Listener implements net.Listener
package vsock
