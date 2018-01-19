# 
# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements. See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership. The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License. You may obtain a copy of the License at
# 
#   http://www.apache.org/licenses/LICENSE-2.0
# 
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied. See the License for the
# specific language governing permissions and limitations
# under the License.
# 

module Thrift
  class BinaryProtocol < BaseProtocol
    VERSION_MASK = 0xffff0000
    VERSION_1 = 0x80010000
    TYPE_MASK = 0x000000ff
    
    attr_reader :strict_read, :strict_write

    def initialize(trans, strict_read=true, strict_write=true)
      super(trans)
      @strict_read = strict_read
      @strict_write = strict_write

      # Pre-allocated read buffer for fixed-size read methods. Needs to be at least 8 bytes long for
      # read_i64() and read_double().
      @rbuf = Bytes.empty_byte_buffer(8)
    end

    def write_message_begin(name, type, seqid)
      # this is necessary because we added (needed) bounds checking to 
      # write_i32, and 0x80010000 is too big for that.
      if strict_write
        write_i16(VERSION_1 >> 16)
        write_i16(type)
        write_string(name)
        write_i32(seqid)
      else
        write_string(name)
        write_byte(type)
        write_i32(seqid)
      end
    end

    def write_struct_begin(name); nil; end

    def write_field_begin(name, type, id)
      write_byte(type)
      write_i16(id)
    end

    def write_field_stop
      write_byte(Thrift::Types::STOP)
    end

    def write_map_begin(ktype, vtype, size)
      write_byte(ktype)
      write_byte(vtype)
      write_i32(size)
    end

    def write_list_begin(etype, size)
      write_byte(etype)
      write_i32(size)
    end

    def write_set_begin(etype, size)
      write_byte(etype)
      write_i32(size)
    end

    def write_bool(bool)
      write_byte(bool ? 1 : 0)
    end

    def write_byte(byte)
      raise RangeError if byte < -2**31 || byte >= 2**32
      trans.write([byte].pack('c'))
    end

    def write_i16(i16)
      trans.write([i16].pack('n'))
    end

    def write_i32(i32)
      raise RangeError if i32 < -2**31 || i32 >= 2**31
      trans.write([i32].pack('N'))
    end

    def write_i64(i64)
      raise RangeError if i64 < -2**63 || i64 >= 2**64
      hi = i64 >> 32
      lo = i64 & 0xffffffff
      trans.write([hi, lo].pack('N2'))
    end

    def write_double(dub)
      trans.write([dub].pack('G'))
    end

    def write_string(str)
      buf = Bytes.convert_to_utf8_byte_buffer(str)
      write_binary(buf)
    end

    def write_binary(buf)
      write_i32(buf.bytesize)
      trans.write(buf)
    end

    def read_message_begin
      version = read_i32
      if version < 0
        if (version & VERSION_MASK != VERSION_1)
          raise ProtocolException.new(ProtocolException::BAD_VERSION, 'Missing version identifier')
        end
        type = version & TYPE_MASK
        name = read_string
        seqid = read_i32
        [name, type, seqid]
      else
        if strict_read
          raise ProtocolException.new(ProtocolException::BAD_VERSION, 'No version identifier, old protocol client?')
        end
        name = trans.read_all(version)
        type = read_byte
        seqid = read_i32
        [name, type, seqid]
      end
    end

    def read_struct_begin; nil; end

    def read_field_begin
      type = read_byte
      if (type == Types::STOP)
        [nil, type, 0]
      else
        id = read_i16
        [nil, type, id]
      end
    end

    def read_map_begin
      ktype = read_byte
      vtype = read_byte
      size = read_i32
      [ktype, vtype, size]
    end

    def read_list_begin
      etype = read_byte
      size = read_i32
      [etype, size]
    end

    def read_set_begin
      etype = read_byte
      size = read_i32
      [etype, size]
    end

    def read_bool
      byte = read_byte
      byte != 0
    end

    def read_byte
      val = trans.read_byte
      if (val > 0x7f)
        val = 0 - ((val - 1) ^ 0xff)
      end
      val
    end

    def read_i16
      trans.read_into_buffer(@rbuf, 2)
      val, = @rbuf.unpack('n')
      if (val > 0x7fff)
        val = 0 - ((val - 1) ^ 0xffff)
      end
      val
    end

    def read_i32
      trans.read_into_buffer(@rbuf, 4)
      val, = @rbuf.unpack('N')
      if (val > 0x7fffffff)
        val = 0 - ((val - 1) ^ 0xffffffff)
      end
      val
    end

    def read_i64
      trans.read_into_buffer(@rbuf, 8)
      hi, lo = @rbuf.unpack('N2')
      if (hi > 0x7fffffff)
        hi ^= 0xffffffff
        lo ^= 0xffffffff
        0 - (hi << 32) - lo - 1
      else
        (hi << 32) + lo
      end
    end

    def read_double
      trans.read_into_buffer(@rbuf, 8)
      val = @rbuf.unpack('G').first
      val
    end

    def read_string
      buffer = read_binary
      Bytes.convert_to_string(buffer)
    end

    def read_binary
      size = read_i32
      trans.read_all(size)
    end

  end

  class BinaryProtocolFactory < BaseProtocolFactory
    def get_protocol(trans)
      return Thrift::BinaryProtocol.new(trans)
    end
  end
end
