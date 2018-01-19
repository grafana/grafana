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

describe 'Processor' do

  class ProcessorSpec
    include Thrift::Processor
  end

  describe Thrift::Processor do
    before(:each) do
      @processor = ProcessorSpec.new(mock("MockHandler"))
      @prot = mock("MockProtocol")
    end

    def mock_trans(obj)
      obj.should_receive(:trans).ordered.and_return do
        mock("trans").tap do |trans|
          trans.should_receive(:flush).ordered
        end
      end
    end

    it "should call process_<message> when it receives that message" do
      @prot.should_receive(:read_message_begin).ordered.and_return ['testMessage', Thrift::MessageTypes::CALL, 17]
      @processor.should_receive(:process_testMessage).with(17, @prot, @prot).ordered
      @processor.process(@prot, @prot).should == true
    end

    it "should raise an ApplicationException when the received message cannot be processed" do
      @prot.should_receive(:read_message_begin).ordered.and_return ['testMessage', Thrift::MessageTypes::CALL, 4]
      @prot.should_receive(:skip).with(Thrift::Types::STRUCT).ordered
      @prot.should_receive(:read_message_end).ordered
      @prot.should_receive(:write_message_begin).with('testMessage', Thrift::MessageTypes::EXCEPTION, 4).ordered
      e = mock(Thrift::ApplicationException)
      e.should_receive(:write).with(@prot).ordered
      Thrift::ApplicationException.should_receive(:new).with(Thrift::ApplicationException::UNKNOWN_METHOD, "Unknown function testMessage").and_return(e)
      @prot.should_receive(:write_message_end).ordered
      mock_trans(@prot)
      @processor.process(@prot, @prot)
    end

    it "should pass args off to the args class" do
      args_class = mock("MockArgsClass")
      args = mock("#<MockArgsClass:mock>").tap do |args|
        args.should_receive(:read).with(@prot).ordered
      end
      args_class.should_receive(:new).and_return args
      @prot.should_receive(:read_message_end).ordered
      @processor.read_args(@prot, args_class).should eql(args)
    end

    it "should write out a reply when asked" do
      @prot.should_receive(:write_message_begin).with('testMessage', Thrift::MessageTypes::REPLY, 23).ordered
      result = mock("MockResult")
      result.should_receive(:write).with(@prot).ordered
      @prot.should_receive(:write_message_end).ordered
      mock_trans(@prot)
      @processor.write_result(result, @prot, 'testMessage', 23)
    end
  end
end
