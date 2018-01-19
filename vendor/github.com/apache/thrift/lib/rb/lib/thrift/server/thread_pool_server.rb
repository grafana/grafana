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
  class ThreadPoolServer < BaseServer
    def initialize(processor, server_transport, transport_factory=nil, protocol_factory=nil, num=20)
      super(processor, server_transport, transport_factory, protocol_factory)
      @thread_q = SizedQueue.new(num)
      @exception_q = Queue.new
      @running = false
    end

    ## exceptions that happen in worker threads will be relayed here and
    ## must be caught. 'retry' can be used to continue. (threads will
    ## continue to run while the exception is being handled.)
    def rescuable_serve
      Thread.new { serve } unless @running
      @running = true
      raise @exception_q.pop
    end

    ## exceptions that happen in worker threads simply cause that thread
    ## to die and another to be spawned in its place.
    def serve
      @server_transport.listen

      begin
        loop do
          @thread_q.push(:token)
          Thread.new do
            begin
              loop do
                client = @server_transport.accept
                trans = @transport_factory.get_transport(client)
                prot = @protocol_factory.get_protocol(trans)
                begin
                  loop do
                    @processor.process(prot, prot)
                  end
                rescue Thrift::TransportException, Thrift::ProtocolException => e
                ensure
                  trans.close
                end
              end
            rescue => e
              @exception_q.push(e)
            ensure
              @thread_q.pop # thread died!
            end
          end
        end
      ensure
        @server_transport.close
      end
    end
  end
end