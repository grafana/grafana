'use strict';
var thrift = require('../lib/thrift');

module.exports.transports = {
  'buffered': thrift.TBufferedTransport,
  'framed': thrift.TFramedTransport
};

module.exports.protocols = {
  'json': thrift.TJSONProtocol,
  'binary': thrift.TBinaryProtocol,
  'compact': thrift.TCompactProtocol
};
