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
	"thrift"
)

var (
	debugServerProtocol bool
	certPath            string
)

func init() {
	flag.BoolVar(&debugServerProtocol, "debug_server_protocol", false, "turn server protocol trace on")
}

func GetServerParams(
	host string,
	port int64,
	domain_socket string,
	transport string,
	protocol string,
	ssl bool,
	certPath string,
	handler thrifttest.ThriftTest) (thrift.TProcessor, thrift.TServerTransport, thrift.TTransportFactory, thrift.TProtocolFactory, error) {

	var err error
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
		return nil, nil, nil, nil, fmt.Errorf("Invalid protocol specified %s", protocol)
	}
	if debugServerProtocol {
		protocolFactory = thrift.NewTDebugProtocolFactory(protocolFactory, "server:")
	}

	var serverTransport thrift.TServerTransport
	if ssl {
		cfg := new(tls.Config)
		if cert, err := tls.LoadX509KeyPair(certPath+"/server.crt", certPath+"/server.key"); err != nil {
			return nil, nil, nil, nil, err
		} else {
			cfg.Certificates = append(cfg.Certificates, cert)
		}
		serverTransport, err = thrift.NewTSSLServerSocket(hostPort, cfg)
	} else {
		if domain_socket != "" {
			serverTransport, err = thrift.NewTServerSocket(domain_socket)
		} else {
			serverTransport, err = thrift.NewTServerSocket(hostPort)
		}
	}
	if err != nil {
		return nil, nil, nil, nil, err
	}

	var transportFactory thrift.TTransportFactory

	switch transport {
	case "http":
		// there is no such factory, and we don't need any
		transportFactory = nil
	case "framed":
		transportFactory = thrift.NewTTransportFactory()
		transportFactory = thrift.NewTFramedTransportFactory(transportFactory)
	case "buffered":
		transportFactory = thrift.NewTBufferedTransportFactory(8192)
	case "zlib":
		transportFactory = thrift.NewTZlibTransportFactory(zlib.BestCompression)
	case "":
		transportFactory = thrift.NewTTransportFactory()
	default:
		return nil, nil, nil, nil, fmt.Errorf("Invalid transport specified %s", transport)
	}
	processor := thrifttest.NewThriftTestProcessor(handler)

	return processor, serverTransport, transportFactory, protocolFactory, nil
}
