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

module Thrift
  class FramedTransport < BaseTransport
    def initialize(transport, read=true, write=true)
      @transport = transport
      @rbuf      = Bytes.empty_byte_buffer
      @wbuf      = Bytes.empty_byte_buffer
      @read      = read
      @write     = write
      @index      = 0
    end

    def open?
      @transport.open?
    end

    def open
      @transport.open
    end

    def close
      @transport.close
    end

    def read(sz)
      return @transport.read(sz) unless @read

      return Bytes.empty_byte_buffer if sz <= 0

      read_frame if @index >= @rbuf.length

      @index += sz
      @rbuf.slice(@index - sz, sz) || Bytes.empty_byte_buffer
    end

    def read_byte
      return @transport.read_byte() unless @read

      read_frame if @index >= @rbuf.length

      # The read buffer has some data now, read a single byte. Using get_string_byte() avoids
      # allocating a temp string of size 1 unnecessarily.
      @index += 1
      return Bytes.get_string_byte(@rbuf, @index - 1)
    end

    def read_into_buffer(buffer, size)
      i = 0
      while i < size
        read_frame if @index >= @rbuf.length

        # The read buffer has some data now, so copy bytes over to the output buffer.
        byte = Bytes.get_string_byte(@rbuf, @index)
        Bytes.set_string_byte(buffer, i, byte)
        @index += 1
        i += 1
      end
      i
    end

    def write(buf, sz=nil)
      return @transport.write(buf) unless @write

      buf = Bytes.force_binary_encoding(buf)
      @wbuf << (sz ? buf[0...sz] : buf)
    end

    #
    # Writes the output buffer to the stream in the format of a 4-byte length
    # followed by the actual data.
    #
    def flush
      return @transport.flush unless @write

      out = [@wbuf.length].pack('N')
      # Array#pack should return a BINARY encoded String, so it shouldn't be necessary to force encoding
      out << @wbuf
      @transport.write(out)
      @transport.flush
      @wbuf = Bytes.empty_byte_buffer
    end

    private

    def read_frame
      sz = @transport.read_all(4).unpack('N').first

      @index = 0
      @rbuf = @transport.read_all(sz)
    end
  end

  class FramedTransportFactory < BaseTransportFactory
    def get_transport(transport)
      return FramedTransport.new(transport)
    end
  end
end