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

---- namespace thrift
--thrift = {}
--setmetatable(thrift, {__index = _G}) --> perf hit for accessing global methods
--setfenv(1, thrift)

package.cpath = package.cpath .. ';bin/?.so' -- TODO FIX
function ttype(obj)
  if type(obj) == 'table' and
    obj.__type and
    type(obj.__type) == 'string' then
      return obj.__type
  end
  return type(obj)
end

function terror(e)
  if e and e.__tostring then
    error(e:__tostring())
    return
  end
  error(e)
end

function ttable_size(t)
  local count = 0
  for k, v in pairs(t) do
    count = count + 1
  end
  return count
end

version = 0.10

TType = {
  STOP   = 0,
  VOID   = 1,
  BOOL   = 2,
  BYTE   = 3,
  I08    = 3,
  DOUBLE = 4,
  I16    = 6,
  I32    = 8,
  I64    = 10,
  STRING = 11,
  UTF7   = 11,
  STRUCT = 12,
  MAP    = 13,
  SET    = 14,
  LIST   = 15,
  UTF8   = 16,
  UTF16  = 17
}

TMessageType = {
  CALL  = 1,
  REPLY = 2,
  EXCEPTION = 3,
  ONEWAY = 4
}

-- Recursive __index function to achieve inheritance
function __tobj_index(self, key)
  local v = rawget(self, key)
  if v ~= nil then
    return v
  end

  local p = rawget(self, '__parent')
  if p then
    return __tobj_index(p, key)
  end

  return nil
end

-- Basic Thrift-Lua Object
__TObject = {
  __type = '__TObject',
  __mt = {
    __index = __tobj_index
  }
}
function __TObject:new(init_obj)
  local obj = {}
  if ttype(obj) == 'table' then
    obj = init_obj
  end

  -- Use the __parent key and the __index function to achieve inheritance
  obj.__parent = self
  setmetatable(obj, __TObject.__mt)
  return obj
end

-- Return a string representation of any lua variable
function thrift_print_r(t)
  local ret = ''
  local ltype = type(t)
  if (ltype == 'table') then
    ret = ret .. '{ '
    for key,value in pairs(t) do
      ret = ret .. tostring(key) .. '=' .. thrift_print_r(value) .. ' '
    end
    ret = ret .. '}'
  elseif ltype == 'string' then
    ret = ret .. "'" .. tostring(t) .. "'"
  else
    ret = ret .. tostring(t)
  end
  return ret
end

-- Basic Exception
TException = __TObject:new{
  message,
  errorCode,
  __type = 'TException'
}
function TException:__tostring()
  if self.message then
    return string.format('%s: %s', self.__type, self.message)
  else
    local message
    if self.errorCode and self.__errorCodeToString then
      message = string.format('%d: %s', self.errorCode, self:__errorCodeToString())
    else
      message = thrift_print_r(self)
    end
    return string.format('%s:%s', self.__type, message)
  end
end

TApplicationException = TException:new{
  UNKNOWN                 = 0,
  UNKNOWN_METHOD          = 1,
  INVALID_MESSAGE_TYPE    = 2,
  WRONG_METHOD_NAME       = 3,
  BAD_SEQUENCE_ID         = 4,
  MISSING_RESULT          = 5,
  INTERNAL_ERROR          = 6,
  PROTOCOL_ERROR          = 7,
  INVALID_TRANSFORM       = 8,
  INVALID_PROTOCOL        = 9,
  UNSUPPORTED_CLIENT_TYPE = 10,
  errorCode               = 0,
  __type = 'TApplicationException'
}

function TApplicationException:__errorCodeToString()
  if self.errorCode == self.UNKNOWN_METHOD then
    return 'Unknown method'
  elseif self.errorCode == self.INVALID_MESSAGE_TYPE then
    return 'Invalid message type'
  elseif self.errorCode == self.WRONG_METHOD_NAME then
    return 'Wrong method name'
  elseif self.errorCode == self.BAD_SEQUENCE_ID then
    return 'Bad sequence ID'
  elseif self.errorCode == self.MISSING_RESULT then
    return 'Missing result'
  elseif self.errorCode == self.INTERNAL_ERROR then
    return 'Internal error'
  elseif self.errorCode == self.PROTOCOL_ERROR then
    return 'Protocol error'
  elseif self.errorCode == self.INVALID_TRANSFORM then
    return 'Invalid transform'
  elseif self.errorCode == self.INVALID_PROTOCOL then
    return 'Invalid protocol'
  elseif self.errorCode == self.UNSUPPORTED_CLIENT_TYPE then
    return 'Unsupported client type'
  else
    return 'Default (unknown)'
  end
end

function TException:read(iprot)
  iprot:readStructBegin()
  while true do
    local fname, ftype, fid = iprot:readFieldBegin()
    if ftype == TType.STOP then
      break
    elseif fid == 1 then
      if ftype == TType.STRING then
        self.message = iprot:readString()
      else
        iprot:skip(ftype)
      end
    elseif fid == 2 then
      if ftype == TType.I32 then
        self.errorCode = iprot:readI32()
      else
        iprot:skip(ftype)
      end
    else
      iprot:skip(ftype)
    end
    iprot:readFieldEnd()
  end
  iprot:readStructEnd()
end

function TException:write(oprot)
  oprot:writeStructBegin('TApplicationException')
  if self.message then
    oprot:writeFieldBegin('message', TType.STRING, 1)
    oprot:writeString(self.message)
    oprot:writeFieldEnd()
  end
  if self.errorCode then
    oprot:writeFieldBegin('type', TType.I32, 2)
    oprot:writeI32(self.errorCode)
    oprot:writeFieldEnd()
  end
  oprot:writeFieldStop()
  oprot:writeStructEnd()
end

-- Basic Client (used in generated lua code)
__TClient = __TObject:new{
  __type = '__TClient',
  _seqid = 0
}
function __TClient:new(obj)
  if ttype(obj) ~= 'table' then
    error('TClient must be initialized with a table')
  end

  -- Set iprot & oprot
  if obj.protocol then
    obj.iprot = obj.protocol
    obj.oprot = obj.protocol
    obj.protocol = nil
  elseif not obj.iprot then
    error('You must provide ' .. ttype(self) .. ' with an iprot')
  end
  if not obj.oprot then
    obj.oprot = obj.iprot
  end

  return __TObject.new(self, obj)
end

function __TClient:close()
  self.iprot.trans:close()
  self.oprot.trans:close()
end

-- Basic Processor (used in generated lua code)
__TProcessor = __TObject:new{
  __type = '__TProcessor'
}
function __TProcessor:new(obj)
  if ttype(obj) ~= 'table' then
    error('TProcessor must be initialized with a table')
  end

  -- Ensure a handler is provided
  if not obj.handler then
    error('You must provide ' .. ttype(self) .. ' with a handler')
  end

  return __TObject.new(self, obj)
end
