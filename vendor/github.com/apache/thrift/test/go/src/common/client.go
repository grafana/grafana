/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership. The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

package common

import (
	"compress/zlib"
	"crypto/tls"
	"flag"
	"fmt"
	"gen/thrifttest"
	"net/http"
	"thrift"
)

var debugClientProtocol bool

func init() {
	flag.BoolVar(&debugClientProtocol, "debug_client_protocol", false, "turn client protocol trace on")
}

func StartClient(
	host string,
	port int64,
	domain_socket string,
	transport string,
	protocol string,
	ssl bool) (client *thrifttest.ThriftTestClient, err error) {

	hostPort := fmt.Sprintf("%s:%d", host, port)

	var protocolFactory thrift.TProtocolFactory
	switch protocol {
	case "compact":
		protocolFactory = thrift.NewTCompactProtocolFactory()
	case "simplejson":
		protocolFactory = thrift.NewTSimpleJSONProtocolFactory()
	case "json":
		protocolFactory = thrift.NewTJSONProtocolFactory()
	case "binary":
		protocolFactory = thrift.NewTBinaryProtocolFactoryDefault()
	default:
		return nil, fmt.Errorf("Invalid protocol specified %s", protocol)
	}
	if debugClientProtocol {
		protocolFactory = thrift.NewTDebugProtocolFactory(protocolFactory, "client:")
	}
	var trans thrift.TTransport
	if ssl {
		trans, err = thrift.NewTSSLSocket(hostPort, &tls.Config{InsecureSkipVerify: true})
	} else {
		if domain_socket != "" {
			trans, err = thrift.NewTSocket(domain_socket)
		} else {
			trans, err = thrift.NewTSocket(hostPort)
		}
	}
	if err != nil {
		return nil, err
	}
	switch transport {
	case "http":
		if ssl {
			tr := &http.Transport{
				TLSClientConfig: &tls.Config{InsecureSkipVerify: true},
			}
			client := &http.Client{Transport: tr}
			trans, err = thrift.NewTHttpPostClientWithOptions(fmt.Sprintf("https://%s/", hostPort), thrift.THttpClientOptions{Client: client})
			fmt.Println(hostPort)
		} else {
			trans, err = thrift.NewTHttpPostClient(fmt.Sprintf("http://%s/", hostPort))
		}

		if err != nil {
			return nil, err
		}

	case "framed":
		trans = thrift.NewTFramedTransport(trans)
	case "buffered":
		trans = thrift.NewTBufferedTransport(trans, 8192)
	case "zlib":
		trans, err = thrift.NewTZlibTransport(trans, zlib.BestCompression)
		if err != nil {
			return nil, err
		}
	case "":
		trans = trans
	default:
		return nil, fmt.Errorf("Invalid transport specified %s", transport)
	}

	if err = trans.Open(); err != nil {
		return nil, err
	}
	client = thrifttest.NewThriftTestClientFactory(trans, protocolFactory)
	return
}
