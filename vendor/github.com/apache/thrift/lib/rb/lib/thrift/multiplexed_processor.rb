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
require 'thrift/protocol/base_protocol'

module Thrift
  class MultiplexedProcessor
    def initialize
      @actual_processors = {}
    end
 
    def register_processor(service_name, processor)
      @actual_processors[service_name] = processor
    end
 
    def process(iprot, oprot)
      name, type, seqid = iprot.read_message_begin
      check_type(type)
      check_separator(name)
      service_name, method = name.split(':')
      processor(service_name).process(StoredMessageProtocol.new(iprot, [method, type, seqid]), oprot)
    end

    protected

    def processor(service_name)
      if @actual_processors.has_key?(service_name)
        @actual_processors[service_name]
      else
        raise Thrift::Exception.new("Service name not found: #{service_name}. Did you forget to call #{self.class.name}#register_processor?")
      end
    end

    def check_type(type)
      unless [MessageTypes::CALL, MessageTypes::ONEWAY].include?(type)
        raise Thrift::Exception.new('This should not have happened!?')
      end
    end

    def check_separator(name)
      if name.count(':') < 1
        raise Thrift::Exception.new("Service name not found in message name: #{name}. Did you forget to use a Thrift::Protocol::MultiplexedProtocol in your client?")
      end
    end
  end

  class StoredMessageProtocol < BaseProtocol

    include ProtocolDecorator
    
    def initialize(protocol, message_begin)
      super(protocol)
      @message_begin = message_begin
    end

    def read_message_begin
      @message_begin
    end
  end
end
