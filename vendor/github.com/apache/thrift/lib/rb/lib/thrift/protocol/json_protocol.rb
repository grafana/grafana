# encoding: UTF-8
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

require 'base64'

module Thrift
  class LookaheadReader
    def initialize(trans)
      @trans = trans
      @hasData = false
      @data = nil
    end

    def read
      if @hasData
        @hasData = false
      else
        @data = @trans.read(1)
      end

      return @data
    end

    def peek
      if !@hasData
        @data = @trans.read(1)
      end
      @hasData = true
      return @data
    end
  end

  #
  # Class to serve as base JSON context and as base class for other context
  # implementations
  #
  class JSONContext
    @@kJSONElemSeparator = ','
    #
    # Write context data to the trans. Default is to do nothing.
    #
    def write(trans)
    end

    #
    # Read context data from the trans. Default is to do nothing.
    #
    def read(reader)
    end

    #
    # Return true if numbers need to be escaped as strings in this context.
    # Default behavior is to return false.
    #
    def escapeNum
      return false
    end
  end

  # Context class for object member key-value pairs
  class JSONPairContext < JSONContext
    @@kJSONPairSeparator = ':'

    def initialize
      @first = true
      @colon = true
    end

    def write(trans)
      if (@first)
        @first = false
        @colon = true
      else
        trans.write(@colon ? @@kJSONPairSeparator : @@kJSONElemSeparator)
        @colon = !@colon
      end
    end

    def read(reader)
      if (@first)
        @first = false
        @colon = true
      else
        ch = (@colon ? @@kJSONPairSeparator : @@kJSONElemSeparator)
        @colon = !@colon
        JsonProtocol::read_syntax_char(reader, ch)
      end
    end

    # Numbers must be turned into strings if they are the key part of a pair
    def escapeNum
      return @colon
    end
  end

  # Context class for lists
  class JSONListContext < JSONContext

    def initialize
      @first = true
    end

    def write(trans)
      if (@first)
        @first = false
      else
        trans.write(@@kJSONElemSeparator)
      end
    end

    def read(reader)
      if (@first)
        @first = false
      else
        JsonProtocol::read_syntax_char(reader, @@kJSONElemSeparator)
      end
    end
  end

  class JsonProtocol < BaseProtocol

    @@kJSONObjectStart = '{'
    @@kJSONObjectEnd = '}'
    @@kJSONArrayStart = '['
    @@kJSONArrayEnd = ']'
    @@kJSONNewline = '\n'
    @@kJSONBackslash = '\\'
    @@kJSONStringDelimiter = '"'

    @@kThriftVersion1 = 1

    @@kThriftNan = "NaN"
    @@kThriftInfinity = "Infinity"
    @@kThriftNegativeInfinity = "-Infinity"

    def initialize(trans)
      super(trans)
      @context = JSONContext.new
      @contexts = Array.new
      @reader = LookaheadReader.new(trans)
    end

    def get_type_name_for_type_id(id)
      case id
      when Types::BOOL
        "tf"
      when Types::BYTE
        "i8"
      when Types::I16
        "i16"
      when Types::I32
        "i32"
      when Types::I64
        "i64"
      when Types::DOUBLE
        "dbl"
      when Types::STRING
        "str"
      when Types::STRUCT
        "rec"
      when Types::MAP
        "map"
      when Types::SET
        "set"
      when Types::LIST
        "lst"
      else
        raise NotImplementedError
      end
    end

    def get_type_id_for_type_name(name)
      if (name == "tf")
        result = Types::BOOL
      elsif (name == "i8")
        result = Types::BYTE
      elsif (name == "i16")
        result = Types::I16
      elsif (name == "i32")
        result = Types::I32
      elsif (name == "i64")
        result = Types::I64
      elsif (name == "dbl")
        result = Types::DOUBLE
      elsif (name == "str")
        result = Types::STRING
      elsif (name == "rec")
        result = Types::STRUCT
      elsif (name == "map")
        result = Types::MAP
      elsif (name == "set")
        result = Types::SET
      elsif (name == "lst")
        result = Types::LIST
      else
        result = Types::STOP
      end
      if (result == Types::STOP)
        raise NotImplementedError
      end
      return result
    end

    # Static helper functions

    # Read 1 character from the trans and verify that it is the expected character ch.
    # Throw a protocol exception if it is not.
    def self.read_syntax_char(reader, ch)
      ch2 = reader.read
      if (ch2 != ch)
        raise ProtocolException.new(ProtocolException::INVALID_DATA, "Expected \'#{ch}\' got \'#{ch2}\'.")
      end
    end

   # Return true if the character ch is in [-+0-9.Ee]; false otherwise
    def is_json_numeric(ch)
      case ch
      when '+', '-', '.', '0' .. '9', 'E', "e"
        return true
      else
        return false
      end
    end

    def push_context(context)
      @contexts.push(@context)
      @context = context
    end

    def pop_context
      @context = @contexts.pop
    end

    # Write the character ch as a JSON escape sequence ("\u00xx")
    def write_json_escape_char(ch)
      trans.write('\\u')
      ch_value = ch[0]
      if (ch_value.kind_of? String)
        ch_value = ch.bytes.first
      end
      trans.write(ch_value.to_s(16).rjust(4,'0'))
    end

    # Write the character ch as part of a JSON string, escaping as appropriate.
    def write_json_char(ch)
      # This table describes the handling for the first 0x30 characters
      # 0 : escape using "\u00xx" notation
      # 1 : just output index
      # <other> : escape using "\<other>" notation
      kJSONCharTable = [
          # 0 1 2 3 4 5 6 7 8 9 A B C D E F
          0, 0, 0, 0, 0, 0, 0, 0,'b','t','n', 0,'f','r', 0, 0, # 0
          0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, # 1
          1, 1,'"', 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, # 2
      ]

      ch_value = ch[0]
      if (ch_value.kind_of? String)
        ch_value = ch.bytes.first
      end
      if (ch_value >= 0x30)
        if (ch == @@kJSONBackslash) # Only special character >= 0x30 is '\'
          trans.write(@@kJSONBackslash)
          trans.write(@@kJSONBackslash)
        else
          trans.write(ch)
        end
      else
        outCh = kJSONCharTable[ch_value];
        # Check if regular character, backslash escaped, or JSON escaped
        if outCh.kind_of? String
          trans.write(@@kJSONBackslash)
          trans.write(outCh)
        elsif outCh == 1
          trans.write(ch)
        else
          write_json_escape_char(ch)
        end
      end
    end

    # Write out the contents of the string str as a JSON string, escaping characters as appropriate.
    def write_json_string(str)
      @context.write(trans)
      trans.write(@@kJSONStringDelimiter)
      str.split('').each do |ch|
        write_json_char(ch)
      end
      trans.write(@@kJSONStringDelimiter)
    end

    # Write out the contents of the string as JSON string, base64-encoding
    # the string's contents, and escaping as appropriate
    def write_json_base64(str)
      @context.write(trans)
      trans.write(@@kJSONStringDelimiter)
      trans.write(Base64.strict_encode64(str))
      trans.write(@@kJSONStringDelimiter)
    end

    # Convert the given integer type to a JSON number, or a string
    # if the context requires it (eg: key in a map pair).
    def write_json_integer(num)
      @context.write(trans)
      escapeNum = @context.escapeNum
      if (escapeNum)
        trans.write(@@kJSONStringDelimiter)
      end
      trans.write(num.to_s);
      if (escapeNum)
        trans.write(@@kJSONStringDelimiter)
      end
    end

    # Convert the given double to a JSON string, which is either the number,
    # "NaN" or "Infinity" or "-Infinity".
    def write_json_double(num)
      @context.write(trans)
      # Normalize output of boost::lexical_cast for NaNs and Infinities
      special = false;
      if (num.nan?)
        special = true;
        val = @@kThriftNan;
      elsif (num.infinite?)
        special = true;
        val = @@kThriftInfinity;
        if (num < 0.0)
          val = @@kThriftNegativeInfinity;
        end
      else
        val = num.to_s
      end

      escapeNum = special || @context.escapeNum
      if (escapeNum)
        trans.write(@@kJSONStringDelimiter)
      end
      trans.write(val)
      if (escapeNum)
        trans.write(@@kJSONStringDelimiter)
      end
    end

    def write_json_object_start
      @context.write(trans)
      trans.write(@@kJSONObjectStart)
      push_context(JSONPairContext.new);
    end

    def write_json_object_end
      pop_context
      trans.write(@@kJSONObjectEnd)
    end

    def write_json_array_start
      @context.write(trans)
      trans.write(@@kJSONArrayStart)
      push_context(JSONListContext.new);
    end

    def write_json_array_end
      pop_context
      trans.write(@@kJSONArrayEnd)
    end

    def write_message_begin(name, type, seqid)
      write_json_array_start
      write_json_integer(@@kThriftVersion1)
      write_json_string(name)
      write_json_integer(type)
      write_json_integer(seqid)
    end

    def write_message_end
      write_json_array_end
    end

    def write_struct_begin(name)
      write_json_object_start
    end

    def write_struct_end
      write_json_object_end
    end

    def write_field_begin(name, type, id)
      write_json_integer(id)
      write_json_object_start
      write_json_string(get_type_name_for_type_id(type))
    end

    def write_field_end
      write_json_object_end
    end

    def write_field_stop; nil; end

    def write_map_begin(ktype, vtype, size)
      write_json_array_start
      write_json_string(get_type_name_for_type_id(ktype))
      write_json_string(get_type_name_for_type_id(vtype))
      write_json_integer(size)
      write_json_object_start
    end

    def write_map_end
      write_json_object_end
      write_json_array_end
    end

    def write_list_begin(etype, size)
      write_json_array_start
      write_json_string(get_type_name_for_type_id(etype))
      write_json_integer(size)
    end

    def write_list_end
      write_json_array_end
    end

    def write_set_begin(etype, size)
      write_json_array_start
      write_json_string(get_type_name_for_type_id(etype))
      write_json_integer(size)
    end

    def write_set_end
      write_json_array_end
    end

    def write_bool(bool)
      write_json_integer(bool ? 1 : 0)
    end

    def write_byte(byte)
      write_json_integer(byte)
    end

    def write_i16(i16)
      write_json_integer(i16)
    end

    def write_i32(i32)
      write_json_integer(i32)
    end

    def write_i64(i64)
      write_json_integer(i64)
    end

    def write_double(dub)
      write_json_double(dub)
    end

    def write_string(str)
      write_json_string(str)
    end

    def write_binary(str)
      write_json_base64(str)
    end

    ##
    # Reading functions
    ##

    # Reads 1 byte and verifies that it matches ch.
    def read_json_syntax_char(ch)
      JsonProtocol::read_syntax_char(@reader, ch)
    end

    # Decodes the four hex parts of a JSON escaped string character and returns
    # the character via out.
    #
    # Note - this only supports Unicode characters in the BMP (U+0000 to U+FFFF);
    # characters above the BMP are encoded as two escape sequences (surrogate pairs),
    # which is not yet implemented
    def read_json_escape_char
      str = @reader.read
      str += @reader.read
      str += @reader.read
      str += @reader.read
      if RUBY_VERSION >= '1.9'
        str.hex.chr(Encoding::UTF_8)
      else
        str.hex.chr
      end
    end

    # Decodes a JSON string, including unescaping, and returns the string via str
    def read_json_string(skipContext = false)
      # This string's characters must match up with the elements in escape_char_vals.
      # I don't have '/' on this list even though it appears on www.json.org --
      # it is not in the RFC -> it is. See RFC 4627
      escape_chars = "\"\\/bfnrt"

      # The elements of this array must match up with the sequence of characters in
      # escape_chars
      escape_char_vals = [
        "\"", "\\", "\/", "\b", "\f", "\n", "\r", "\t",
      ]

      if !skipContext
        @context.read(@reader)
      end
      read_json_syntax_char(@@kJSONStringDelimiter)
      ch = ""
      str = ""
      while (true)
        ch = @reader.read
        if (ch == @@kJSONStringDelimiter)
          break
        end
        if (ch == @@kJSONBackslash)
          ch = @reader.read
          if (ch == 'u')
            ch = read_json_escape_char
          else
            pos = escape_chars.index(ch);
            if (pos.nil?) # not found
              raise ProtocolException.new(ProtocolException::INVALID_DATA, "Expected control char, got \'#{ch}\'.")
            end
            ch = escape_char_vals[pos]
          end
        end
        str += ch
      end
      return str
    end

    # Reads a block of base64 characters, decoding it, and returns via str
    def read_json_base64
      str = read_json_string
      m = str.length % 4
      if m != 0
        # Add missing padding
        (4 - m).times do
          str += '='
        end
      end
      Base64.strict_decode64(str)
    end

    # Reads a sequence of characters, stopping at the first one that is not
    # a valid JSON numeric character.
    def read_json_numeric_chars
      str = ""
      while (true)
        ch = @reader.peek
        if (!is_json_numeric(ch))
          break;
        end
        ch = @reader.read
        str += ch
      end
      return str
    end

    # Reads a sequence of characters and assembles them into a number,
    # returning them via num
    def read_json_integer
      @context.read(@reader)
      if (@context.escapeNum)
        read_json_syntax_char(@@kJSONStringDelimiter)
      end
      str = read_json_numeric_chars

      begin
        num = Integer(str);
      rescue
        raise ProtocolException.new(ProtocolException::INVALID_DATA, "Expected numeric value; got \"#{str}\"")
      end

      if (@context.escapeNum)
        read_json_syntax_char(@@kJSONStringDelimiter)
      end

      return num
    end

    # Reads a JSON number or string and interprets it as a double.
    def read_json_double
      @context.read(@reader)
      num = 0
      if (@reader.peek == @@kJSONStringDelimiter)
        str = read_json_string(true)
        # Check for NaN, Infinity and -Infinity
        if (str == @@kThriftNan)
          num = (+1.0/0.0)/(+1.0/0.0)
        elsif (str == @@kThriftInfinity)
          num = +1.0/0.0
        elsif (str == @@kThriftNegativeInfinity)
          num = -1.0/0.0
        else
          if (!@context.escapeNum)
            # Raise exception -- we should not be in a string in this case
            raise ProtocolException.new(ProtocolException::INVALID_DATA, "Numeric data unexpectedly quoted")
          end
          begin
            num = Float(str)
          rescue
            raise ProtocolException.new(ProtocolException::INVALID_DATA, "Expected numeric value; got \"#{str}\"")
          end
        end
      else
        if (@context.escapeNum)
          # This will throw - we should have had a quote if escapeNum == true
          read_json_syntax_char(@@kJSONStringDelimiter)
        end
        str = read_json_numeric_chars
        begin
          num = Float(str)
        rescue
          raise ProtocolException.new(ProtocolException::INVALID_DATA, "Expected numeric value; got \"#{str}\"")
        end
      end
      return num
    end

    def read_json_object_start
      @context.read(@reader)
      read_json_syntax_char(@@kJSONObjectStart)
      push_context(JSONPairContext.new)
      nil
    end

    def read_json_object_end
      read_json_syntax_char(@@kJSONObjectEnd)
      pop_context
      nil
    end

    def read_json_array_start
      @context.read(@reader)
      read_json_syntax_char(@@kJSONArrayStart)
      push_context(JSONListContext.new)
      nil
    end

    def read_json_array_end
      read_json_syntax_char(@@kJSONArrayEnd)
      pop_context
      nil
    end

    def read_message_begin
      read_json_array_start
      version = read_json_integer
      if (version != @@kThriftVersion1)
        raise ProtocolException.new(ProtocolException::BAD_VERSION, 'Message contained bad version.')
      end
      name = read_json_string
      message_type = read_json_integer
      seqid = read_json_integer
      [name, message_type, seqid]
    end

    def read_message_end
      read_json_array_end
      nil
    end

    def read_struct_begin
      read_json_object_start
      nil
    end

    def read_struct_end
      read_json_object_end
      nil
    end

    def read_field_begin
      # Check if we hit the end of the list
      ch = @reader.peek
      if (ch == @@kJSONObjectEnd)
        field_type = Types::STOP
      else
        field_id = read_json_integer
        read_json_object_start
        field_type = get_type_id_for_type_name(read_json_string)
      end
      [nil, field_type, field_id]
    end

    def read_field_end
      read_json_object_end
    end

    def read_map_begin
      read_json_array_start
      key_type = get_type_id_for_type_name(read_json_string)
      val_type = get_type_id_for_type_name(read_json_string)
      size = read_json_integer
      read_json_object_start
      [key_type, val_type, size]
    end

    def read_map_end
      read_json_object_end
      read_json_array_end
    end

    def read_list_begin
      read_json_array_start
      [get_type_id_for_type_name(read_json_string), read_json_integer]
    end

    def read_list_end
      read_json_array_end
    end

    def read_set_begin
      read_json_array_start
      [get_type_id_for_type_name(read_json_string), read_json_integer]
    end

    def read_set_end
      read_json_array_end
    end

    def read_bool
      byte = read_byte
      byte != 0
    end

    def read_byte
      read_json_integer
    end

    def read_i16
      read_json_integer
    end

    def read_i32
      read_json_integer
    end

    def read_i64
      read_json_integer
    end

    def read_double
      read_json_double
    end

    def read_string
      read_json_string
    end

    def read_binary
      read_json_base64
    end
  end

  class JsonProtocolFactory < BaseProtocolFactory
    def get_protocol(trans)
      return Thrift::JsonProtocol.new(trans)
    end
  end
end
