---- Licensed to the Apache Software Foundation (ASF) under one
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
require 'libluasocket'

-- TSocketBase
TSocketBase = TTransportBase:new{
  __type = 'TSocketBase',
  timeout = 1000,
  host = 'localhost',
  port = 9090,
  handle
}

function TSocketBase:close()
  if self.handle then
    self.handle:destroy()
    self.handle = nil
  end
end

-- Returns a table with the fields host and port
function TSocketBase:getSocketInfo()
  if self.handle then
    return self.handle:getsockinfo()
  end
  terror(TTransportException:new{errorCode = TTransportException.NOT_OPEN})
end

function TSocketBase:setTimeout(timeout)
  if timeout and ttype(timeout) == 'number' then
    if self.handle then
      self.handle:settimeout(timeout)
    end
    self.timeout = timeout
  end
end

-- TSocket
TSocket = TSocketBase:new{
  __type = 'TSocket',
  host = 'localhost',
  port = 9090
}

function TSocket:isOpen()
  if self.handle then
    return true
  end
  return false
end

function TSocket:open()
  if self.handle then
    self:close()
  end

  -- Create local handle
  local sock, err = luasocket.create_and_connect(
    self.host, self.port, self.timeout)
  if err == nil then
    self.handle = sock
  end

  if err then
    terror(TTransportException:new{
      message = 'Could not connect to ' .. self.host .. ':' .. self.port
        .. ' (' .. err .. ')'
    })
  end
end

function TSocket:read(len)
  local buf = self.handle:receive(self.handle, len)
  if not buf or string.len(buf) ~= len then
    terror(TTransportException:new{errorCode = TTransportException.UNKNOWN})
  end
  return buf
end

function TSocket:write(buf)
  self.handle:send(self.handle, buf)
end

function TSocket:flush()
end

-- TServerSocket
TServerSocket = TSocketBase:new{
  __type = 'TServerSocket',
  host = 'localhost',
  port = 9090
}

function TServerSocket:listen()
  if self.handle then
    self:close()
  end

  local sock, err = luasocket.create(self.host, self.port)
  if not err then
    self.handle = sock
  else
    terror(err)
  end
  self.handle:settimeout(self.timeout)
  self.handle:listen()
end

function TServerSocket:accept()
  local client, err = self.handle:accept()
  if err then
    terror(err)
  end
  return TSocket:new({handle = client})
end
