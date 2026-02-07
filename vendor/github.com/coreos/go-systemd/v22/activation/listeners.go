// Copyright 2015 CoreOS, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package activation

import (
	"crypto/tls"
	"net"
)

// Listeners returns a slice containing a net.Listener for each matching socket type
// passed to this process.
//
// The order of the file descriptors is preserved in the returned slice.
// Nil values are used to fill any gaps. For example if systemd were to return file descriptors
// corresponding with "udp, tcp, tcp", then the slice would contain {nil, net.Listener, net.Listener}
func Listeners() ([]net.Listener, error) {
	files := Files(true)
	listeners := make([]net.Listener, len(files))

	for i, f := range files {
		if pc, err := net.FileListener(f); err == nil {
			listeners[i] = pc
			f.Close()
		}
	}
	return listeners, nil
}

// ListenersWithNames maps a listener name to a set of net.Listener instances.
func ListenersWithNames() (map[string][]net.Listener, error) {
	files := Files(true)
	listeners := map[string][]net.Listener{}

	for _, f := range files {
		if pc, err := net.FileListener(f); err == nil {
			current, ok := listeners[f.Name()]
			if !ok {
				listeners[f.Name()] = []net.Listener{pc}
			} else {
				listeners[f.Name()] = append(current, pc)
			}
			f.Close()
		}
	}
	return listeners, nil
}

// TLSListeners returns a slice containing a net.listener for each matching TCP socket type
// passed to this process.
// It uses default Listeners func and forces TCP sockets handlers to use TLS based on tlsConfig.
func TLSListeners(tlsConfig *tls.Config) ([]net.Listener, error) {
	listeners, err := Listeners()

	if listeners == nil || err != nil {
		return nil, err
	}

	if tlsConfig != nil {
		for i, l := range listeners {
			// Activate TLS only for TCP sockets
			if l.Addr().Network() == "tcp" {
				listeners[i] = tls.NewListener(l, tlsConfig)
			}
		}
	}

	return listeners, err
}

// TLSListenersWithNames maps a listener name to a net.Listener with
// the associated TLS configuration.
func TLSListenersWithNames(tlsConfig *tls.Config) (map[string][]net.Listener, error) {
	listeners, err := ListenersWithNames()

	if listeners == nil || err != nil {
		return nil, err
	}

	if tlsConfig != nil {
		for _, ll := range listeners {
			// Activate TLS only for TCP sockets
			for i, l := range ll {
				if l.Addr().Network() == "tcp" {
					ll[i] = tls.NewListener(l, tlsConfig)
				}
			}
		}
	}

	return listeners, err
}
