--
-- Licensed to the Apache Software Foundation (ASF) under one
-- or more contributor license agreements. See the NOTICE file
-- distributed with this work for additional information
-- regarding copyright ownership. The ASF licenses this file
-- to you under the Apache License, Version 2.0 (the
-- "License"); you may not use this file except in compliance
-- with the License. You may obtain a copy of the License at
--
--   http://www.apache.org/licenses/LICENSE-2.0
--
-- Unless required by applicable law or agreed to in writing,
-- software distributed under the License is distributed on an
-- "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
-- KIND, either express or implied. See the License for the
-- specific language governing permissions and limitations
-- under the License.
--

require 'Thrift'
require 'TFramedTransport'
require 'TBinaryProtocol'

-- TServer
TServer = __TObject:new{
  __type = 'TServer'
}

-- 2 possible constructors
--   1. {processor, serverTransport}
--   2. {processor, serverTransport, transportFactory, protocolFactory}
function TServer:new(args)
  if ttype(args) ~= 'table' then
    error('TServer must be initialized with a table')
  end
  if args.processor == nil then
    terror('You must provide ' .. ttype(self) .. ' with a processor')
  end
  if args.serverTransport == nil then
    terror('You must provide ' .. ttype(self) .. ' with a serverTransport')
  end

  -- Create the object
  local obj = __TObject.new(self, args)

  if obj.transportFactory then
    obj.inputTransportFactory = obj.transportFactory
    obj.outputTransportFactory = obj.transportFactory
    obj.transportFactory = nil
  else
    obj.inputTransportFactory = TFramedTransportFactory:new{}
    obj.outputTransportFactory = obj.inputTransportFactory
  end

  if obj.protocolFactory then
    obj.inputProtocolFactory = obj.protocolFactory
    obj.outputProtocolFactory = obj.protocolFactory
    obj.protocolFactory = nil
  else
    obj.inputProtocolFactory = TBinaryProtocolFactory:new{}
    obj.outputProtocolFactory = obj.inputProtocolFactory
  end

  -- Set the __server variable in the handler so we can stop the server
  obj.processor.handler.__server = self

  return obj
end

function TServer:setServerEventHandler(handler)
  self.serverEventHandler = handler
end

function TServer:_clientBegin(content, iprot, oprot)
  if self.serverEventHandler and
    type(self.serverEventHandler.clientBegin) == 'function' then
    self.serverEventHandler:clientBegin(iprot, oprot)
  end
end

function TServer:_preServe()
  if self.serverEventHandler and
    type(self.serverEventHandler.preServe) == 'function' then
    self.serverEventHandler:preServe(self.serverTransport:getSocketInfo())
  end
end

function TServer:_handleException(err)
  if string.find(err, 'TTransportException') == nil then
    print(err)
  end
end

function TServer:serve() end
function TServer:handle(client)
  local itrans, otrans =
    self.inputTransportFactory:getTransport(client),
    self.outputTransportFactory:getTransport(client)
  local iprot, oprot =
    self.inputProtocolFactory:getProtocol(itrans),
    self.outputProtocolFactory:getProtocol(otrans)

  self:_clientBegin(iprot, oprot)
  while true do
    local ret, err = pcall(self.processor.process, self.processor, iprot, oprot)
    if ret == false and err then
      if not string.find(err, "TTransportException") then
        self:_handleException(err)
      end
      break
    end
  end
  itrans:close()
  otrans:close()
end

function TServer:close()
  self.serverTransport:close()
end

-- TSimpleServer
--  Single threaded server that handles one transport (connection)
TSimpleServer = __TObject:new(TServer, {
  __type = 'TSimpleServer',
  __stop = false
})

function TSimpleServer:serve()
  self.serverTransport:listen()
  self:_preServe()
  while not self.__stop do
    client = self.serverTransport:accept()
    self:handle(client)
  end
  self:close()
end

function TSimpleServer:stop()
  self.__stop = true
end
