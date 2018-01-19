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
var HelloSvc = require('./gen-nodejs/HelloSvc.js');
var TimesTwoSvc = require('./gen-nodejs/TimesTwo.js');

var helloHandler = {
	hello_func: function(result) {
		this.call_counter = this.call_counter || 0;
		console.log("Client call: " + (++this.call_counter));
		result(null, "Hello Apache Thrift for JavaScript " + this.call_counter);
	}
}

var timesTwoHandler = {
	dbl: function(val, result) {
		console.log("Client call: " + val);
		result(null, val * 2);
	}
}

var helloService = {
	transport: thrift.TBufferedTransport,
	protocol: thrift.TJSONProtocol,
	processor: HelloSvc,
	handler: helloHandler
};

var dblService = {
	transport: thrift.TBufferedTransport,
	protocol: thrift.TJSONProtocol,
	processor: TimesTwoSvc,
	handler: timesTwoHandler
};

var ServerOptions = {
	files: ".",
	services: {
		"/hello": helloService,
		"/dbl": dblService,
	}
}

var server = thrift.createWebServer(ServerOptions);
var port = 8585;
server.listen(port);
console.log("Http/Thrift Server running on port: " + port);
