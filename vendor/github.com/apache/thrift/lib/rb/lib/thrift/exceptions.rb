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
  class Exception < StandardError
    def initialize(message)
      super
      @message = message
    end

    attr_reader :message
  end

  class ApplicationException < Exception

    UNKNOWN = 0
    UNKNOWN_METHOD = 1
    INVALID_MESSAGE_TYPE = 2
    WRONG_METHOD_NAME = 3
    BAD_SEQUENCE_ID = 4
    MISSING_RESULT = 5
    INTERNAL_ERROR = 6
    PROTOCOL_ERROR = 7
    INVALID_TRANSFORM = 8
    INVALID_PROTOCOL = 9
    UNSUPPORTED_CLIENT_TYPE = 10

    attr_reader :type

    def initialize(type=UNKNOWN, message=nil)
      super(message)
      @type = type
    end

    def read(iprot)
      iprot.read_struct_begin
      while true
        fname, ftype, fid = iprot.read_field_begin
        if ftype == Types::STOP
          break
        end
        if fid == 1 and ftype == Types::STRING
          @message = iprot.read_string
        elsif fid == 2 and ftype == Types::I32
          @type = iprot.read_i32
        else
          iprot.skip(ftype)
        end
        iprot.read_field_end
      end
      iprot.read_struct_end
    end

    def write(oprot)
      oprot.write_struct_begin('Thrift::ApplicationException')
      unless @message.nil?
        oprot.write_field_begin('message', Types::STRING, 1)
        oprot.write_string(@message)
        oprot.write_field_end
      end
      unless @type.nil?
        oprot.write_field_begin('type', Types::I32, 2)
        oprot.write_i32(@type)
        oprot.write_field_end
      end
      oprot.write_field_stop
      oprot.write_struct_end
    end

  end
end
