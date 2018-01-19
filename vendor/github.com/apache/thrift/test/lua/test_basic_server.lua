-- Licensed to the Apache Software Foundation (ASF) under one
-- or more contributor license agreements. See the NOTICE file
-- distributed with this work for additional information
-- regarding copyright ownership. The ASF licenses this file
-- to you under the Apache License, Version 2.0 (the
-- "License"); you may not use this file except in compliance
-- with the License. You may obtain a copy of the License at

--   http://www.apache.org/licenses/LICENSE-2.0

-- Unless required by applicable law or agreed to in writing,
-- software distributed under the License is distributed on an
-- "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
-- KIND, either express or implied. See the License for the
-- specific language governing permissions and limitations
-- under the License.

require('ThriftTest_ThriftTest')
require('TSocket')
require('TBufferedTransport')
require('TFramedTransport')
require('THttpTransport')
require('TCompactProtocol')
require('TJsonProtocol')
require('TBinaryProtocol')
require('TServer')
require('liblualongnumber')

--------------------------------------------------------------------------------
-- Handler
TestHandler = ThriftTestIface:new{}

-- Stops the server
function TestHandler:testVoid()
end

function TestHandler:testString(str)
  return str
end

function TestHandler:testBool(bool)
  return bool
end

function TestHandler:testByte(byte)
  return byte
end

function TestHandler:testI32(i32)
  return i32
end

function TestHandler:testI64(i64)
  return i64
end

function TestHandler:testDouble(d)
  return d
end

function TestHandler:testBinary(by)
  return by
end

function TestHandler:testStruct(thing)
  return thing
end

--------------------------------------------------------------------------------
-- Test
local server

function teardown()
  if server then
    server:close()
  end
end

function parseArgs(rawArgs)
  local opt = {
    protocol='binary',
    transport='buffered',
    port='9090',
  }
  for i, str in pairs(rawArgs) do
    if i > 0 then
      k, v = string.match(str, '--(%w+)=(%w+)')
      assert(opt[k] ~= nil, 'Unknown argument')
      opt[k] = v
    end
  end
  return opt
end

function testBasicServer(rawArgs)
  local opt = parseArgs(rawArgs)
  -- Handler & Processor
  local handler = TestHandler:new{}
  assert(handler, 'Failed to create handler')
  local processor = ThriftTestProcessor:new{
    handler = handler
  }
  assert(processor, 'Failed to create processor')

  -- Server Socket
  local socket = TServerSocket:new{
    port = opt.port
  }
  assert(socket, 'Failed to create server socket')

  -- Transport & Factory
  local transports = {
    buffered = TBufferedTransportFactory,
    framed = TFramedTransportFactory,
    http = THttpTransportFactory,
  }
  assert(transports[opt.transport], 'Failed to create framed transport factory')
  local trans_factory = transports[opt.transport]:new{}
  local protocols = {
    binary = TBinaryProtocolFactory,
    compact = TCompactProtocolFactory,
    json = TJSONProtocolFactory,
  }
  local prot_factory = protocols[opt.protocol]:new{}
  assert(prot_factory, 'Failed to create binary protocol factory')

  -- Simple Server
  server = TSimpleServer:new{
    processor = processor,
    serverTransport = socket,
    transportFactory = trans_factory,
    protocolFactory = prot_factory
  }
  assert(server, 'Failed to create server')

  -- Serve
  server:serve()
  server = nil
end

testBasicServer(arg)
teardown()
