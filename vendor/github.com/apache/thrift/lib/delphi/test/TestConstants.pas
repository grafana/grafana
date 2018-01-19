(*
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
 *)

unit TestConstants;

interface

uses SysUtils;

type
  TKnownProtocol = (
    prot_Binary,  // default binary protocol
    prot_JSON,    // JSON protocol
    prot_Compact
  );

  TServerType = (
    srv_Simple,
    srv_Nonblocking,
    srv_Threadpool,
    srv_Threaded
  );

  TEndpointTransport = (
    trns_Sockets,
    trns_Http,
    trns_NamedPipes,
    trns_AnonPipes,
    trns_EvHttp  // as listed on http://thrift.apache.org/test
  );

  TLayeredTransport = (
    trns_Buffered,
    trns_Framed
  );

  TLayeredTransports = set of TLayeredTransport;

const
  SERVER_TYPES : array[TServerType] of string
                  = ('Simple', 'Nonblocking', 'Threadpool', 'Threaded');

  THRIFT_PROTOCOLS : array[TKnownProtocol] of string
                  = ('Binary', 'JSON', 'Compact');

  LAYERED_TRANSPORTS : array[TLayeredTransport] of string
                  = ('Buffered', 'Framed');

  ENDPOINT_TRANSPORTS : array[TEndpointTransport] of string
                  = ('Sockets', 'Http', 'Named Pipes','Anon Pipes', 'EvHttp');

  // defaults are: read=false, write=true
  BINARY_STRICT_READ  = FALSE;
  BINARY_STRICT_WRITE = FALSE;

  HUGE_TEST_STRING = 'Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy '
                   + 'eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam '
                   + 'voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet '
                   + 'clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit '
                   + 'amet. Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam '
                   + 'nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed '
                   + 'diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet '
                   + 'clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet. '
                   + 'Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy '
                   + 'eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam '
                   + 'voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet '
                   + 'clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit '
                   + 'amet. Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam '
                   + 'nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed '
                   + 'diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet '
                   + 'clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet. '
                   + 'Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy '
                   + 'eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam '
                   + 'voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet '
                   + 'clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit '
                   + 'amet. Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam '
                   + 'nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed '
                   + 'diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet '
                   + 'clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet. '
                   + 'Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy '
                   + 'eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam '
                   + 'voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet '
                   + 'clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit '
                   + 'amet. Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam '
                   + 'nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed '
                   + 'diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet '
                   + 'clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet. '
                   + 'Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy '
                   + 'eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam '
                   + 'voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet '
                   + 'clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit '
                   + 'amet. Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam '
                   + 'nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed '
                   + 'diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet '
                   + 'clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet. '
                   + 'Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy '
                   + 'eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam '
                   + 'voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet '
                   + 'clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit '
                   + 'amet. Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam '
                   + 'nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed '
                   + 'diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet '
                   + 'clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet. '
                   + 'Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy '
                   + 'eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam '
                   + 'voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet '
                   + 'clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit '
                   + 'amet. Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam '
                   + 'nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed '
                   + 'diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet '
                   + 'clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet. '
                   + 'Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy '
                   + 'eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam '
                   + 'voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet '
                   + 'clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit '
                   + 'amet. Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam '
                   + 'nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed '
                   + 'diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet '
                   + 'clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet. '
                   + 'Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam nonumy '
                   + 'eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam '
                   + 'voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet '
                   + 'clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit '
                   + 'amet. Lorem ipsum dolor sit amet, consetetur sadipscing elitr, sed diam '
                   + 'nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed '
                   + 'diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum. Stet '
                   + 'clita kasd gubergren, no sea takimata sanctus est Lorem ipsum dolor sit amet. ';


function BytesToHex( const bytes : TBytes) : string;


implementation


function BytesToHex( const bytes : TBytes) : string;
var i : Integer;
begin
  result := '';
  for i := Low(bytes) to High(bytes) do begin
    result := result + IntToHex(bytes[i],2);
  end;
end;


end.
