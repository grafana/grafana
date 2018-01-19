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

require 'net/http'
require 'net/https'
require 'openssl'
require 'uri'
require 'stringio'

module Thrift
  class HTTPClientTransport < BaseTransport

    def initialize(url, opts = {})
      @url = URI url
      @headers = {'Content-Type' => 'application/x-thrift'}
      @outbuf = Bytes.empty_byte_buffer
      @ssl_verify_mode = opts.fetch(:ssl_verify_mode, OpenSSL::SSL::VERIFY_PEER)
    end

    def open?; true end
    def read(sz); @inbuf.read sz end
    def write(buf); @outbuf << Bytes.force_binary_encoding(buf) end

    def add_headers(headers)
      @headers = @headers.merge(headers)
    end

    def flush
      http = Net::HTTP.new @url.host, @url.port
      http.use_ssl = @url.scheme == 'https'
      http.verify_mode = @ssl_verify_mode if @url.scheme == 'https'
      resp = http.post(@url.request_uri, @outbuf, @headers)
      data = resp.body
      data = Bytes.force_binary_encoding(data)
      @inbuf = StringIO.new data
    ensure
      @outbuf = Bytes.empty_byte_buffer
    end
  end
end
