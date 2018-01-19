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

var users = {};

var server = thrift.createServer(UserStorage, {
  store: function(user, result) {
    console.log("server stored:", user.uid);
    users[user.uid] = user;
    result(null);
  },

  retrieve: function(uid, result) {
    console.log("server retrieved:", uid);
    result(null, users[uid]);
  },
});

server.listen(9090);
