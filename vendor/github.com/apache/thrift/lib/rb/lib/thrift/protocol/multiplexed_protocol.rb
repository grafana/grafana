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

require 'thrift/protocol/protocol_decorator'

module Thrift
  class MultiplexedProtocol < BaseProtocol

    include ProtocolDecorator

    def initialize(protocol, service_name)
      super(protocol)
      @service_name = service_name
    end

    def write_message_begin(name, type, seqid)
      case type
      when MessageTypes::CALL, MessageTypes::ONEWAY
        @protocol.write_message_begin("#{@service_name}:#{name}", type, seqid)
      else
        @protocol.write_message_begin(name, type, seqid)
      end 
    end
  end
end