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
  # A collection of utilities for working with bytes and byte buffers.
  module Bytes
    if RUBY_VERSION >= '1.9'
      # Creates and empty byte buffer (String with BINARY encoding)
      #
      # size - The Integer size of the buffer (default: nil) to create
      #
      # Returns a String with BINARY encoding, filled with null characters 
      # if size is greater than zero
      def self.empty_byte_buffer(size = nil)
        if (size && size > 0)
          "\0".force_encoding(Encoding::BINARY) * size
        else
          ''.force_encoding(Encoding::BINARY)
        end
      end

      # Forces the encoding of the buffer to BINARY. If the buffer
      # passed is frozen, then it will be duplicated.
      #
      # buffer - The String to force the encoding of.
      #
      # Returns the String passed with an encoding of BINARY; returned
      # String may be a duplicate.
      def self.force_binary_encoding(buffer)
        buffer = buffer.dup if buffer.frozen?
        buffer.force_encoding(Encoding::BINARY)
      end

      # Gets the byte value of a given position in a String.
      #
      # string - The String to retrive the byte value from.
      # index  - The Integer location of the byte value to retrieve.
      #
      # Returns an Integer value between 0 and 255.
      def self.get_string_byte(string, index)
        string.getbyte(index)
      end

      # Sets the byte value given to a given index in a String.
      #
      # string - The String to set the byte value in.
      # index  - The Integer location to set the byte value at.
      # byte   - The Integer value (0 to 255) to set in the string.
      #
      # Returns an Integer value of the byte value to set.
      def self.set_string_byte(string, index, byte)
        string.setbyte(index, byte)
      end

      # Converts the given String to a UTF-8 byte buffer.
      #
      # string - The String to convert.
      #
      # Returns a new String with BINARY encoding, containing the UTF-8
      # bytes of the original string.
      def self.convert_to_utf8_byte_buffer(string)
        if string.encoding != Encoding::UTF_8
          # transcode to UTF-8
          string = string.encode(Encoding::UTF_8)
        else
          # encoding is already UTF-8, but a duplicate is needed
          string = string.dup
        end
        string.force_encoding(Encoding::BINARY)
      end

      # Converts the given UTF-8 byte buffer into a String
      #
      # utf8_buffer - A String, with BINARY encoding, containing UTF-8 bytes
      #
      # Returns a new String with UTF-8 encoding,
      def self.convert_to_string(utf8_buffer)
        # duplicate the buffer, force encoding to UTF-8
        utf8_buffer.dup.force_encoding(Encoding::UTF_8)
      end
    else
      def self.empty_byte_buffer(size = nil)
        if (size && size > 0)
          "\0" * size
        else
          ''
        end
      end

      def self.force_binary_encoding(buffer)
        buffer
      end

      def self.get_string_byte(string, index)
        string[index]
      end

      def self.set_string_byte(string, index, byte)
        string[index] = byte
      end

      def self.convert_to_utf8_byte_buffer(string)
        # This assumes $KCODE is 'UTF8'/'U', which would mean the String is already a UTF-8 byte buffer
        # TODO consider handling other $KCODE values and transcoding with iconv
        string
      end

      def self.convert_to_string(utf8_buffer)
        # See comment in 'convert_to_utf8_byte_buffer' for relevant assumptions.
        utf8_buffer
      end
    end
  end
end
