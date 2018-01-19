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
  class Socket < BaseTransport
    def initialize(host='localhost', port=9090, timeout=nil)
      @host = host
      @port = port
      @timeout = timeout
      @desc = "#{host}:#{port}"
      @handle = nil
    end

    attr_accessor :handle, :timeout

    def open
      for addrinfo in ::Socket::getaddrinfo(@host, @port, nil, ::Socket::SOCK_STREAM) do
        begin
          socket = ::Socket.new(addrinfo[4], ::Socket::SOCK_STREAM, 0)
          socket.setsockopt(::Socket::IPPROTO_TCP, ::Socket::TCP_NODELAY, 1)
          sockaddr = ::Socket.sockaddr_in(addrinfo[1], addrinfo[3])
          begin
            socket.connect_nonblock(sockaddr)
          rescue Errno::EINPROGRESS
            unless IO.select(nil, [ socket ], nil, @timeout)
              next
            end
            begin
              socket.connect_nonblock(sockaddr)
            rescue Errno::EISCONN
            end
          end
          return @handle = socket
        rescue StandardError => e
          next
        end
      end
      raise TransportException.new(TransportException::NOT_OPEN, "Could not connect to #{@desc}: #{e}")
    end

    def open?
      !@handle.nil? and !@handle.closed?
    end

    def write(str)
      raise IOError, "closed stream" unless open?
      str = Bytes.force_binary_encoding(str)
      begin
        if @timeout.nil? or @timeout == 0
          @handle.write(str)
        else
          len = 0
          start = Time.now
          while Time.now - start < @timeout
            rd, wr, = IO.select(nil, [@handle], nil, @timeout)
            if wr and not wr.empty?
              len += @handle.write_nonblock(str[len..-1])
              break if len >= str.length
            end
          end
          if len < str.length
            raise TransportException.new(TransportException::TIMED_OUT, "Socket: Timed out writing #{str.length} bytes to #{@desc}")
          else
            len
          end
        end
      rescue TransportException => e
        # pass this on
        raise e
      rescue StandardError => e
        @handle.close
        @handle = nil
        raise TransportException.new(TransportException::NOT_OPEN, e.message)
      end
    end

    def read(sz)
      raise IOError, "closed stream" unless open?

      begin
        if @timeout.nil? or @timeout == 0
          data = @handle.readpartial(sz)
        else
          # it's possible to interrupt select for something other than the timeout
          # so we need to ensure we've waited long enough, but not too long
          start = Time.now
          timespent = 0
          rd = loop do
            rd, = IO.select([@handle], nil, nil, @timeout - timespent)
            timespent = Time.now - start
            break rd if (rd and not rd.empty?) or timespent >= @timeout
          end
          if rd.nil? or rd.empty?
            raise TransportException.new(TransportException::TIMED_OUT, "Socket: Timed out reading #{sz} bytes from #{@desc}")
          else
            data = @handle.readpartial(sz)
          end
        end
      rescue TransportException => e
        # don't let this get caught by the StandardError handler
        raise e
      rescue StandardError => e
        @handle.close unless @handle.closed?
        @handle = nil
        raise TransportException.new(TransportException::NOT_OPEN, e.message)
      end
      if (data.nil? or data.length == 0)
        raise TransportException.new(TransportException::UNKNOWN, "Socket: Could not read #{sz} bytes from #{@desc}")
      end
      data
    end

    def close
      @handle.close unless @handle.nil? or @handle.closed?
      @handle = nil
    end

    def to_io
      @handle
    end
  end
end
