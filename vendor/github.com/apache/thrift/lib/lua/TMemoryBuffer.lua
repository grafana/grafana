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

TMemoryBuffer = TTransportBase:new{
  __type = 'TMemoryBuffer',
  buffer = '',
  bufferSize = 1024,
  wPos = 0,
  rPos = 0
}
function TMemoryBuffer:isOpen()
  return 1
end
function TMemoryBuffer:open() end
function TMemoryBuffer:close() end

function TMemoryBuffer:peak()
  return self.rPos < self.wPos
end

function TMemoryBuffer:getBuffer()
  return self.buffer
end

function TMemoryBuffer:resetBuffer(buf)
  if buf then
    self.buffer = buf
    self.bufferSize = string.len(buf)
  else
    self.buffer = ''
    self.bufferSize = 1024
  end
  self.wPos = string.len(buf)
  self.rPos = 0
end

function TMemoryBuffer:available()
  return self.wPos - self.rPos
end

function TMemoryBuffer:read(len)
  local avail = self:available()
  if avail == 0 then
    return ''
  end

  if avail < len then
    len = avail
  end

  local val = string.sub(self.buffer, self.rPos + 1, self.rPos + len)
  self.rPos = self.rPos + len
  return val
end

function TMemoryBuffer:readAll(len)
  local avail = self:available()

  if avail < len then
    local msg = string.format('Attempt to readAll(%d) found only %d available',
                              len, avail)
    terror(TTransportException:new{message = msg})
  end
  -- read should block so we don't need a loop here
  return self:read(len)
end

function TMemoryBuffer:write(buf)
  self.buffer = self.buffer .. buf
  self.wPos = self.wPos + string.len(buf)
end

function TMemoryBuffer:flush() end
