--
-- Licensed to the Apache Software Foundation (ASF) under one
-- or more contributor license agreements. See the NOTICE file
-- distributed with this work for additional information
-- regarding copyright ownership. The ASF licenses this file
-- to you under the Apache License, Version 2.0 (the
-- "License"), you may not use this file except in compliance
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

TJSONProtocol = __TObject.new(TProtocolBase, {
  __type = 'TJSONProtocol',
  THRIFT_JSON_PROTOCOL_VERSION = 1,
  jsonContext = {},
  jsonContextVal = {first = true, colon = true, ttype = 2, null = true},
  jsonContextIndex = 1,
  hasReadByte = ""
})

TTypeToString = {}
TTypeToString[TType.BOOL]   = "tf"
TTypeToString[TType.BYTE]   = "i8"
TTypeToString[TType.I16]    = "i16"
TTypeToString[TType.I32]    = "i32"
TTypeToString[TType.I64]    = "i64"
TTypeToString[TType.DOUBLE] = "dbl"
TTypeToString[TType.STRING] = "str"
TTypeToString[TType.STRUCT] = "rec"
TTypeToString[TType.LIST]   = "lst"
TTypeToString[TType.SET]    = "set"
TTypeToString[TType.MAP]    = "map"

StringToTType = {
  tf  = TType.BOOL,
  i8  = TType.BYTE,
  i16 = TType.I16,
  i32 = TType.I32,
  i64 = TType.I64,
  dbl = TType.DOUBLE,
  str = TType.STRING,
  rec = TType.STRUCT,
  map = TType.MAP,
  set = TType.SET,
  lst = TType.LIST
}

JSONNode = {
  ObjectBegin = '{',
  ObjectEnd = '}',
  ArrayBegin = '[',
  ArrayEnd = ']',
  PairSeparator = ':',
  ElemSeparator = ',',
  Backslash = '\\',
  StringDelimiter = '"',
  ZeroChar = '0',
  EscapeChar = 'u',
  Nan = 'NaN',
  Infinity = 'Infinity',
  NegativeInfinity = '-Infinity',
  EscapeChars = "\"\\bfnrt",
  EscapePrefix = "\\u00"
}

EscapeCharVals = {
  '"', '\\', '\b', '\f', '\n', '\r', '\t'
}

JSONCharTable = {
  --0   1   2   3   4   5   6   7   8   9   A   B   C   D   E   F
    0,  0,  0,  0,  0,  0,  0,  0, 98,116,110,  0,102,114,  0,  0,
    0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,
    1,  1,34,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,
}

-- character table string
local b='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

-- encoding
function base64_encode(data)
    return ((data:gsub('.', function(x) 
        local r,b='',x:byte()
        for i=8,1,-1 do r=r..(b%2^i-b%2^(i-1)>0 and '1' or '0') end
        return r;
    end)..'0000'):gsub('%d%d%d?%d?%d?%d?', function(x)
        if (#x < 6) then return '' end
        local c=0
        for i=1,6 do c=c+(x:sub(i,i)=='1' and 2^(6-i) or 0) end
        return b:sub(c+1,c+1)
    end)..({ '', '==', '=' })[#data%3+1])
end

-- decoding
function base64_decode(data)
    data = string.gsub(data, '[^'..b..'=]', '')
    return (data:gsub('.', function(x)
        if (x == '=') then return '' end
        local r,f='',(b:find(x)-1)
        for i=6,1,-1 do r=r..(f%2^i-f%2^(i-1)>0 and '1' or '0') end
        return r;
    end):gsub('%d%d%d?%d?%d?%d?%d?%d?', function(x)
        if (#x ~= 8) then return '' end
        local c=0
        for i=1,8 do c=c+(x:sub(i,i)=='1' and 2^(8-i) or 0) end
        return string.char(c)
    end))
end

function TJSONProtocol:resetContext()
  self.jsonContext = {}
  self.jsonContextVal = {first = true, colon = true, ttype = 2, null = true}
  self.jsonContextIndex = 1
end

function TJSONProtocol:contextPush(context)
  self.jsonContextIndex = self.jsonContextIndex + 1
  self.jsonContext[self.jsonContextIndex] = self.jsonContextVal
  self.jsonContextVal = context
end

function TJSONProtocol:contextPop()
  self.jsonContextVal = self.jsonContext[self.jsonContextIndex]
  self.jsonContextIndex = self.jsonContextIndex - 1
end

function TJSONProtocol:escapeNum()
  if self.jsonContextVal.ttype == 1 then
    return self.jsonContextVal.colon
  else
    return false
  end
end

function TJSONProtocol:writeElemSeparator()
  if self.jsonContextVal.null then
    return
  end
  if self.jsonContextVal.first then
    self.jsonContextVal.first = false
  else
    if self.jsonContextVal.ttype == 1 then
      if self.jsonContextVal.colon then
        self.trans:write(JSONNode.PairSeparator)
        self.jsonContextVal.colon = false
      else
        self.trans:write(JSONNode.ElemSeparator)
        self.jsonContextVal.colon = true
      end
    else
      self.trans:write(JSONNode.ElemSeparator)
    end
  end
end

function TJSONProtocol:hexChar(val)
  val = libluabitwise.band(val, 0x0f)
  if val < 10 then
    return val + 48
  else
    return val + 87
  end
end

function TJSONProtocol:writeJSONEscapeChar(ch)
  self.trans:write(JSONNode.EscapePrefix)
  local outCh = hexChar(libluabitwise.shiftr(ch, 4))
  local buff = libluabpack.bpack('c', outCh)
  self.trans:write(buff)
  outCh = hexChar(ch)
  buff = libluabpack.bpack('c', outCh)
  self.trans:write(buff)
end

function TJSONProtocol:writeJSONChar(byte)
  ch = string.byte(byte)
  if ch >= 0x30 then
    if ch == JSONNode.Backslash then
      self.trans:write(JSONNode.Backslash)
      self.trans:write(JSONNode.Backslash)
    else
      self.trans:write(byte)
    end
  else
    local outCh = JSONCharTable[ch+1]
    if outCh == 1 then
      self.trans:write(byte)
    elseif outCh > 1 then
      self.trans:write(JSONNode.Backslash)
      local buff = libluabpack.bpack('c', outCh)
      self.trans:write(buff)
    else
      self:writeJSONEscapeChar(ch)
    end
  end
end

function TJSONProtocol:writeJSONString(str)
  self:writeElemSeparator()
  self.trans:write(JSONNode.StringDelimiter)
  -- TODO escape special characters
  local length = string.len(str)
  local ii = 1
  while ii <= length do
    self:writeJSONChar(string.sub(str, ii, ii))
    ii = ii + 1
  end
  self.trans:write(JSONNode.StringDelimiter)
end

function TJSONProtocol:writeJSONBase64(str)
  self:writeElemSeparator()
  self.trans:write(JSONNode.StringDelimiter)
  local length = string.len(str)
  local offset = 1
  while length >= 3 do
    -- Encode 3 bytes at a time
    local bytes = base64_encode(string.sub(str, offset, offset+3))
    self.trans:write(bytes)
    length = length - 3
    offset = offset + 3
  end
  if length > 0 then
    local bytes = base64_encode(string.sub(str, offset, offset+length))
    self.trans:write(bytes)
  end
  self.trans:write(JSONNode.StringDelimiter)
end

function TJSONProtocol:writeJSONInteger(num)
  self:writeElemSeparator()
  if self:escapeNum() then
    self.trans:write(JSONNode.StringDelimiter)
  end
  local numstr = "" .. num
  numstr = string.sub(numstr, string.find(numstr, "^[+-]?%d+"))
  self.trans:write(numstr)
  if self:escapeNum() then
    self.trans:write(JSONNode.StringDelimiter)
  end
end

function TJSONProtocol:writeJSONDouble(dub)
  self:writeElemSeparator()
  local val = "" .. dub
  local prefix = string.sub(val, 1, 1)
  local special = false
  if prefix == 'N' or prefix == 'n' then
    val = JSONNode.Nan
    special = true
  elseif prefix == 'I' or prefix == 'i' then
    val = JSONNode.Infinity
    special = true
  elseif prefix == '-' then
    local secondByte = string.sub(val, 2, 2)
    if secondByte == 'I' or secondByte == 'i' then
      val = JSONNode.NegativeInfinity
      special = true
    end
  end

  if special or self:escapeNum() then
    self.trans:write(JSONNode.StringDelimiter)
  end
  self.trans:write(val)
  if special or self:escapeNum() then
    self.trans:write(JSONNode.StringDelimiter)
  end
end

function TJSONProtocol:writeJSONObjectBegin()
  self:writeElemSeparator()
  self.trans:write(JSONNode.ObjectBegin)
  self:contextPush({first = true, colon = true, ttype = 1, null = false})
end

function TJSONProtocol:writeJSONObjectEnd()
  self:contextPop()
  self.trans:write(JSONNode.ObjectEnd)
end

function TJSONProtocol:writeJSONArrayBegin()
  self:writeElemSeparator()
  self.trans:write(JSONNode.ArrayBegin)
  self:contextPush({first = true, colon = true, ttype = 2, null = false})
end

function TJSONProtocol:writeJSONArrayEnd()
  self:contextPop()
  self.trans:write(JSONNode.ArrayEnd)
end

function TJSONProtocol:writeMessageBegin(name, ttype, seqid)
  self:resetContext()
  self:writeJSONArrayBegin()
  self:writeJSONInteger(TJSONProtocol.THRIFT_JSON_PROTOCOL_VERSION)
  self:writeJSONString(name)
  self:writeJSONInteger(ttype)
  self:writeJSONInteger(seqid)
end

function TJSONProtocol:writeMessageEnd()
  self:writeJSONArrayEnd()
end

function TJSONProtocol:writeStructBegin(name)
  self:writeJSONObjectBegin()
end

function TJSONProtocol:writeStructEnd()
  self:writeJSONObjectEnd()
end

function TJSONProtocol:writeFieldBegin(name, ttype, id)
  self:writeJSONInteger(id)
  self:writeJSONObjectBegin()
  self:writeJSONString(TTypeToString[ttype])
end

function TJSONProtocol:writeFieldEnd()
  self:writeJSONObjectEnd()
end

function TJSONProtocol:writeFieldStop()
end

function TJSONProtocol:writeMapBegin(ktype, vtype, size)
  self:writeJSONArrayBegin()
  self:writeJSONString(TTypeToString[ktype])
  self:writeJSONString(TTypeToString[vtype])
  self:writeJSONInteger(size)
  return self:writeJSONObjectBegin()
end

function TJSONProtocol:writeMapEnd()
  self:writeJSONObjectEnd()
  self:writeJSONArrayEnd()
end

function TJSONProtocol:writeListBegin(etype, size)
  self:writeJSONArrayBegin()
  self:writeJSONString(TTypeToString[etype])
  self:writeJSONInteger(size)
end

function TJSONProtocol:writeListEnd()
  self:writeJSONArrayEnd()
end

function TJSONProtocol:writeSetBegin(etype, size)
  self:writeJSONArrayBegin()
  self:writeJSONString(TTypeToString[etype])
  self:writeJSONInteger(size)
end

function TJSONProtocol:writeSetEnd()
  self:writeJSONArrayEnd()
end

function TJSONProtocol:writeBool(bool)
  if bool then
    self:writeJSONInteger(1)
  else
    self:writeJSONInteger(0)
  end
end

function TJSONProtocol:writeByte(byte)
  local buff = libluabpack.bpack('c', byte)
  local val = libluabpack.bunpack('c', buff)
  self:writeJSONInteger(val)
end

function TJSONProtocol:writeI16(i16)
  local buff = libluabpack.bpack('s', i16)
  local val = libluabpack.bunpack('s', buff)
  self:writeJSONInteger(val)
end

function TJSONProtocol:writeI32(i32)
  local buff = libluabpack.bpack('i', i32)
  local val = libluabpack.bunpack('i', buff)
  self:writeJSONInteger(val)
end

function TJSONProtocol:writeI64(i64)
  local buff = libluabpack.bpack('l', i64)
  local val = libluabpack.bunpack('l', buff)
  self:writeJSONInteger(tostring(val))
end

function TJSONProtocol:writeDouble(dub)
  self:writeJSONDouble(string.format("%.16f", dub))
end

function TJSONProtocol:writeString(str)
  self:writeJSONString(str)
end

function TJSONProtocol:writeBinary(str)
  -- Should be utf-8
  self:writeJSONBase64(str)
end

function TJSONProtocol:readJSONSyntaxChar(ch)
  local ch2 = ""
  if self.hasReadByte ~= "" then
    ch2 = self.hasReadByte
    self.hasReadByte = ""
  else
    ch2 = self.trans:readAll(1)
  end
  if ch2 ~= ch then
    terror(TProtocolException:new{message = "Expected ".. ch .. ", got " .. ch2})
  end
end

function TJSONProtocol:readElemSeparator()
  if self.jsonContextVal.null then
    return
  end
  if self.jsonContextVal.first then
    self.jsonContextVal.first = false
  else
    if self.jsonContextVal.ttype == 1 then
      if self.jsonContextVal.colon then
        self:readJSONSyntaxChar(JSONNode.PairSeparator)
        self.jsonContextVal.colon = false
      else
        self:readJSONSyntaxChar(JSONNode.ElemSeparator)
        self.jsonContextVal.colon = true
      end
    else
      self:readJSONSyntaxChar(JSONNode.ElemSeparator)
    end
  end
end

function TJSONProtocol:hexVal(ch)
  local val = string.byte(ch)
  if val >= 48 and val <= 57 then
    return val - 48
  elseif val >= 97 and val <= 102 then
    return val - 87
  else
    terror(TProtocolException:new{message = "Expected hex val ([0-9a-f]); got " .. ch})
  end
end

function TJSONProtocol:readJSONEscapeChar(ch)
  self:readJSONSyntaxChar(JSONNode.ZeroChar)
  self:readJSONSyntaxChar(JSONNode.ZeroChar)
  local b1 = self.trans:readAll(1)
  local b2 = self.trans:readAll(1)
  return libluabitwise.shiftl(self:hexVal(b1), 4) + self:hexVal(b2)
end


function TJSONProtocol:readJSONString()
  self:readElemSeparator()
  self:readJSONSyntaxChar(JSONNode.StringDelimiter)
  local result = ""
  while true do
    local ch = self.trans:readAll(1)
    if ch == JSONNode.StringDelimiter then
      break
    end
    if ch == JSONNode.Backslash then
      ch = self.trans:readAll(1)
      if ch == JSONNode.EscapeChar then
        self:readJSONEscapeChar(ch)
      else
        local pos, _ = string.find(JSONNode.EscapeChars, ch)
        if pos == nil then
          terror(TProtocolException:new{message = "Expected control char, got " .. ch})
        end
        ch = EscapeCharVals[pos]
      end
    end
    result = result .. ch
  end
  return result
end

function TJSONProtocol:readJSONBase64()
  local result = self:readJSONString()
  local length = string.len(result)
  local str = ""
  local offset = 1
  while length >= 4 do
    local bytes = string.sub(result, offset, offset+4)
    str = str .. base64_decode(bytes)
    offset = offset + 4
    length = length - 4
  end
  if length >= 0 then
    str = str .. base64_decode(string.sub(result, offset, offset + length))
  end
  return str
end

function TJSONProtocol:readJSONNumericChars()
  local result = ""
  while true do
    local ch = self.trans:readAll(1)
    if string.find(ch, '[-+0-9.Ee]') then
      result = result .. ch
    else
      self.hasReadByte = ch
      break
    end
  end
  return result
end

function TJSONProtocol:readJSONLongInteger()
  self:readElemSeparator()
  if self:escapeNum() then
    self:readJSONSyntaxChar(JSONNode.StringDelimiter)
  end
  local result = self:readJSONNumericChars()
  if self:escapeNum() then
    self:readJSONSyntaxChar(JSONNode.StringDelimiter)
  end
  return result
end

function TJSONProtocol:readJSONInteger()
  return tonumber(self:readJSONLongInteger())
end

function TJSONProtocol:readJSONDouble()
  self:readElemSeparator()
  local delimiter = self.trans:readAll(1)
  local num = 0.0
  if delimiter == JSONNode.StringDelimiter then
    local str = self:readJSONString()
    if str == JSONNode.Nan then
      num = 1.0
    elseif str == JSONNode.Infinity then
      num = math.maxinteger
    elseif str == JSONNode.NegativeInfinity then
      num = math.mininteger
    else
      num = tonumber(str)
    end
  else
    if self:escapeNum() then
      self:readJSONSyntaxChar(JSONNode.StringDelimiter)
    end
    local result = self:readJSONNumericChars()
    num = tonumber(delimiter.. result)
  end
  return num
end

function TJSONProtocol:readJSONObjectBegin()
  self:readElemSeparator()
  self:readJSONSyntaxChar(JSONNode.ObjectBegin)
  self:contextPush({first = true, colon = true, ttype = 1, null = false})
end

function TJSONProtocol:readJSONObjectEnd()
  self:readJSONSyntaxChar(JSONNode.ObjectEnd)
  self:contextPop()
end

function TJSONProtocol:readJSONArrayBegin()
  self:readElemSeparator()
  self:readJSONSyntaxChar(JSONNode.ArrayBegin)
  self:contextPush({first = true, colon = true, ttype = 2, null = false})
end

function TJSONProtocol:readJSONArrayEnd()
  self:readJSONSyntaxChar(JSONNode.ArrayEnd)
  self:contextPop()
end

function TJSONProtocol:readMessageBegin()
  self:resetContext()
  self:readJSONArrayBegin()
  local version = self:readJSONInteger()
  if version ~= self.THRIFT_JSON_PROTOCOL_VERSION then
    terror(TProtocolException:new{message = "Message contained bad version."})
  end
  local name = self:readJSONString()
  local ttype = self:readJSONInteger()
  local seqid = self:readJSONInteger()
  return name, ttype, seqid
end

function TJSONProtocol:readMessageEnd()
  self:readJSONArrayEnd()
end

function TJSONProtocol:readStructBegin()
  self:readJSONObjectBegin()
  return nil
end

function TJSONProtocol:readStructEnd()
  self:readJSONObjectEnd()
end

function TJSONProtocol:readFieldBegin()
  local ttype = TType.STOP
  local id = 0
  local ch = self.trans:readAll(1)
  self.hasReadByte = ch
  if ch ~= JSONNode.ObjectEnd then
    id = self:readJSONInteger()
    self:readJSONObjectBegin()
    local typeName = self:readJSONString()
    ttype = StringToTType[typeName]
  end
  return nil, ttype, id
end

function TJSONProtocol:readFieldEnd()
  self:readJSONObjectEnd()
end

function TJSONProtocol:readMapBegin()
  self:readJSONArrayBegin()
  local typeName = self:readJSONString()
  local ktype = StringToTType[typeName]
  typeName = self:readJSONString()
  local vtype = StringToTType[typeName]
  local size = self:readJSONInteger()
  self:readJSONObjectBegin()
  return ktype, vtype, size
end

function TJSONProtocol:readMapEnd()
  self:readJSONObjectEnd()
  self:readJSONArrayEnd()
end

function TJSONProtocol:readListBegin()
  self:readJSONArrayBegin()
  local typeName = self:readJSONString()
  local etype = StringToTType[typeName]
  local size = self:readJSONInteger()
  return etype, size
end

function TJSONProtocol:readListEnd()
  return self:readJSONArrayEnd()
end

function TJSONProtocol:readSetBegin()
  return self:readListBegin()
end

function TJSONProtocol:readSetEnd()
  return self:readJSONArrayEnd()
end

function TJSONProtocol:readBool()
  local result = self:readJSONInteger()
  if result == 1 then
    return true
  else
    return false
  end
end

function TJSONProtocol:readByte()
  local result = self:readJSONInteger()
  if result >= 256 then
    terror(TProtocolException:new{message = "UnExpected Byte " .. result})
  end
  return result
end

function TJSONProtocol:readI16()
  return self:readJSONInteger()
end

function TJSONProtocol:readI32()
  return self:readJSONInteger()
end

function TJSONProtocol:readI64()
  local long = liblualongnumber.new
  return long(self:readJSONLongInteger())
end

function TJSONProtocol:readDouble()
  return self:readJSONDouble()
end

function TJSONProtocol:readString()
  return self:readJSONString()
end

function TJSONProtocol:readBinary()
  return self:readJSONBase64()
end

TJSONProtocolFactory = TProtocolFactory:new{
  __type = 'TJSONProtocolFactory',
}

function TJSONProtocolFactory:getProtocol(trans)
  -- TODO Enforce that this must be a transport class (ie not a bool)
  if not trans then
    terror(TProtocolException:new{
      message = 'Must supply a transport to ' .. ttype(self)
    })
  end
  return TJSONProtocol:new{
    trans = trans
  }
end
