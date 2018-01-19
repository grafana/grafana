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

require 'rack'
require 'thin'

##
# Wraps the Thin web server to provide a Thrift server over HTTP.
module Thrift
  class ThinHTTPServer < BaseServer

    ##
    # Accepts a Thrift::Processor
    # Options include:
    # * :port
    # * :ip
    # * :path
    # * :protocol_factory
    def initialize(processor, options={})
      port = options[:port] || 80
      ip = options[:ip] || "0.0.0.0"
      path = options[:path] || "/"
      protocol_factory = options[:protocol_factory] || BinaryProtocolFactory.new
      app = RackApplication.for(path, processor, protocol_factory)
      @server = Thin::Server.new(ip, port, app)
    end

    ##
    # Starts the server
    def serve
      @server.start
    end

    class RackApplication

      THRIFT_HEADER = "application/x-thrift"

      def self.for(path, processor, protocol_factory)
        Rack::Builder.new do
          use Rack::CommonLogger
          use Rack::ShowExceptions
          use Rack::Lint
          map path do
            run lambda { |env|
              request = Rack::Request.new(env)
              if RackApplication.valid_thrift_request?(request)
                RackApplication.successful_request(request, processor, protocol_factory)
              else
                RackApplication.failed_request
              end
            }
          end
        end
      end

      def self.successful_request(rack_request, processor, protocol_factory)
        response = Rack::Response.new([], 200, {'Content-Type' => THRIFT_HEADER})
        transport = IOStreamTransport.new rack_request.body, response
        protocol = protocol_factory.get_protocol transport
        processor.process protocol, protocol
        response
      end

      def self.failed_request
        Rack::Response.new(['Not Found'], 404, {'Content-Type' => THRIFT_HEADER})
      end

      def self.valid_thrift_request?(rack_request)
        rack_request.post? && rack_request.env["CONTENT_TYPE"] == THRIFT_HEADER
      end

    end

  end
end
