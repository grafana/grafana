
var assert = require('assert');
var thrift = require('thrift');
var helpers = require('./helpers');
var ThriftTest = require('./gen-nodejs/ThriftTest');
var ThriftTestDriver = require('./test_driver').ThriftTestDriver;

// createXHRConnection createWSConnection
var connection = thrift.createXHRConnection("localhost", 9090, {
    transport: helpers.transports['buffered'],
    protocol: helpers.protocols['json'],
    path: '/test'
});

connection.on('error', function(err) {
    assert(false, err);
});

// Uncomment the following line to start a websockets connection
// connection.open();

// createWSClient createXHRClient
var client = thrift.createXHRClient(ThriftTest, connection);

ThriftTestDriver(client, function (status) {
    console.log('Browser:', status);
});
