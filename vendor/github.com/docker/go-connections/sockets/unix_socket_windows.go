package sockets

import "net"

func listenUnix(path string) (net.Listener, error) {
	return net.Listen("unix", path)
}
