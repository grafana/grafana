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

require 'TTransport'

TBufferedTransport = TTransportBase:new{
  __type = 'TBufferedTransport',
  rBufSize = 2048,
  wBufSize = 2048,
  wBuf = '',
  rBuf = ''
}

function TBufferedTransport:new(obj)
  if ttype(obj) ~= 'table' then
    error(ttype(self) .. 'must be initialized with a table')
  end

  -- Ensure a transport is provided
  if not obj.trans then
    error('You must provide ' .. ttype(self) .. ' with a trans')
  end

  return TTransportBase.new(self, obj)
end

function TBufferedTransport:isOpen()
  return self.trans:isOpen()
end

function TBufferedTransport:open()
  return self.trans:open()
end

function TBufferedTransport:close()
  return self.trans:close()
end

function TBufferedTransport:read(len)
  return self.trans:read(len)
end

function TBufferedTransport:readAll(len)
  return self.trans:readAll(len)
end

function TBufferedTransport:write(buf)
  self.wBuf = self.wBuf .. buf
  if string.len(self.wBuf) >= self.wBufSize then
    self.trans:write(self.wBuf)
    self.wBuf = ''
  end
end

function TBufferedTransport:flush()
  if string.len(self.wBuf) > 0 then
    self.trans:write(self.wBuf)
    self.wBuf = ''
  end
end

TBufferedTransportFactory = TTransportFactoryBase:new{
  __type = 'TBufferedTransportFactory'
}

function TBufferedTransportFactory:getTransport(trans)
  if not trans then
    terror(TTransportException:new{
      message = 'Must supply a transport to ' .. ttype(self)
    })
  end
  return TBufferedTransport:new{
    trans = trans
  }
end
