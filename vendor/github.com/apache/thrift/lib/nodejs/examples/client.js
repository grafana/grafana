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
var thrift = require('thrift');

var UserStorage = require('./gen-nodejs/UserStorage.js'),
    ttypes = require('./gen-nodejs/user_types');

var connection = thrift.createConnection('localhost', 9090),
    client = thrift.createClient(UserStorage, connection);

var user = new ttypes.UserProfile({uid: 1,
                                   name: "Mark Slee",
                                   blurb: "I'll find something to put here."});

connection.on('error', function(err) {
  console.error(err);
});

client.store(user, function(err, response) {
  if (err) {
    console.error(err);
  } else {
    console.log("client stored:", user.uid);
    client.retrieve(user.uid, function(err, responseUser) {
      if (err) {
        console.error(err);
      } else {
        console.log("client retrieved:", responseUser.uid);
        connection.end();
      }
    });
  }
});
