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

describe 'Client' do

  class ClientSpec
    include Thrift::Client
  end

  before(:each) do
    @prot = mock("MockProtocol")
    @client = ClientSpec.new(@prot)
  end

  describe Thrift::Client do
    it "should re-use iprot for oprot if not otherwise specified" do
      @client.instance_variable_get(:'@iprot').should eql(@prot)
      @client.instance_variable_get(:'@oprot').should eql(@prot)
    end

    it "should send a test message" do
      @prot.should_receive(:write_message_begin).with('testMessage', Thrift::MessageTypes::CALL, 0)
      mock_args = mock('#<TestMessage_args:mock>')
      mock_args.should_receive(:foo=).with('foo')
      mock_args.should_receive(:bar=).with(42)
      mock_args.should_receive(:write).with(@prot)
      @prot.should_receive(:write_message_end)
      @prot.should_receive(:trans) do
        mock('trans').tap do |trans|
          trans.should_receive(:flush)
        end
      end
      klass = stub("TestMessage_args", :new => mock_args)
      @client.send_message('testMessage', klass, :foo => 'foo', :bar => 42)
    end

    it "should increment the sequence id when sending messages" do
      pending "it seems sequence ids are completely ignored right now" do
        @prot.should_receive(:write_message_begin).with('testMessage',  Thrift::MessageTypes::CALL, 0).ordered
        @prot.should_receive(:write_message_begin).with('testMessage2', Thrift::MessageTypes::CALL, 1).ordered
        @prot.should_receive(:write_message_begin).with('testMessage3', Thrift::MessageTypes::CALL, 2).ordered
        @prot.stub!(:write_message_end)
        @prot.stub!(:trans).and_return mock("trans").as_null_object
        @client.send_message('testMessage', mock("args class").as_null_object)
        @client.send_message('testMessage2', mock("args class").as_null_object)
        @client.send_message('testMessage3', mock("args class").as_null_object)
      end
    end

    it "should receive a test message" do
      @prot.should_receive(:read_message_begin).and_return [nil, Thrift::MessageTypes::CALL, 0]
      @prot.should_receive(:read_message_end)
      mock_klass = mock("#<MockClass:mock>")
      mock_klass.should_receive(:read).with(@prot)
      @client.receive_message(stub("MockClass", :new => mock_klass))
    end

    it "should handle received exceptions" do
      @prot.should_receive(:read_message_begin).and_return [nil, Thrift::MessageTypes::EXCEPTION, 0]
      @prot.should_receive(:read_message_end)
      Thrift::ApplicationException.should_receive(:new).and_return do
        StandardError.new.tap do |mock_exc|
          mock_exc.should_receive(:read).with(@prot)
        end
      end
      lambda { @client.receive_message(nil) }.should raise_error(StandardError)
    end

    it "should close the transport if an error occurs while sending a message" do
      @prot.stub!(:write_message_begin)
      @prot.should_not_receive(:write_message_end)
      mock_args = mock("#<TestMessage_args:mock>")
      mock_args.should_receive(:write).with(@prot).and_raise(StandardError)
      trans = mock("MockTransport")
      @prot.stub!(:trans).and_return(trans)
      trans.should_receive(:close)
      klass = mock("TestMessage_args", :new => mock_args)
      lambda { @client.send_message("testMessage", klass) }.should raise_error(StandardError)
    end
  end
end
