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

describe 'NonblockingServer' do

  class Handler
    def initialize
      @queue = Queue.new
    end

    attr_accessor :server

    def greeting(english)
      if english
        SpecNamespace::Hello.new
      else
        SpecNamespace::Hello.new(:greeting => "Aloha!")
      end
    end

    def block
      @queue.pop
    end

    def unblock(n)
      n.times { @queue.push true }
    end

    def sleep(time)
      Kernel.sleep time
    end

    def shutdown
      @server.shutdown(0, false)
    end
  end

  class SpecTransport < Thrift::BaseTransport
    def initialize(transport, queue)
      @transport = transport
      @queue = queue
      @flushed = false
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
      @transport.read(sz)
    end

    def write(buf,sz=nil)
      @transport.write(buf, sz)
    end

    def flush
      @queue.push :flushed unless @flushed or @queue.nil?
      @flushed = true
      @transport.flush
    end
  end

  class SpecServerSocket < Thrift::ServerSocket
    def initialize(host, port, queue)
      super(host, port)
      @queue = queue
    end

    def listen
      super
      @queue.push :listen
    end
  end

  describe Thrift::NonblockingServer do
    before(:each) do
      @port = 43251
      handler = Handler.new
      processor = SpecNamespace::NonblockingService::Processor.new(handler)
      queue = Queue.new
      @transport = SpecServerSocket.new('localhost', @port, queue)
      transport_factory = Thrift::FramedTransportFactory.new
      logger = Logger.new(STDERR)
      logger.level = Logger::WARN
      @server = Thrift::NonblockingServer.new(processor, @transport, transport_factory, nil, 5, logger)
      handler.server = @server
      @server_thread = Thread.new(Thread.current) do |master_thread|
        begin
          @server.serve
        rescue => e
          p e
          puts e.backtrace * "\n"
          master_thread.raise e
        end
      end
      queue.pop

      @clients = []
      @catch_exceptions = false
    end

    after(:each) do
      @clients.each { |client, trans| trans.close }
      # @server.shutdown(1)
      @server_thread.kill
      @transport.close
    end

    def setup_client(queue = nil)
      transport = SpecTransport.new(Thrift::FramedTransport.new(Thrift::Socket.new('localhost', @port)), queue)
      protocol = Thrift::BinaryProtocol.new(transport)
      client = SpecNamespace::NonblockingService::Client.new(protocol)
      transport.open
      @clients << [client, transport]
      client
    end

    def setup_client_thread(result)
      queue = Queue.new
      Thread.new do
        begin
          client = setup_client
          while (cmd = queue.pop)
            msg, *args = cmd
            case msg
            when :block
              result << client.block
            when :unblock
              client.unblock(args.first)
            when :hello
              result << client.greeting(true) # ignore result
            when :sleep
              client.sleep(args[0] || 0.5)
              result << :slept
            when :shutdown
              client.shutdown
            when :exit
              result << :done
              break
            end
          end
          @clients.each { |c,t| t.close and break if c == client } #close the transport
        rescue => e
          raise e unless @catch_exceptions
        end
      end
      queue
    end

    it "should handle basic message passing" do
      client = setup_client
      client.greeting(true).should == SpecNamespace::Hello.new
      client.greeting(false).should == SpecNamespace::Hello.new(:greeting => 'Aloha!')
      @server.shutdown
    end

    it "should handle concurrent clients" do
      queue = Queue.new
      trans_queue = Queue.new
      4.times do
        Thread.new(Thread.current) do |main_thread|
          begin
            queue.push setup_client(trans_queue).block
          rescue => e
            main_thread.raise e
          end
        end
      end
      4.times { trans_queue.pop }
      setup_client.unblock(4)
      4.times { queue.pop.should be_true }
      @server.shutdown
    end

    it "should handle messages from more than 5 long-lived connections" do
      queues = []
      result = Queue.new
      7.times do |i|
        queues << setup_client_thread(result)
        Thread.pass if i == 4 # give the server time to accept connections
      end
      client = setup_client
      # block 4 connections
      4.times { |i| queues[i] << :block }
      queues[4] << :hello
      queues[5] << :hello
      queues[6] << :hello
      3.times { result.pop.should == SpecNamespace::Hello.new }
      client.greeting(true).should == SpecNamespace::Hello.new
      queues[5] << [:unblock, 4]
      4.times { result.pop.should be_true }
      queues[2] << :hello
      result.pop.should == SpecNamespace::Hello.new
      client.greeting(false).should == SpecNamespace::Hello.new(:greeting => 'Aloha!')
      7.times { queues.shift << :exit }
      client.greeting(true).should == SpecNamespace::Hello.new
      @server.shutdown
    end

    it "should shut down when asked" do
      # connect first to ensure it's running
      client = setup_client
      client.greeting(false) # force a message pass
      @server.shutdown
      @server_thread.join(2).should be_an_instance_of(Thread)
    end

    it "should continue processing active messages when shutting down" do
      result = Queue.new
      client = setup_client_thread(result)
      client << :sleep
      sleep 0.1 # give the server time to start processing the client's message
      @server.shutdown
      @server_thread.join(2).should be_an_instance_of(Thread)
      result.pop.should == :slept
    end

    it "should kill active messages when they don't expire while shutting down" do
      result = Queue.new
      client = setup_client_thread(result)
      client << [:sleep, 10]
      sleep 0.1 # start processing the client's message
      @server.shutdown(1)
      @catch_exceptions = true
      @server_thread.join(3).should_not be_nil
      result.should be_empty
    end

    it "should allow shutting down in response to a message" do
      client = setup_client
      client.greeting(true).should == SpecNamespace::Hello.new
      client.shutdown
      @server_thread.join(2).should_not be_nil
    end
  end
end
