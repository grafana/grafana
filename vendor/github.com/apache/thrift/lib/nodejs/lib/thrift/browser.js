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
exports.Thrift = require('./thrift');

var xhrConnection = require('./xhr_connection');
exports.XHRConnection = xhrConnection.XHRConnection;
exports.createXHRConnection = xhrConnection.createXHRConnection;
exports.createXHRClient = xhrConnection.createXHRClient;

exports.Multiplexer = require('./multiplexed_protocol').Multiplexer;

exports.TWebSocketTransport = require('./ws_transport');
exports.TBufferedTransport = require('./buffered_transport');
exports.TFramedTransport = require('./framed_transport');

exports.Protocol = exports.TJSONProtocol = require('./json_protocol');
exports.TBinaryProtocol = require('./binary_protocol');
exports.TCompactProtocol = require('./compact_protocol');
