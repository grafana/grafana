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

describe 'Struct' do

  describe Thrift::Struct do
    it "should iterate over all fields properly" do
      fields = {}
      SpecNamespace::Foo.new.each_field { |fid,field_info| fields[fid] = field_info }
      fields.should == SpecNamespace::Foo::FIELDS
    end

    it "should initialize all fields to defaults" do
      validate_default_arguments(SpecNamespace::Foo.new)
    end

    it "should initialize all fields to defaults and accept a block argument" do
      SpecNamespace::Foo.new do |f|
        validate_default_arguments(f)
      end
    end

    def validate_default_arguments(object)
      object.simple.should == 53
      object.words.should == "words"
      object.hello.should == SpecNamespace::Hello.new(:greeting => 'hello, world!')
      object.ints.should == [1, 2, 2, 3]
      object.complex.should be_nil
      object.shorts.should == Set.new([5, 17, 239])
    end

    it "should not share default values between instances" do
      begin
        struct = SpecNamespace::Foo.new
        struct.ints << 17
        SpecNamespace::Foo.new.ints.should == [1,2,2,3]
      ensure
        # ensure no leakage to other tests
        SpecNamespace::Foo::FIELDS[4][:default] = [1,2,2,3]
      end
    end

    it "should properly initialize boolean values" do
      struct = SpecNamespace::BoolStruct.new(:yesno => false)
      struct.yesno.should be_false
    end

    it "should have proper == semantics" do
      SpecNamespace::Foo.new.should_not == SpecNamespace::Hello.new
      SpecNamespace::Foo.new.should == SpecNamespace::Foo.new
      SpecNamespace::Foo.new(:simple => 52).should_not == SpecNamespace::Foo.new
    end

    it "should print enum value names in inspect" do
      SpecNamespace::StructWithSomeEnum.new(:some_enum => SpecNamespace::SomeEnum::ONE).inspect.should == "<SpecNamespace::StructWithSomeEnum some_enum:ONE (0)>"

      SpecNamespace::StructWithEnumMap.new(:my_map => {SpecNamespace::SomeEnum::ONE => [SpecNamespace::SomeEnum::TWO]}).inspect.should == "<SpecNamespace::StructWithEnumMap my_map:{ONE (0): [TWO (1)]}>"
    end

    it "should pretty print binary fields" do
      SpecNamespace::Foo2.new(:my_binary => "\001\002\003").inspect.should == "<SpecNamespace::Foo2 my_binary:010203>"
    end

    it "should offer field? methods" do
      SpecNamespace::Foo.new.opt_string?.should be_false
      SpecNamespace::Foo.new(:simple => 52).simple?.should be_true
      SpecNamespace::Foo.new(:my_bool => false).my_bool?.should be_true
      SpecNamespace::Foo.new(:my_bool => true).my_bool?.should be_true
    end

    it "should be comparable" do
      s1 = SpecNamespace::StructWithSomeEnum.new(:some_enum => SpecNamespace::SomeEnum::ONE)
      s2 = SpecNamespace::StructWithSomeEnum.new(:some_enum => SpecNamespace::SomeEnum::TWO)

      (s1 <=> s2).should == -1
      (s2 <=> s1).should == 1
      (s1 <=> s1).should == 0
      (s1 <=> SpecNamespace::StructWithSomeEnum.new()).should == -1
    end

    it "should read itself off the wire" do
      struct = SpecNamespace::Foo.new
      prot = Thrift::BaseProtocol.new(mock("transport"))
      prot.should_receive(:read_struct_begin).twice
      prot.should_receive(:read_struct_end).twice
      prot.should_receive(:read_field_begin).and_return(
        ['complex', Thrift::Types::MAP, 5], # Foo
        ['words', Thrift::Types::STRING, 2], # Foo
        ['hello', Thrift::Types::STRUCT, 3], # Foo
          ['greeting', Thrift::Types::STRING, 1], # Hello
          [nil, Thrift::Types::STOP, 0], # Hello
        ['simple', Thrift::Types::I32, 1], # Foo
        ['ints', Thrift::Types::LIST, 4], # Foo
        ['shorts', Thrift::Types::SET, 6], # Foo
        [nil, Thrift::Types::STOP, 0] # Hello
      )
      prot.should_receive(:read_field_end).exactly(7).times
      prot.should_receive(:read_map_begin).and_return(
        [Thrift::Types::I32, Thrift::Types::MAP, 2], # complex
          [Thrift::Types::STRING, Thrift::Types::DOUBLE, 2], # complex/1/value
          [Thrift::Types::STRING, Thrift::Types::DOUBLE, 1] # complex/2/value
      )
      prot.should_receive(:read_map_end).exactly(3).times
      prot.should_receive(:read_list_begin).and_return([Thrift::Types::I32, 4])
      prot.should_receive(:read_list_end)
      prot.should_receive(:read_set_begin).and_return([Thrift::Types::I16, 2])
      prot.should_receive(:read_set_end)
      prot.should_receive(:read_i32).and_return(
        1, 14,        # complex keys
        42,           # simple
        4, 23, 4, 29  # ints
      )
      prot.should_receive(:read_string).and_return("pi", "e", "feigenbaum", "apple banana", "what's up?")
      prot.should_receive(:read_double).and_return(Math::PI, Math::E, 4.669201609)
      prot.should_receive(:read_i16).and_return(2, 3)
      prot.should_not_receive(:skip)
      struct.read(prot)

      struct.simple.should == 42
      struct.complex.should == {1 => {"pi" => Math::PI, "e" => Math::E}, 14 => {"feigenbaum" => 4.669201609}}
      struct.hello.should == SpecNamespace::Hello.new(:greeting => "what's up?")
      struct.words.should == "apple banana"
      struct.ints.should == [4, 23, 4, 29]
      struct.shorts.should == Set.new([3, 2])
    end

    it "should serialize false boolean fields correctly" do
      b = SpecNamespace::BoolStruct.new(:yesno => false)
      prot = Thrift::BinaryProtocol.new(Thrift::MemoryBufferTransport.new)
      prot.should_receive(:write_bool).with(false)
      b.write(prot)
    end

    it "should skip unexpected fields in structs and use default values" do
      struct = SpecNamespace::Foo.new
      prot = Thrift::BaseProtocol.new(mock("transport"))
      prot.should_receive(:read_struct_begin)
      prot.should_receive(:read_struct_end)
      prot.should_receive(:read_field_begin).and_return(
        ['simple', Thrift::Types::I32, 1],
        ['complex', Thrift::Types::STRUCT, 5],
        ['thinz', Thrift::Types::MAP, 7],
        ['foobar', Thrift::Types::I32, 3],
        ['words', Thrift::Types::STRING, 2],
        [nil, Thrift::Types::STOP, 0]
      )
      prot.should_receive(:read_field_end).exactly(5).times
      prot.should_receive(:read_i32).and_return(42)
      prot.should_receive(:read_string).and_return("foobar")
      prot.should_receive(:skip).with(Thrift::Types::STRUCT)
      prot.should_receive(:skip).with(Thrift::Types::MAP)
      # prot.should_receive(:read_map_begin).and_return([Thrift::Types::I32, Thrift::Types::I32, 0])
      # prot.should_receive(:read_map_end)
      prot.should_receive(:skip).with(Thrift::Types::I32)
      struct.read(prot)

      struct.simple.should == 42
      struct.complex.should be_nil
      struct.words.should == "foobar"
      struct.hello.should == SpecNamespace::Hello.new(:greeting => 'hello, world!')
      struct.ints.should == [1, 2, 2, 3]
      struct.shorts.should == Set.new([5, 17, 239])
    end

    it "should write itself to the wire" do
      prot = Thrift::BaseProtocol.new(mock("transport")) #mock("Protocol")
      prot.should_receive(:write_struct_begin).with("SpecNamespace::Foo")
      prot.should_receive(:write_struct_begin).with("SpecNamespace::Hello")
      prot.should_receive(:write_struct_end).twice
      prot.should_receive(:write_field_begin).with('ints', Thrift::Types::LIST, 4)
      prot.should_receive(:write_i32).with(1)
      prot.should_receive(:write_i32).with(2).twice
      prot.should_receive(:write_i32).with(3)
      prot.should_receive(:write_field_begin).with('complex', Thrift::Types::MAP, 5)
      prot.should_receive(:write_i32).with(5)
      prot.should_receive(:write_string).with('foo')
      prot.should_receive(:write_double).with(1.23)
      prot.should_receive(:write_field_begin).with('shorts', Thrift::Types::SET, 6)
      prot.should_receive(:write_i16).with(5)
      prot.should_receive(:write_i16).with(17)
      prot.should_receive(:write_i16).with(239)
      prot.should_receive(:write_field_stop).twice
      prot.should_receive(:write_field_end).exactly(6).times
      prot.should_receive(:write_field_begin).with('simple', Thrift::Types::I32, 1)
      prot.should_receive(:write_i32).with(53)
      prot.should_receive(:write_field_begin).with('hello', Thrift::Types::STRUCT, 3)
      prot.should_receive(:write_field_begin).with('greeting', Thrift::Types::STRING, 1)
      prot.should_receive(:write_string).with('hello, world!')
      prot.should_receive(:write_map_begin).with(Thrift::Types::I32, Thrift::Types::MAP, 1)
      prot.should_receive(:write_map_begin).with(Thrift::Types::STRING, Thrift::Types::DOUBLE, 1)
      prot.should_receive(:write_map_end).twice
      prot.should_receive(:write_list_begin).with(Thrift::Types::I32, 4)
      prot.should_receive(:write_list_end)
      prot.should_receive(:write_set_begin).with(Thrift::Types::I16, 3)
      prot.should_receive(:write_set_end)

      struct = SpecNamespace::Foo.new
      struct.words = nil
      struct.complex = {5 => {"foo" => 1.23}}
      struct.write(prot)
    end

    it "should raise an exception if presented with an unknown container" do
      # yeah this is silly, but I'm going for code coverage here
      struct = SpecNamespace::Foo.new
      lambda { struct.send :write_container, nil, nil, {:type => "foo"} }.should raise_error(StandardError, "Not a container type: foo")
    end

    it "should support optional type-checking in Thrift::Struct.new" do
      Thrift.type_checking = true
      begin
        lambda { SpecNamespace::Hello.new(:greeting => 3) }.should raise_error(Thrift::TypeError, "Expected Types::STRING, received Fixnum for field greeting")
      ensure
        Thrift.type_checking = false
      end
      lambda { SpecNamespace::Hello.new(:greeting => 3) }.should_not raise_error(Thrift::TypeError)
    end

    it "should support optional type-checking in field accessors" do
      Thrift.type_checking = true
      begin
        hello = SpecNamespace::Hello.new
        lambda { hello.greeting = 3 }.should raise_error(Thrift::TypeError, "Expected Types::STRING, received Fixnum for field greeting")
      ensure
        Thrift.type_checking = false
      end
      lambda { hello.greeting = 3 }.should_not raise_error(Thrift::TypeError)
    end

    it "should raise an exception when unknown types are given to Thrift::Struct.new" do
      lambda { SpecNamespace::Hello.new(:fish => 'salmon') }.should raise_error(Exception, "Unknown key given to SpecNamespace::Hello.new: fish")
    end

    it "should support `raise Xception, 'message'` for Exception structs" do
      begin
        raise SpecNamespace::Xception, "something happened"
      rescue Thrift::Exception => e
        e.message.should == "something happened"
        e.code.should == 1
        # ensure it gets serialized properly, this is the really important part
        prot = Thrift::BaseProtocol.new(mock("trans"))
        prot.should_receive(:write_struct_begin).with("SpecNamespace::Xception")
        prot.should_receive(:write_struct_end)
        prot.should_receive(:write_field_begin).with('message', Thrift::Types::STRING, 1)#, "something happened")
        prot.should_receive(:write_string).with("something happened")
        prot.should_receive(:write_field_begin).with('code', Thrift::Types::I32, 2)#, 1)
        prot.should_receive(:write_i32).with(1)
        prot.should_receive(:write_field_stop)
        prot.should_receive(:write_field_end).twice

        e.write(prot)
      end
    end

    it "should support the regular initializer for exception structs" do
      begin
        raise SpecNamespace::Xception, :message => "something happened", :code => 5
      rescue Thrift::Exception => e
        e.message.should == "something happened"
        e.code.should == 5
        prot = Thrift::BaseProtocol.new(mock("trans"))
        prot.should_receive(:write_struct_begin).with("SpecNamespace::Xception")
        prot.should_receive(:write_struct_end)
        prot.should_receive(:write_field_begin).with('message', Thrift::Types::STRING, 1)
        prot.should_receive(:write_string).with("something happened")
        prot.should_receive(:write_field_begin).with('code', Thrift::Types::I32, 2)
        prot.should_receive(:write_i32).with(5)
        prot.should_receive(:write_field_stop)
        prot.should_receive(:write_field_end).twice

        e.write(prot)
      end
    end
  end
end
