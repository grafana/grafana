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

module Thrift
  module ProtocolDecorator

    def initialize(protocol)
      @protocol = protocol
    end

    def trans
      @protocol.trans
    end

    def write_message_begin(name, type, seqid)
      @protocol.write_message_begin
    end

    def write_message_end
      @protocol.write_message_end
    end

    def write_struct_begin(name)
      @protocol.write_struct_begin(name)
    end

    def write_struct_end
      @protocol.write_struct_end
    end

    def write_field_begin(name, type, id)
      @protocol.write_field_begin(name, type, id)
    end

    def write_field_end
      @protocol.write_field_end
    end

    def write_field_stop
      @protocol.write_field_stop
    end

    def write_map_begin(ktype, vtype, size)
      @protocol.write_map_begin(ktype, vtype, size)
    end

    def write_map_end
      @protocol.write_map_end
    end

    def write_list_begin(etype, size)
      @protocol.write_list_begin(etype, size)
    end

    def write_list_end
      @protocol.write_list_end
    end

    def write_set_begin(etype, size)
      @protocol.write_set_begin(etype, size)
    end

    def write_set_end
      @protocol.write_set_end
    end

    def write_bool(bool)
      @protocol.write_bool(bool)
    end

    def write_byte(byte)
      @protocol.write_byte(byte)
    end

    def write_i16(i16)
      @protocol.write_i16(i16)
    end

    def write_i32(i32)
      @protocol.write_i32(i32)
    end

    def write_i64(i64)
      @protocol.write_i64(i64)
    end

    def write_double(dub)
      @protocol.write_double(dub)
    end

    def write_string(str)
      @protocol.write_string(str)
    end

    def write_binary(buf)
      @protocol.write_binary(buf)
    end

    def read_message_begin
      @protocol.read_message_begin
    end

    def read_message_end
      @protocol.read_message_end
    end

    def read_struct_begin
      @protocol.read_struct_begin
    end

    def read_struct_end
      @protocol.read_struct_end
    end

    def read_field_begin
      @protocol.read_field_begin
    end

    def read_field_end
      @protocol.read_field_end
    end

    def read_map_begin
      @protocol.read_map_begin
    end

    def read_map_end
      @protocol.read_map_end
    end

    def read_list_begin
      @protocol.read_list_begin
    end

    def read_list_end
      @protocol.read_list_end
    end

    def read_set_begin
      @protocol.read_set_begin
    end

    def read_set_end
      @protocol.read_set_end
    end

    def read_bool
      @protocol.read_bool
    end

    def read_byte
      @protocol.read_byte
    end

    def read_i16
      @protocol.read_i16
    end

    def read_i32
      @protocol.read_i32
    end

    def read_i64
      @protocol.read_i64
    end

    def read_double
      @protocol.read_double
    end

    def read_string
      @protocol.read_string
    end

    def read_binary
      @protocol.read_binary
    end
  end
end