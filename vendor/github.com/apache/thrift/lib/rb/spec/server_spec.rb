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

describe 'Server' do

  describe Thrift::BaseServer do
    it "should default to BaseTransportFactory and BinaryProtocolFactory when not specified" do
      server = Thrift::BaseServer.new(mock("Processor"), mock("BaseServerTransport"))
      server.instance_variable_get(:'@transport_factory').should be_an_instance_of(Thrift::BaseTransportFactory)
      server.instance_variable_get(:'@protocol_factory').should be_an_instance_of(Thrift::BinaryProtocolFactory)
    end

    # serve is a noop, so can't test that
  end

  describe Thrift::SimpleServer do
    before(:each) do
      @processor = mock("Processor")
      @serverTrans = mock("ServerTransport")
      @trans = mock("BaseTransport")
      @prot = mock("BaseProtocol")
      @client = mock("Client")
      @server = described_class.new(@processor, @serverTrans, @trans, @prot)
    end
    
    it "should serve in the main thread" do
      @serverTrans.should_receive(:listen).ordered
      @serverTrans.should_receive(:accept).exactly(3).times.and_return(@client)
      @trans.should_receive(:get_transport).exactly(3).times.with(@client).and_return(@trans)
      @prot.should_receive(:get_protocol).exactly(3).times.with(@trans).and_return(@prot)
      x = 0
      @processor.should_receive(:process).exactly(3).times.with(@prot, @prot).and_return do
        case (x += 1)
        when 1 then raise Thrift::TransportException
        when 2 then raise Thrift::ProtocolException
        when 3 then throw :stop
        end
      end
      @trans.should_receive(:close).exactly(3).times
      @serverTrans.should_receive(:close).ordered
      lambda { @server.serve }.should throw_symbol(:stop)
    end
  end

  describe Thrift::ThreadedServer do
    before(:each) do
      @processor = mock("Processor")
      @serverTrans = mock("ServerTransport")
      @trans = mock("BaseTransport")
      @prot = mock("BaseProtocol")
      @client = mock("Client")
      @server = described_class.new(@processor, @serverTrans, @trans, @prot)
    end

    it "should serve using threads" do
      @serverTrans.should_receive(:listen).ordered
      @serverTrans.should_receive(:accept).exactly(3).times.and_return(@client)
      @trans.should_receive(:get_transport).exactly(3).times.with(@client).and_return(@trans)
      @prot.should_receive(:get_protocol).exactly(3).times.with(@trans).and_return(@prot)
      Thread.should_receive(:new).with(@prot, @trans).exactly(3).times.and_yield(@prot, @trans)
      x = 0
      @processor.should_receive(:process).exactly(3).times.with(@prot, @prot).and_return do
        case (x += 1)
        when 1 then raise Thrift::TransportException
        when 2 then raise Thrift::ProtocolException
        when 3 then throw :stop
        end
      end
      @trans.should_receive(:close).exactly(3).times
      @serverTrans.should_receive(:close).ordered
      lambda { @server.serve }.should throw_symbol(:stop)
    end
  end

  describe Thrift::ThreadPoolServer do
    before(:each) do
      @processor = mock("Processor")
      @server_trans = mock("ServerTransport")
      @trans = mock("BaseTransport")
      @prot = mock("BaseProtocol")
      @client = mock("Client")
      @server = described_class.new(@processor, @server_trans, @trans, @prot)
    end

    it "should serve inside a thread" do
      exception_q = @server.instance_variable_get(:@exception_q)
      described_class.any_instance.should_receive(:serve) do 
        exception_q.push(StandardError.new('ERROR'))
      end
      expect { @server.rescuable_serve }.to(raise_error('ERROR'))
    end

    it "should avoid running the server twice when retrying rescuable_serve" do
      exception_q = @server.instance_variable_get(:@exception_q)
      described_class.any_instance.should_receive(:serve) do 
        exception_q.push(StandardError.new('ERROR1'))
        exception_q.push(StandardError.new('ERROR2'))
      end
      expect { @server.rescuable_serve }.to(raise_error('ERROR1'))
      expect { @server.rescuable_serve }.to(raise_error('ERROR2'))
    end

    it "should serve using a thread pool" do
      thread_q = mock("SizedQueue")
      exception_q = mock("Queue")
      @server.instance_variable_set(:@thread_q, thread_q)
      @server.instance_variable_set(:@exception_q, exception_q)
      @server_trans.should_receive(:listen).ordered
      thread_q.should_receive(:push).with(:token)
      thread_q.should_receive(:pop)
      Thread.should_receive(:new).and_yield
      @server_trans.should_receive(:accept).exactly(3).times.and_return(@client)
      @trans.should_receive(:get_transport).exactly(3).times.and_return(@trans)
      @prot.should_receive(:get_protocol).exactly(3).times.and_return(@prot)
      x = 0
      error = RuntimeError.new("Stopped")
      @processor.should_receive(:process).exactly(3).times.with(@prot, @prot).and_return do
        case (x += 1)
        when 1 then raise Thrift::TransportException
        when 2 then raise Thrift::ProtocolException
        when 3 then raise error
        end
      end
      @trans.should_receive(:close).exactly(3).times
      exception_q.should_receive(:push).with(error).and_throw(:stop)
      @server_trans.should_receive(:close)
      expect { @server.serve }.to(throw_symbol(:stop))
    end
  end
end
