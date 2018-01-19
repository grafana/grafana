# encoding: ascii-8bit
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

require 'socket'

module Thrift
  class ServerSocket < BaseServerTransport
    # call-seq: initialize(host = nil, port)
    def initialize(host_or_port, port = nil)
      if port
        @host = host_or_port
        @port = port
      else
        @host = nil
        @port = host_or_port
      end
      @handle = nil
    end

    attr_reader :handle

    def listen
      @handle = TCPServer.new(@host, @port)
    end

    def accept
      unless @handle.nil?
        sock = @handle.accept
        trans = Socket.new
        trans.handle = sock
        trans
      end
    end

    def close
     @handle.close unless @handle.nil? or @handle.closed?
     @handle = nil
    end

    def closed?
      @handle.nil? or @handle.closed?
    end

    alias to_io handle
  end
end