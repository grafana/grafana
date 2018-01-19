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

require 'thread'

module Thrift
  class ThreadedServer < BaseServer
    def serve
      begin
        @server_transport.listen
        loop do
          client = @server_transport.accept
          trans = @transport_factory.get_transport(client)
          prot = @protocol_factory.get_protocol(trans)
          Thread.new(prot, trans) do |p, t|
            begin
              loop do
                @processor.process(p, p)
              end
            rescue Thrift::TransportException, Thrift::ProtocolException
            ensure
              t.close
            end
          end
        end
      ensure
        @server_transport.close
      end
    end
  end
end