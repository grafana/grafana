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

require 'mongrel'

## Sticks a service on a URL, using mongrel to do the HTTP work
# <b>DEPRECATED:</b> Please use <tt>Thrift::ThinHTTPServer</tt> instead.
module Thrift
  class MongrelHTTPServer < BaseServer
    class Handler < Mongrel::HttpHandler
      def initialize(processor, protocol_factory)
        @processor = processor
        @protocol_factory = protocol_factory
      end

      def process(request, response)
        if request.params["REQUEST_METHOD"] == "POST"
          response.start(200) do |head, out|
            head["Content-Type"] = "application/x-thrift"
            transport = IOStreamTransport.new request.body, out
            protocol = @protocol_factory.get_protocol transport
            @processor.process protocol, protocol
          end
        else
          response.start(404) { }
        end
      end
    end

    def initialize(processor, opts={})
      Kernel.warn "[DEPRECATION WARNING] `Thrift::MongrelHTTPServer` is deprecated.  Please use `Thrift::ThinHTTPServer` instead."
      port = opts[:port] || 80
      ip = opts[:ip] || "0.0.0.0"
      path = opts[:path] || ""
      protocol_factory = opts[:protocol_factory] || BinaryProtocolFactory.new
      @server = Mongrel::HttpServer.new ip, port
      @server.register "/#{path}", Handler.new(processor, protocol_factory)
    end

    def serve
      @server.run.join
    end
  end
end
