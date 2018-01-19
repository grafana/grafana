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

# this require is to make generated struct definitions happy
require 'set'

module Thrift
  class ProtocolException < Exception

    UNKNOWN = 0
    INVALID_DATA = 1
    NEGATIVE_SIZE = 2
    SIZE_LIMIT = 3
    BAD_VERSION = 4
    NOT_IMPLEMENTED = 5
    DEPTH_LIMIT = 6

    attr_reader :type

    def initialize(type=UNKNOWN, message=nil)
      super(message)
      @type = type
    end
  end

  class BaseProtocol

    attr_reader :trans

    def initialize(trans)
      @trans = trans
    end

    def native?
      puts "wrong method is being called!"
      false
    end

    def write_message_begin(name, type, seqid)
      raise NotImplementedError
    end

    def write_message_end; nil; end

    def write_struct_begin(name)
      raise NotImplementedError
    end

    def write_struct_end; nil; end

    def write_field_begin(name, type, id)
      raise NotImplementedError
    end

    def write_field_end; nil; end

    def write_field_stop
      raise NotImplementedError
    end

    def write_map_begin(ktype, vtype, size)
      raise NotImplementedError
    end

    def write_map_end; nil; end

    def write_list_begin(etype, size)
      raise NotImplementedError
    end

    def write_list_end; nil; end

    def write_set_begin(etype, size)
      raise NotImplementedError
    end

    def write_set_end; nil; end

    def write_bool(bool)
      raise NotImplementedError
    end

    def write_byte(byte)
      raise NotImplementedError
    end

    def write_i16(i16)
      raise NotImplementedError
    end

    def write_i32(i32)
      raise NotImplementedError
    end

    def write_i64(i64)
      raise NotImplementedError
    end

    def write_double(dub)
      raise NotImplementedError
    end

    # Writes a Thrift String. In Ruby 1.9+, the String passed will be transcoded to UTF-8.
    #
    # str - The String to write.
    #
    # Raises EncodingError if the transcoding to UTF-8 fails.
    #
    # Returns nothing.
    def write_string(str)
      raise NotImplementedError
    end

    # Writes a Thrift Binary (Thrift String with no encoding). In Ruby 1.9+, the String passed
    # will forced into BINARY encoding.
    #
    # buf - The String to write.
    #
    # Returns nothing.
    def write_binary(buf)
      raise NotImplementedError
    end

    def read_message_begin
      raise NotImplementedError
    end

    def read_message_end; nil; end

    def read_struct_begin
      raise NotImplementedError
    end

    def read_struct_end; nil; end

    def read_field_begin
      raise NotImplementedError
    end

    def read_field_end; nil; end

    def read_map_begin
      raise NotImplementedError
    end

    def read_map_end; nil; end

    def read_list_begin
      raise NotImplementedError
    end

    def read_list_end; nil; end

    def read_set_begin
      raise NotImplementedError
    end

    def read_set_end; nil; end

    def read_bool
      raise NotImplementedError
    end

    def read_byte
      raise NotImplementedError
    end

    def read_i16
      raise NotImplementedError
    end

    def read_i32
      raise NotImplementedError
    end

    def read_i64
      raise NotImplementedError
    end

    def read_double
      raise NotImplementedError
    end

    # Reads a Thrift String. In Ruby 1.9+, all Strings will be returned with an Encoding of UTF-8.
    #
    # Returns a String.
    def read_string
      raise NotImplementedError
    end

    # Reads a Thrift Binary (Thrift String without encoding). In Ruby 1.9+, all Strings will be returned
    # with an Encoding of BINARY.
    #
    # Returns a String.
    def read_binary
      raise NotImplementedError
    end

    # Writes a field based on the field information, field ID and value.
    #
    # field_info - A Hash containing the definition of the field:
    #              :name   - The name of the field.
    #              :type   - The type of the field, which must be a Thrift::Types constant.
    #              :binary - A Boolean flag that indicates if Thrift::Types::STRING is a binary string (string without encoding).
    # fid        - The ID of the field.
    # value      - The field's value to write; object type varies based on :type.
    #
    # Returns nothing.
    def write_field(*args)
      if args.size == 3
        # handles the documented method signature - write_field(field_info, fid, value)
        field_info = args[0]
        fid = args[1]
        value = args[2]
      elsif args.size == 4
        # handles the deprecated method signature - write_field(name, type, fid, value)
        field_info = {:name => args[0], :type => args[1]}
        fid = args[2]
        value = args[3]
      else
        raise ArgumentError, "wrong number of arguments (#{args.size} for 3)"
      end

      write_field_begin(field_info[:name], field_info[:type], fid)
      write_type(field_info, value)
      write_field_end
    end

    # Writes a field value based on the field information.
    #
    # field_info - A Hash containing the definition of the field:
    #              :type   - The Thrift::Types constant that determines how the value is written.
    #              :binary - A Boolean flag that indicates if Thrift::Types::STRING is a binary string (string without encoding).
    # value      - The field's value to write; object type varies based on field_info[:type].
    #
    # Returns nothing.
    def write_type(field_info, value)
      # if field_info is a Fixnum, assume it is a Thrift::Types constant
      # convert it into a field_info Hash for backwards compatibility
      if field_info.is_a? Fixnum
        field_info = {:type => field_info}
      end

      case field_info[:type]
      when Types::BOOL
        write_bool(value)
      when Types::BYTE
        write_byte(value)
      when Types::DOUBLE
        write_double(value)
      when Types::I16
        write_i16(value)
      when Types::I32
        write_i32(value)
      when Types::I64
        write_i64(value)
      when Types::STRING
        if field_info[:binary]
          write_binary(value)
        else
          write_string(value)
        end
      when Types::STRUCT
        value.write(self)
      else
        raise NotImplementedError
      end
    end

    # Reads a field value based on the field information.
    #
    # field_info - A Hash containing the pertinent data to write:
    #              :type   - The Thrift::Types constant that determines how the value is written.
    #              :binary - A flag that indicates if Thrift::Types::STRING is a binary string (string without encoding).
    #
    # Returns the value read; object type varies based on field_info[:type].
    def read_type(field_info)
      # if field_info is a Fixnum, assume it is a Thrift::Types constant
      # convert it into a field_info Hash for backwards compatibility
      if field_info.is_a? Fixnum
        field_info = {:type => field_info}
      end

      case field_info[:type]
      when Types::BOOL
        read_bool
      when Types::BYTE
        read_byte
      when Types::DOUBLE
        read_double
      when Types::I16
        read_i16
      when Types::I32
        read_i32
      when Types::I64
        read_i64
      when Types::STRING
        if field_info[:binary]
          read_binary
        else
          read_string
        end
      else
        raise NotImplementedError
      end
    end

    def skip(type)
      case type
      when Types::STOP
        nil
      when Types::BOOL
        read_bool
      when Types::BYTE
        read_byte
      when Types::I16
        read_i16
      when Types::I32
        read_i32
      when Types::I64
        read_i64
      when Types::DOUBLE
        read_double
      when Types::STRING
        read_string
      when Types::STRUCT
        read_struct_begin
        while true
          name, type, id = read_field_begin
          break if type == Types::STOP
          skip(type)
          read_field_end
        end
        read_struct_end
      when Types::MAP
        ktype, vtype, size = read_map_begin
        size.times do
          skip(ktype)
          skip(vtype)
        end
        read_map_end
      when Types::SET
        etype, size = read_set_begin
        size.times do
          skip(etype)
        end
        read_set_end
      when Types::LIST
        etype, size = read_list_begin
        size.times do
          skip(etype)
        end
        read_list_end
      end
    end
  end

  class BaseProtocolFactory
    def get_protocol(trans)
      raise NotImplementedError
    end
  end
end