// +build go1.6, !go1.9

/*
 *
 * Copyright 2018 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

package dns

import (
	"fmt"
	"net"

	"golang.org/x/net/context"
)

var (
	defaultResolver netResolver = &preGo19Resolver{}
)

type preGo19Resolver struct {
}

func (*preGo19Resolver) LookupHost(ctx context.Context, host string) ([]string, error) {
	return net.LookupHost(host)
}

func (*preGo19Resolver) LookupSRV(ctx context.Context, service, proto, name string) (string, []*net.SRV, error) {
	return net.LookupSRV(service, proto, name)
}

func (*preGo19Resolver) LookupTXT(ctx context.Context, name string) ([]string, error) {
	return net.LookupTXT(name)
}

var customAuthorityResolver = func(authority string) (netResolver, error) {
	return nil, fmt.Errorf("Default DNS resolver does not support custom DNS server with go < 1.9")
}
