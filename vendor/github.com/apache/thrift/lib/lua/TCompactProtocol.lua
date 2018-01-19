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

require 'TProtocol'
require 'libluabpack'
require 'libluabitwise'
require 'liblualongnumber'

TCompactProtocol = __TObject.new(TProtocolBase, {
  __type = 'TCompactProtocol',
  COMPACT_PROTOCOL_ID       = 0x82,
  COMPACT_VERSION           = 1,
  COMPACT_VERSION_MASK      = 0x1f,
  COMPACT_TYPE_MASK         = 0xE0,
  COMPACT_TYPE_BITS         = 0x07,
  COMPACT_TYPE_SHIFT_AMOUNT = 5,

  -- Used to keep track of the last field for the current and previous structs,
  -- so we can do the delta stuff.
  lastField = {},
  lastFieldId = 0,
  lastFieldIndex = 1,

  -- If we encounter a boolean field begin, save the TField here so it can
  -- have the value incorporated.
  booleanFieldName    = "",
  booleanFieldId      = 0,
  booleanFieldPending = false,

  -- If we read a field header, and it's a boolean field, save the boolean
  -- value here so that readBool can use it.
  boolValue          = false,
  boolValueIsNotNull = false,
})

TCompactType = {
  COMPACT_BOOLEAN_TRUE  = 0x01,
  COMPACT_BOOLEAN_FALSE = 0x02,
  COMPACT_BYTE          = 0x03,
  COMPACT_I16           = 0x04,
  COMPACT_I32           = 0x05,
  COMPACT_I64           = 0x06,
  COMPACT_DOUBLE        = 0x07,
  COMPACT_BINARY        = 0x08,
  COMPACT_LIST          = 0x09,
  COMPACT_SET           = 0x0A,
  COMPACT_MAP           = 0x0B,
  COMPACT_STRUCT        = 0x0C
}

TTypeToCompactType = {}
TTypeToCompactType[TType.STOP]   = TType.STOP
TTypeToCompactType[TType.BOOL]   = TCompactType.COMPACT_BOOLEAN_TRUE
TTypeToCompactType[TType.BYTE]   = TCompactType.COMPACT_BYTE
TTypeToCompactType[TType.I16]    = TCompactType.COMPACT_I16
TTypeToCompactType[TType.I32]    = TCompactType.COMPACT_I32
TTypeToCompactType[TType.I64]    = TCompactType.COMPACT_I64
TTypeToCompactType[TType.DOUBLE] = TCompactType.COMPACT_DOUBLE
TTypeToCompactType[TType.STRING] = TCompactType.COMPACT_BINARY
TTypeToCompactType[TType.LIST]   = TCompactType.COMPACT_LIST
TTypeToCompactType[TType.SET]    = TCompactType.COMPACT_SET
TTypeToCompactType[TType.MAP]    = TCompactType.COMPACT_MAP
TTypeToCompactType[TType.STRUCT] = TCompactType.COMPACT_STRUCT

CompactTypeToTType = {}
CompactTypeToTType[TType.STOP]                        = TType.STOP
CompactTypeToTType[TCompactType.COMPACT_BOOLEAN_TRUE] = TType.BOOL
CompactTypeToTType[TCompactType.COMPACT_BOOLEAN_FALSE] = TType.BOOL
CompactTypeToTType[TCompactType.COMPACT_BYTE]         = TType.BYTE
CompactTypeToTType[TCompactType.COMPACT_I16]          = TType.I16
CompactTypeToTType[TCompactType.COMPACT_I32]          = TType.I32
CompactTypeToTType[TCompactType.COMPACT_I64]          = TType.I64
CompactTypeToTType[TCompactType.COMPACT_DOUBLE]       = TType.DOUBLE
CompactTypeToTType[TCompactType.COMPACT_BINARY]       = TType.STRING
CompactTypeToTType[TCompactType.COMPACT_LIST]         = TType.LIST
CompactTypeToTType[TCompactType.COMPACT_SET]          = TType.SET
CompactTypeToTType[TCompactType.COMPACT_MAP]          = TType.MAP
CompactTypeToTType[TCompactType.COMPACT_STRUCT]       = TType.STRUCT

function TCompactProtocol:resetLastField()
  self.lastField = {}
  self.lastFieldId = 0
  self.lastFieldIndex = 1
end

function TCompactProtocol:packCompactType(ktype, vtype)
  return libluabitwise.bor(libluabitwise.shiftl(ktype, 4), vtype)
end

function TCompactProtocol:writeMessageBegin(name, ttype, seqid)
  self:writeByte(TCompactProtocol.COMPACT_PROTOCOL_ID)
  self:writeByte(libluabpack.packMesgType(TCompactProtocol.COMPACT_VERSION,
    TCompactProtocol.COMPACT_VERSION_MASK,ttype,
    TCompactProtocol.COMPACT_TYPE_SHIFT_AMOUNT,
    TCompactProtocol.COMPACT_TYPE_MASK))
  self:writeVarint32(seqid)
  self:writeString(name)
  self:resetLastField()
end

function TCompactProtocol:writeMessageEnd()
end

function TCompactProtocol:writeStructBegin(name)
  self.lastFieldIndex = self.lastFieldIndex + 1
  self.lastField[self.lastFieldIndex] = self.lastFieldId
  self.lastFieldId = 0
end

function TCompactProtocol:writeStructEnd()
  self.lastFieldIndex = self.lastFieldIndex - 1
  self.lastFieldId = self.lastField[self.lastFieldIndex]
end

function TCompactProtocol:writeFieldBegin(name, ttype, id)
  if ttype == TType.BOOL then
    self.booleanFieldName = name
    self.booleanFieldId   = id
    self.booleanFieldPending = true
  else
    self:writeFieldBeginInternal(name, ttype, id, -1)
  end
end

function TCompactProtocol:writeFieldEnd()
end

function TCompactProtocol:writeFieldStop()
  self:writeByte(TType.STOP);
end

function TCompactProtocol:writeMapBegin(ktype, vtype, size)
  if size == 0 then
    self:writeByte(0)
  else
    self:writeVarint32(size)
    self:writeByte(self:packCompactType(TTypeToCompactType[ktype], TTypeToCompactType[vtype]))
  end
end

function TCompactProtocol:writeMapEnd()
end

function TCompactProtocol:writeListBegin(etype, size)
  self:writeCollectionBegin(etype, size)
end

function TCompactProtocol:writeListEnd()
end

function TCompactProtocol:writeSetBegin(etype, size)
  self:writeCollectionBegin(etype, size)
end

function TCompactProtocol:writeSetEnd()
end

function TCompactProtocol:writeBool(bool)
  local value = TCompactType.COMPACT_BOOLEAN_FALSE
  if bool then
    value = TCompactType.COMPACT_BOOLEAN_TRUE
  end
  print(value,self.booleanFieldPending,self.booleanFieldId)
  if self.booleanFieldPending then
    self:writeFieldBeginInternal(self.booleanFieldName, TType.BOOL, self.booleanFieldId, value)
    self.booleanFieldPending = false
  else
    self:writeByte(value)
  end
end

function TCompactProtocol:writeByte(byte)
  local buff = libluabpack.bpack('c', byte)
  self.trans:write(buff)
end

function TCompactProtocol:writeI16(i16)
  self:writeVarint32(libluabpack.i32ToZigzag(i16))
end

function TCompactProtocol:writeI32(i32)
  self:writeVarint32(libluabpack.i32ToZigzag(i32))
end

function TCompactProtocol:writeI64(i64)
  self:writeVarint64(libluabpack.i64ToZigzag(i64))
end

function TCompactProtocol:writeDouble(dub)
  local buff = libluabpack.bpack('d', dub)
  self.trans:write(buff)
end

function TCompactProtocol:writeString(str)
  -- Should be utf-8
  self:writeBinary(str)
end

function TCompactProtocol:writeBinary(str)
  -- Should be utf-8
  self:writeVarint32(string.len(str))
  self.trans:write(str)
end

function TCompactProtocol:writeFieldBeginInternal(name, ttype, id, typeOverride)
  if typeOverride == -1 then
    typeOverride = TTypeToCompactType[ttype]
  end
  local offset = id - self.lastFieldId
  if id > self.lastFieldId and offset <= 15 then
    self:writeByte(libluabitwise.bor(libluabitwise.shiftl(offset, 4), typeOverride))
  else
    self:writeByte(typeOverride)
    self:writeI16(id)
  end
  self.lastFieldId = id
end

function TCompactProtocol:writeCollectionBegin(etype, size)
  if size <= 14 then
    self:writeByte(libluabitwise.bor(libluabitwise.shiftl(size, 4), TTypeToCompactType[etype]))
  else
    self:writeByte(libluabitwise.bor(0xf0, TTypeToCompactType[etype]))
    self:writeVarint32(size)
  end
end

function TCompactProtocol:writeVarint32(i32)
  -- Should be utf-8
  local str = libluabpack.toVarint32(i32)
  self.trans:write(str)
end

function TCompactProtocol:writeVarint64(i64)
  -- Should be utf-8
  local str = libluabpack.toVarint64(i64)
  self.trans:write(str)
end

function TCompactProtocol:readMessageBegin()
  local protocolId = self:readSignByte()
  if protocolId ~= self.COMPACT_PROTOCOL_ID then
    terror(TProtocolException:new{
      message = "Expected protocol id " .. self.COMPACT_PROTOCOL_ID .. " but got " .. protocolId})
  end
  local versionAndType = self:readSignByte()
  local version = libluabitwise.band(versionAndType, self.COMPACT_VERSION_MASK)
  local ttype = libluabitwise.band(libluabitwise.shiftr(versionAndType,
    self.COMPACT_TYPE_SHIFT_AMOUNT), self.COMPACT_TYPE_BITS)
  if version ~= self.COMPACT_VERSION then
    terror(TProtocolException:new{
      message = "Expected version " .. self.COMPACT_VERSION .. " but got " .. version})
  end
  local seqid = self:readVarint32()
  local name = self:readString()
  return name, ttype, seqid
end

function TCompactProtocol:readMessageEnd()
end

function TCompactProtocol:readStructBegin()
  self.lastField[self.lastFieldIndex] = self.lastFieldId
  self.lastFieldIndex = self.lastFieldIndex + 1
  self.lastFieldId = 0
  return nil
end

function TCompactProtocol:readStructEnd()
  self.lastFieldIndex = self.lastFieldIndex - 1
  self.lastFieldId = self.lastField[self.lastFieldIndex]
end

function TCompactProtocol:readFieldBegin()
  local field_and_ttype = self:readSignByte()
  local ttype = self:getTType(field_and_ttype)
  if ttype == TType.STOP then
    return nil, ttype, 0
  end
  -- mask off the 4 MSB of the type header. it could contain a field id delta.
  local modifier = libluabitwise.shiftr(libluabitwise.band(field_and_ttype, 0xf0), 4)
  local id = 0
  if modifier == 0 then
    id = self:readI16()
  else
    id = self.lastFieldId + modifier
  end
  if ttype == TType.BOOL then
    boolValue = libluabitwise.band(field_and_ttype, 0x0f) == TCompactType.COMPACT_BOOLEAN_TRUE
    boolValueIsNotNull = true
  end
  self.lastFieldId = id
  return nil, ttype, id
end

function TCompactProtocol:readFieldEnd()
end

function TCompactProtocol:readMapBegin()
  local size = self:readVarint32()
  if size < 0 then
    return nil,nil,nil
  end
  local kvtype = self:readSignByte()
  local ktype = self:getTType(libluabitwise.shiftr(kvtype, 4))
  local vtype = self:getTType(kvtype)
  return ktype, vtype, size
end

function TCompactProtocol:readMapEnd()
end

function TCompactProtocol:readListBegin()
  local size_and_type = self:readSignByte()
  local size = libluabitwise.band(libluabitwise.shiftr(size_and_type, 4), 0x0f)
  if size == 15 then
    size = self:readVarint32()
  end
  if size < 0 then
    return nil,nil
  end
  local etype = self:getTType(libluabitwise.band(size_and_type, 0x0f))
  return etype, size
end

function TCompactProtocol:readListEnd()
end

function TCompactProtocol:readSetBegin()
  return self:readListBegin()
end

function TCompactProtocol:readSetEnd()
end

function TCompactProtocol:readBool()
  if boolValueIsNotNull then
    boolValueIsNotNull = true
    return boolValue
  end
  local val = self:readSignByte()
  if val == TCompactType.COMPACT_BOOLEAN_TRUE then
    return true
  end
  return false
end

function TCompactProtocol:readByte()
  local buff = self.trans:readAll(1)
  local val = libluabpack.bunpack('c', buff)
  return val
end

function TCompactProtocol:readSignByte()
  local buff = self.trans:readAll(1)
  local val = libluabpack.bunpack('C', buff)
  return val
end

function TCompactProtocol:readI16()
  return self:readI32()
end

function TCompactProtocol:readI32()
  local v = self:readVarint32()
  local value = libluabpack.zigzagToI32(v)
  return value
end

function TCompactProtocol:readI64()
  local value = self:readVarint64()
  return value
end

function TCompactProtocol:readDouble()
  local buff = self.trans:readAll(8)
  local val = libluabpack.bunpack('d', buff)
  return val
end

function TCompactProtocol:readString()
  return self:readBinary()
end

function TCompactProtocol:readBinary()
  local size = self:readVarint32()
  if size <= 0 then
    return ""
  end
  return self.trans:readAll(size)
end

function TCompactProtocol:readVarint32()
  local shiftl = 0
  local result = 0
  while true do
    b = self:readByte()
    result = libluabitwise.bor(result,
             libluabitwise.shiftl(libluabitwise.band(b, 0x7f), shiftl))
    if libluabitwise.band(b, 0x80) ~= 0x80 then
      break
    end
    shiftl = shiftl + 7
  end
  return result
end

function TCompactProtocol:readVarint64()
  local result = liblualongnumber.new
  local data = result(0)
  local shiftl = 0
  while true do
    b = self:readByte()
    endFlag, data = libluabpack.fromVarint64(b, shiftl, data)
    shiftl = shiftl + 7
    if endFlag == 0 then
      break
    end
  end
  return data
end

function TCompactProtocol:getTType(ctype)
  return CompactTypeToTType[libluabitwise.band(ctype, 0x0f)]
end

TCompactProtocolFactory = TProtocolFactory:new{
  __type = 'TCompactProtocolFactory',
}

function TCompactProtocolFactory:getProtocol(trans)
  -- TODO Enforce that this must be a transport class (ie not a bool)
  if not trans then
    terror(TProtocolException:new{
      message = 'Must supply a transport to ' .. ttype(self)
    })
  end
  return TCompactProtocol:new{
    trans = trans
  }
end
