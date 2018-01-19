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

TProtocolException = TException:new {
  UNKNOWN          = 0,
  INVALID_DATA     = 1,
  NEGATIVE_SIZE    = 2,
  SIZE_LIMIT       = 3,
  BAD_VERSION      = 4,
  INVALID_PROTOCOL = 5,
  DEPTH_LIMIT      = 6,
  errorCode        = 0,
  __type = 'TProtocolException'
}
function TProtocolException:__errorCodeToString()
  if self.errorCode == self.INVALID_DATA then
    return 'Invalid data'
  elseif self.errorCode == self.NEGATIVE_SIZE then
    return 'Negative size'
  elseif self.errorCode == self.SIZE_LIMIT then
    return 'Size limit'
  elseif self.errorCode == self.BAD_VERSION then
    return 'Bad version'
  elseif self.errorCode == self.INVALID_PROTOCOL then
    return 'Invalid protocol'
  elseif self.errorCode == self.DEPTH_LIMIT then
    return 'Exceeded size limit'
  else
    return 'Default (unknown)'
  end
end

TProtocolBase = __TObject:new{
  __type = 'TProtocolBase',
  trans
}

function TProtocolBase:new(obj)
  if ttype(obj) ~= 'table' then
    error(ttype(self) .. 'must be initialized with a table')
  end

  -- Ensure a transport is provided
  if not obj.trans then
    error('You must provide ' .. ttype(self) .. ' with a trans')
  end

  return __TObject.new(self, obj)
end

function TProtocolBase:writeMessageBegin(name, ttype, seqid) end
function TProtocolBase:writeMessageEnd() end
function TProtocolBase:writeStructBegin(name) end
function TProtocolBase:writeStructEnd() end
function TProtocolBase:writeFieldBegin(name, ttype, id) end
function TProtocolBase:writeFieldEnd() end
function TProtocolBase:writeFieldStop() end
function TProtocolBase:writeMapBegin(ktype, vtype, size) end
function TProtocolBase:writeMapEnd() end
function TProtocolBase:writeListBegin(ttype, size) end
function TProtocolBase:writeListEnd() end
function TProtocolBase:writeSetBegin(ttype, size) end
function TProtocolBase:writeSetEnd() end
function TProtocolBase:writeBool(bool) end
function TProtocolBase:writeByte(byte) end
function TProtocolBase:writeI16(i16) end
function TProtocolBase:writeI32(i32) end
function TProtocolBase:writeI64(i64) end
function TProtocolBase:writeDouble(dub) end
function TProtocolBase:writeString(str) end
function TProtocolBase:readMessageBegin() end
function TProtocolBase:readMessageEnd() end
function TProtocolBase:readStructBegin() end
function TProtocolBase:readStructEnd() end
function TProtocolBase:readFieldBegin() end
function TProtocolBase:readFieldEnd() end
function TProtocolBase:readMapBegin() end
function TProtocolBase:readMapEnd() end
function TProtocolBase:readListBegin() end
function TProtocolBase:readListEnd() end
function TProtocolBase:readSetBegin() end
function TProtocolBase:readSetEnd() end
function TProtocolBase:readBool() end
function TProtocolBase:readByte() end
function TProtocolBase:readI16() end
function TProtocolBase:readI32() end
function TProtocolBase:readI64() end
function TProtocolBase:readDouble() end
function TProtocolBase:readString() end

function TProtocolBase:skip(ttype)
  if type == TType.STOP then
    return
  elseif ttype == TType.BOOL then
    self:readBool()
  elseif ttype == TType.BYTE then
    self:readByte()
  elseif ttype == TType.I16 then
    self:readI16()
  elseif ttype == TType.I32 then
    self:readI32()
  elseif ttype == TType.I64 then
    self:readI64()
  elseif ttype == TType.DOUBLE then
    self:readDouble()
  elseif ttype == TType.STRING then
    self:readString()
  elseif ttype == TType.STRUCT then
    local name = self:readStructBegin()
    while true do
      local name, ttype, id = self:readFieldBegin()
      if ttype == TType.STOP then
        break
      end
      self:skip(ttype)
      self:readFieldEnd()
    end
    self:readStructEnd()
  elseif ttype == TType.MAP then
    local kttype, vttype, size = self:readMapBegin()
    for i = 1, size, 1 do
      self:skip(kttype)
      self:skip(vttype)
    end
    self:readMapEnd()
  elseif ttype == TType.SET then
    local ettype, size = self:readSetBegin()
    for i = 1, size, 1 do
      self:skip(ettype)
    end
    self:readSetEnd()
  elseif ttype == TType.LIST then
    local ettype, size = self:readListBegin()
    for i = 1, size, 1 do
      self:skip(ettype)
    end
    self:readListEnd()
  end
end

TProtocolFactory = __TObject:new{
  __type = 'TProtocolFactory',
}
function TProtocolFactory:getProtocol(trans) end
