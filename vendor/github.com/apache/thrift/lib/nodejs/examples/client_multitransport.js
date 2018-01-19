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
var thrift = require('thrift'),
    ttransport = require('thrift/transport');

var UserStorage = require('./gen-nodejs/UserStorage'),
    ttypes = require('./gen-nodejs/user_types');

var f_conn = thrift.createConnection('localhost', 9090), // default: framed
    f_client = thrift.createClient(UserStorage, f_conn);
var b_conn = thrift.createConnection('localhost', 9091, {transport: ttransport.TBufferedTransport}),
    b_client = thrift.createClient(UserStorage, b_conn);
var user1 = new ttypes.UserProfile({uid: 1,
                                    name: "Mark Slee",
                                    blurb: "I'll find something to put here."});
var user2 = new ttypes.UserProfile({uid: 2,
                                    name: "Satoshi Tagomori",
                                    blurb: "ok, let's test with buffered transport."});

f_conn.on('error', function(err) {
  console.error("framed:", err);
});

f_client.store(user1, function(err, response) {
  if (err) { console.error(err); return; }

  console.log("stored:", user1.uid, " as ", user1.name);
  b_client.retrieve(user1.uid, function(err, responseUser) {
    if (err) { console.error(err); return; }
    console.log("retrieved:", responseUser.uid, " as ", responseUser.name);
  });
});

b_client.store(user2, function(err, response) {
  if (err) { console.error(err); return; }

  console.log("stored:", user2.uid, " as ", user2.name);
  f_client.retrieve(user2.uid, function(err, responseUser) {
    if (err) { console.error(err); return; }
    console.log("retrieved:", responseUser.uid, " as ", responseUser.name);
  });
});
