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

module Thrift
  class SSLSocket < Socket
    def initialize(host='localhost', port=9090, timeout=nil, ssl_context=nil)
      super(host, port, timeout)
      @ssl_context = ssl_context
    end

    attr_accessor :ssl_context

    def open
      socket = super
      @handle = OpenSSL::SSL::SSLSocket.new(socket, @ssl_context)
      begin
        @handle.connect_nonblock
        @handle.post_connection_check(@host)
        @handle
      rescue IO::WaitReadable
        IO.select([ @handle ], nil, nil, @timeout)
        retry
      rescue IO::WaitWritable
        IO.select(nil, [ @handle ], nil, @timeout)
        retry
      rescue StandardError => e
        raise TransportException.new(TransportException::NOT_OPEN, "Could not connect to #{@desc}: #{e}")
      end
    end
  end
end
