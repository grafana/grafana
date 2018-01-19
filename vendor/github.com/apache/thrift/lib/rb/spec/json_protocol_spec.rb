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

require 'spec_helper'

describe 'JsonProtocol' do

  describe Thrift::JsonProtocol do
    before(:each) do
      @trans = Thrift::MemoryBufferTransport.new
      @prot = Thrift::JsonProtocol.new(@trans)
    end

    it "should write json escaped char" do
      @prot.write_json_escape_char("\n")
      @trans.read(@trans.available).should == '\u000a'

      @prot.write_json_escape_char(" ")
      @trans.read(@trans.available).should == '\u0020'
    end

    it "should write json char" do
      @prot.write_json_char("\n")
      @trans.read(@trans.available).should == '\\n'

      @prot.write_json_char(" ")
      @trans.read(@trans.available).should == ' '

      @prot.write_json_char("\\")
      @trans.read(@trans.available).should == "\\\\"

      @prot.write_json_char("@")
      @trans.read(@trans.available).should == '@'
    end

    it "should write json string" do
      @prot.write_json_string("this is a \\ json\nstring")
      @trans.read(@trans.available).should == "\"this is a \\\\ json\\nstring\""
    end

    it "should write json base64" do
      @prot.write_json_base64("this is a base64 string")
      @trans.read(@trans.available).should == "\"dGhpcyBpcyBhIGJhc2U2NCBzdHJpbmc=\""
    end

    it "should write json integer" do
      @prot.write_json_integer(45)
      @trans.read(@trans.available).should == "45"

      @prot.write_json_integer(33000)
      @trans.read(@trans.available).should == "33000"

      @prot.write_json_integer(3000000000)
      @trans.read(@trans.available).should == "3000000000"

      @prot.write_json_integer(6000000000)
      @trans.read(@trans.available).should == "6000000000"
    end

    it "should write json double" do
      @prot.write_json_double(12.3)
      @trans.read(@trans.available).should == "12.3"

      @prot.write_json_double(-3.21)
      @trans.read(@trans.available).should == "-3.21"

      @prot.write_json_double(((+1.0/0.0)/(+1.0/0.0)))
      @trans.read(@trans.available).should == "\"NaN\""

      @prot.write_json_double((+1.0/0.0))
      @trans.read(@trans.available).should == "\"Infinity\""

      @prot.write_json_double((-1.0/0.0))
      @trans.read(@trans.available).should == "\"-Infinity\""
    end

    it "should write json object start" do
      @prot.write_json_object_start
      @trans.read(@trans.available).should == "{"
    end

    it "should write json object end" do
      @prot.write_json_object_end
      @trans.read(@trans.available).should == "}"
    end

    it "should write json array start" do
      @prot.write_json_array_start
      @trans.read(@trans.available).should == "["
    end

    it "should write json array end" do
      @prot.write_json_array_end
      @trans.read(@trans.available).should == "]"
    end

    it "should write message begin" do
      @prot.write_message_begin("name", 12, 32)
      @trans.read(@trans.available).should == "[1,\"name\",12,32"
    end

    it "should write message end" do
      @prot.write_message_end
      @trans.read(@trans.available).should == "]"
    end

    it "should write struct begin" do
      @prot.write_struct_begin("name")
      @trans.read(@trans.available).should == "{"
    end

    it "should write struct end" do
      @prot.write_struct_end
      @trans.read(@trans.available).should == "}"
    end

    it "should write field begin" do
      @prot.write_field_begin("name", Thrift::Types::STRUCT, 32)
      @trans.read(@trans.available).should == "32{\"rec\""
    end

    it "should write field end" do
      @prot.write_field_end
      @trans.read(@trans.available).should == "}"
    end

    it "should write field stop" do
      @prot.write_field_stop
      @trans.read(@trans.available).should == ""
    end

    it "should write map begin" do
      @prot.write_map_begin(Thrift::Types::STRUCT, Thrift::Types::LIST, 32)
      @trans.read(@trans.available).should == "[\"rec\",\"lst\",32,{"
    end

    it "should write map end" do
      @prot.write_map_end
      @trans.read(@trans.available).should == "}]"
    end

    it "should write list begin" do
      @prot.write_list_begin(Thrift::Types::STRUCT, 32)
      @trans.read(@trans.available).should == "[\"rec\",32"
    end

    it "should write list end" do
      @prot.write_list_end
      @trans.read(@trans.available).should == "]"
    end

    it "should write set begin" do
      @prot.write_set_begin(Thrift::Types::STRUCT, 32)
      @trans.read(@trans.available).should == "[\"rec\",32"
    end

    it "should write set end" do
      @prot.write_set_end
      @trans.read(@trans.available).should == "]"
    end

    it "should write bool" do
      @prot.write_bool(true)
      @trans.read(@trans.available).should == "1"

      @prot.write_bool(false)
      @trans.read(@trans.available).should == "0"
    end

    it "should write byte" do
      @prot.write_byte(100)
      @trans.read(@trans.available).should == "100"
    end

    it "should write i16" do
      @prot.write_i16(1000)
      @trans.read(@trans.available).should == "1000"
    end

    it "should write i32" do
      @prot.write_i32(3000000000)
      @trans.read(@trans.available).should == "3000000000"
    end

    it "should write i64" do
      @prot.write_i64(6000000000)
      @trans.read(@trans.available).should == "6000000000"
    end

    it "should write double" do
      @prot.write_double(1.23)
      @trans.read(@trans.available).should == "1.23"

      @prot.write_double(-32.1)
      @trans.read(@trans.available).should == "-32.1"

      @prot.write_double(((+1.0/0.0)/(+1.0/0.0)))
      @trans.read(@trans.available).should == "\"NaN\""

      @prot.write_double((+1.0/0.0))
      @trans.read(@trans.available).should == "\"Infinity\""

      @prot.write_double((-1.0/0.0))
      @trans.read(@trans.available).should == "\"-Infinity\""
    end

    if RUBY_VERSION >= '1.9'
      it 'should write string' do
        @prot.write_string('this is a test string')
        a = @trans.read(@trans.available)
        a.should == '"this is a test string"'.force_encoding(Encoding::BINARY)
        a.encoding.should == Encoding::BINARY
      end

      it 'should write string with unicode characters' do
        @prot.write_string("this is a test string with unicode characters: \u20AC \u20AD")
        a = @trans.read(@trans.available)
        a.should == "\"this is a test string with unicode characters: \u20AC \u20AD\"".force_encoding(Encoding::BINARY)
        a.encoding.should == Encoding::BINARY
      end
    else
      it 'should write string' do
        @prot.write_string('this is a test string')
        @trans.read(@trans.available).should == '"this is a test string"'
      end
    end

    it "should write binary" do
      @prot.write_binary("this is a base64 string")
      @trans.read(@trans.available).should == "\"dGhpcyBpcyBhIGJhc2U2NCBzdHJpbmc=\""
    end

    it "should write long binary" do
      @prot.write_binary((0...256).to_a.pack('C*'))
      @trans.read(@trans.available).should == "\"AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8gISIjJCUmJygpKissLS4vMDEyMzQ1Njc4OTo7PD0+P0BBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWltcXV5fYGFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6e3x9fn+AgYKDhIWGh4iJiouMjY6PkJGSk5SVlpeYmZqbnJ2en6ChoqOkpaanqKmqq6ytrq+wsbKztLW2t7i5uru8vb6/wMHCw8TFxsfIycrLzM3Oz9DR0tPU1dbX2Nna29zd3t/g4eLj5OXm5+jp6uvs7e7v8PHy8/T19vf4+fr7/P3+/w==\""
    end

    it "should get type name for type id" do
      expect {@prot.get_type_name_for_type_id(Thrift::Types::STOP)}.to raise_error(NotImplementedError)
      expect {@prot.get_type_name_for_type_id(Thrift::Types::VOID)}.to raise_error(NotImplementedError)
      @prot.get_type_name_for_type_id(Thrift::Types::BOOL).should == "tf"
      @prot.get_type_name_for_type_id(Thrift::Types::BYTE).should == "i8"
      @prot.get_type_name_for_type_id(Thrift::Types::DOUBLE).should == "dbl"
      @prot.get_type_name_for_type_id(Thrift::Types::I16).should == "i16"
      @prot.get_type_name_for_type_id(Thrift::Types::I32).should == "i32"
      @prot.get_type_name_for_type_id(Thrift::Types::I64).should == "i64"
      @prot.get_type_name_for_type_id(Thrift::Types::STRING).should == "str"
      @prot.get_type_name_for_type_id(Thrift::Types::STRUCT).should == "rec"
      @prot.get_type_name_for_type_id(Thrift::Types::MAP).should == "map"
      @prot.get_type_name_for_type_id(Thrift::Types::SET).should == "set"
      @prot.get_type_name_for_type_id(Thrift::Types::LIST).should == "lst"
    end

    it "should get type id for type name" do
      expect {@prot.get_type_id_for_type_name("pp")}.to raise_error(NotImplementedError)
      @prot.get_type_id_for_type_name("tf").should == Thrift::Types::BOOL
      @prot.get_type_id_for_type_name("i8").should == Thrift::Types::BYTE
      @prot.get_type_id_for_type_name("dbl").should == Thrift::Types::DOUBLE
      @prot.get_type_id_for_type_name("i16").should == Thrift::Types::I16
      @prot.get_type_id_for_type_name("i32").should == Thrift::Types::I32
      @prot.get_type_id_for_type_name("i64").should == Thrift::Types::I64
      @prot.get_type_id_for_type_name("str").should == Thrift::Types::STRING
      @prot.get_type_id_for_type_name("rec").should == Thrift::Types::STRUCT
      @prot.get_type_id_for_type_name("map").should == Thrift::Types::MAP
      @prot.get_type_id_for_type_name("set").should == Thrift::Types::SET
      @prot.get_type_id_for_type_name("lst").should == Thrift::Types::LIST
    end

    it "should read json syntax char" do
      @trans.write('F')
      expect {@prot.read_json_syntax_char('G')}.to raise_error(Thrift::ProtocolException)
      @trans.write('H')
      @prot.read_json_syntax_char('H')
    end

    it "should read json escape char" do
      @trans.write('0054')
      @prot.read_json_escape_char.should == 'T'

      @trans.write("\"\\\"\"")
      @prot.read_json_string(false).should == "\""

      @trans.write("\"\\\\\"")
      @prot.read_json_string(false).should == "\\"

      @trans.write("\"\\/\"")
      @prot.read_json_string(false).should == "\/"

      @trans.write("\"\\b\"")
      @prot.read_json_string(false).should == "\b"

      @trans.write("\"\\f\"")
      @prot.read_json_string(false).should == "\f"

      @trans.write("\"\\n\"")
      @prot.read_json_string(false).should == "\n"

      @trans.write("\"\\r\"")
      @prot.read_json_string(false).should == "\r"

      @trans.write("\"\\t\"")
      @prot.read_json_string(false).should == "\t"
    end

    it "should read json string" do
      @trans.write("\"\\P")
      expect {@prot.read_json_string(false)}.to raise_error(Thrift::ProtocolException)

      @trans.write("\"this is a test string\"")
      @prot.read_json_string.should == "this is a test string"
    end

    it "should read json base64" do
      @trans.write("\"dGhpcyBpcyBhIHRlc3Qgc3RyaW5n\"")
      @prot.read_json_base64.should == "this is a test string"
    end

    it "should is json numeric" do
      @prot.is_json_numeric("A").should == false
      @prot.is_json_numeric("+").should == true
      @prot.is_json_numeric("-").should == true
      @prot.is_json_numeric(".").should == true
      @prot.is_json_numeric("0").should == true
      @prot.is_json_numeric("1").should == true
      @prot.is_json_numeric("2").should == true
      @prot.is_json_numeric("3").should == true
      @prot.is_json_numeric("4").should == true
      @prot.is_json_numeric("5").should == true
      @prot.is_json_numeric("6").should == true
      @prot.is_json_numeric("7").should == true
      @prot.is_json_numeric("8").should == true
      @prot.is_json_numeric("9").should == true
      @prot.is_json_numeric("E").should == true
      @prot.is_json_numeric("e").should == true
    end

    it "should read json numeric chars" do
      @trans.write("1.453E45T")
      @prot.read_json_numeric_chars.should == "1.453E45"
    end

    it "should read json integer" do
      @trans.write("1.45\"\"")
      expect {@prot.read_json_integer}.to raise_error(Thrift::ProtocolException)
      @prot.read_string

      @trans.write("1453T")
      @prot.read_json_integer.should == 1453
    end

    it "should read json double" do
      @trans.write("1.45e3e01\"\"")
      expect {@prot.read_json_double}.to raise_error(Thrift::ProtocolException)
      @prot.read_string

      @trans.write("\"1.453e01\"")
      expect {@prot.read_json_double}.to raise_error(Thrift::ProtocolException)

      @trans.write("1.453e01\"\"")
      @prot.read_json_double.should == 14.53
      @prot.read_string

      @trans.write("\"NaN\"")
      @prot.read_json_double.nan?.should == true

      @trans.write("\"Infinity\"")
      @prot.read_json_double.should == +1.0/0.0

      @trans.write("\"-Infinity\"")
      @prot.read_json_double.should == -1.0/0.0
    end

    it "should read json object start" do
      @trans.write("{")
      @prot.read_json_object_start.should == nil
    end

    it "should read json object end" do
      @trans.write("}")
      @prot.read_json_object_end.should == nil
    end

    it "should read json array start" do
      @trans.write("[")
      @prot.read_json_array_start.should == nil
    end

    it "should read json array end" do
      @trans.write("]")
      @prot.read_json_array_end.should == nil
    end

    it "should read_message_begin" do
      @trans.write("[2,")
      expect {@prot.read_message_begin}.to raise_error(Thrift::ProtocolException)

      @trans.write("[1,\"name\",12,32\"\"")
      @prot.read_message_begin.should == ["name", 12, 32]
    end

    it "should read message end" do
      @trans.write("]")
      @prot.read_message_end.should == nil
    end

    it "should read struct begin" do
      @trans.write("{")
      @prot.read_struct_begin.should == nil
    end

    it "should read struct end" do
      @trans.write("}")
      @prot.read_struct_end.should == nil
    end

    it "should read field begin" do
      @trans.write("1{\"rec\"")
      @prot.read_field_begin.should == [nil, 12, 1]
    end

    it "should read field end" do
      @trans.write("}")
      @prot.read_field_end.should == nil
    end

    it "should read map begin" do
      @trans.write("[\"rec\",\"lst\",2,{")
      @prot.read_map_begin.should == [12, 15, 2]
    end

    it "should read map end" do
      @trans.write("}]")
      @prot.read_map_end.should == nil
    end

    it "should read list begin" do
      @trans.write("[\"rec\",2\"\"")
      @prot.read_list_begin.should == [12, 2]
    end

    it "should read list end" do
      @trans.write("]")
      @prot.read_list_end.should == nil
    end

    it "should read set begin" do
      @trans.write("[\"rec\",2\"\"")
      @prot.read_set_begin.should == [12, 2]
    end

    it "should read set end" do
      @trans.write("]")
      @prot.read_set_end.should == nil
    end

    it "should read bool" do
      @trans.write("0\"\"")
      @prot.read_bool.should == false
      @prot.read_string

      @trans.write("1\"\"")
      @prot.read_bool.should == true
    end

    it "should read byte" do
      @trans.write("60\"\"")
      @prot.read_byte.should == 60
    end

    it "should read i16" do
      @trans.write("1000\"\"")
      @prot.read_i16.should == 1000
    end

    it "should read i32" do
      @trans.write("3000000000\"\"")
      @prot.read_i32.should == 3000000000
    end

    it "should read i64" do
      @trans.write("6000000000\"\"")
      @prot.read_i64.should == 6000000000
    end

    it "should read double" do
      @trans.write("12.23\"\"")
      @prot.read_double.should == 12.23
    end

    if RUBY_VERSION >= '1.9'
      it 'should read string' do
        @trans.write('"this is a test string"'.force_encoding(Encoding::BINARY))
        a = @prot.read_string
        a.should == 'this is a test string'
        a.encoding.should == Encoding::UTF_8
      end

      it 'should read string with unicode characters' do
        @trans.write('"this is a test string with unicode characters: \u20AC \u20AD"'.force_encoding(Encoding::BINARY))
        a = @prot.read_string
        a.should == "this is a test string with unicode characters: \u20AC \u20AD"
        a.encoding.should == Encoding::UTF_8
      end
    else
      it 'should read string' do
        @trans.write('"this is a test string"')
        @prot.read_string.should == 'this is a test string'
      end
    end

    it "should read binary" do
      @trans.write("\"dGhpcyBpcyBhIHRlc3Qgc3RyaW5n\"")
      @prot.read_binary.should == "this is a test string"
    end

    it "should read long binary" do
      @trans.write("\"AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8gISIjJCUmJygpKissLS4vMDEyMzQ1Njc4OTo7PD0+P0BBQkNERUZHSElKS0xNTk9QUVJTVFVWV1hZWltcXV5fYGFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6e3x9fn+AgYKDhIWGh4iJiouMjY6PkJGSk5SVlpeYmZqbnJ2en6ChoqOkpaanqKmqq6ytrq+wsbKztLW2t7i5uru8vb6/wMHCw8TFxsfIycrLzM3Oz9DR0tPU1dbX2Nna29zd3t/g4eLj5OXm5+jp6uvs7e7v8PHy8/T19vf4+fr7/P3+/w==\"")
      @prot.read_binary.bytes.to_a.should == (0...256).to_a
    end
  end

  describe Thrift::JsonProtocolFactory do
    it "should create a JsonProtocol" do
      Thrift::JsonProtocolFactory.new.get_protocol(mock("MockTransport")).should be_instance_of(Thrift::JsonProtocol)
    end
  end
end
