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

describe 'BaseTransport' do

  describe Thrift::TransportException do
    it "should make type accessible" do
      exc = Thrift::TransportException.new(Thrift::TransportException::ALREADY_OPEN, "msg")
      exc.type.should == Thrift::TransportException::ALREADY_OPEN
      exc.message.should == "msg"
    end
  end

  describe Thrift::BaseTransport do
    it "should read the specified size" do
      transport = Thrift::BaseTransport.new
      transport.should_receive(:read).with(40).ordered.and_return("10 letters")
      transport.should_receive(:read).with(30).ordered.and_return("fifteen letters")
      transport.should_receive(:read).with(15).ordered.and_return("more characters")
      transport.read_all(40).should == "10 lettersfifteen lettersmore characters"
    end

    it "should stub out the rest of the methods" do
      # can't test for stubbiness, so just make sure they're defined
      [:open?, :open, :close, :read, :write, :flush].each do |sym|
        Thrift::BaseTransport.method_defined?(sym).should be_true
      end
    end

    it "should alias << to write" do
      Thrift::BaseTransport.instance_method(:<<).should == Thrift::BaseTransport.instance_method(:write)
    end
  end

  describe Thrift::BaseServerTransport do
    it "should stub out its methods" do
      [:listen, :accept, :close].each do |sym|
        Thrift::BaseServerTransport.method_defined?(sym).should be_true
      end
    end
  end

  describe Thrift::BaseTransportFactory do
    it "should return the transport it's given" do
      transport = mock("Transport")
      Thrift::BaseTransportFactory.new.get_transport(transport).should eql(transport)
    end
  end

  describe Thrift::BufferedTransport do
    it "should pass through everything but write/flush/read" do
      trans = mock("Transport")
      trans.should_receive(:open?).ordered.and_return("+ open?")
      trans.should_receive(:open).ordered.and_return("+ open")
      trans.should_receive(:flush).ordered # from the close
      trans.should_receive(:close).ordered.and_return("+ close")
      btrans = Thrift::BufferedTransport.new(trans)
      btrans.open?.should == "+ open?"
      btrans.open.should == "+ open"
      btrans.close.should == "+ close"
    end

    it "should buffer reads in chunks of #{Thrift::BufferedTransport::DEFAULT_BUFFER}" do
      trans = mock("Transport")
      trans.should_receive(:read).with(Thrift::BufferedTransport::DEFAULT_BUFFER).and_return("lorum ipsum dolor emet")
      btrans = Thrift::BufferedTransport.new(trans)
      btrans.read(6).should == "lorum "
      btrans.read(6).should == "ipsum "
      btrans.read(6).should == "dolor "
      btrans.read(6).should == "emet"
    end

    it "should buffer writes and send them on flush" do
      trans = mock("Transport")
      btrans = Thrift::BufferedTransport.new(trans)
      btrans.write("one/")
      btrans.write("two/")
      btrans.write("three/")
      trans.should_receive(:write).with("one/two/three/").ordered
      trans.should_receive(:flush).ordered
      btrans.flush
    end

    it "should only send buffered data once" do
      trans = mock("Transport")
      btrans = Thrift::BufferedTransport.new(trans)
      btrans.write("one/")
      btrans.write("two/")
      btrans.write("three/")
      trans.should_receive(:write).with("one/two/three/")
      trans.stub!(:flush)
      btrans.flush
      # Nothing to flush with no data
      btrans.flush
    end

    it "should flush on close" do
      trans = mock("Transport")
      trans.should_receive(:close)
      btrans = Thrift::BufferedTransport.new(trans)
      btrans.should_receive(:flush)
      btrans.close
    end

    it "should not write to socket if there's no data" do
      trans = mock("Transport")
      trans.should_receive(:flush)
      btrans = Thrift::BufferedTransport.new(trans)
      btrans.flush
    end
  end

  describe Thrift::BufferedTransportFactory do
    it "should wrap the given transport in a BufferedTransport" do
      trans = mock("Transport")
      btrans = mock("BufferedTransport")
      Thrift::BufferedTransport.should_receive(:new).with(trans).and_return(btrans)
      Thrift::BufferedTransportFactory.new.get_transport(trans).should == btrans
    end
  end

  describe Thrift::FramedTransport do
    before(:each) do
      @trans = mock("Transport")
    end

    it "should pass through open?/open/close" do
      ftrans = Thrift::FramedTransport.new(@trans)
      @trans.should_receive(:open?).ordered.and_return("+ open?")
      @trans.should_receive(:open).ordered.and_return("+ open")
      @trans.should_receive(:close).ordered.and_return("+ close")
      ftrans.open?.should == "+ open?"
      ftrans.open.should == "+ open"
      ftrans.close.should == "+ close"
    end

    it "should pass through read when read is turned off" do
      ftrans = Thrift::FramedTransport.new(@trans, false, true)
      @trans.should_receive(:read).with(17).ordered.and_return("+ read")
      ftrans.read(17).should == "+ read"
    end

    it "should pass through write/flush when write is turned off" do
      ftrans = Thrift::FramedTransport.new(@trans, true, false)
      @trans.should_receive(:write).with("foo").ordered.and_return("+ write")
      @trans.should_receive(:flush).ordered.and_return("+ flush")
      ftrans.write("foo").should == "+ write"
      ftrans.flush.should == "+ flush"
    end

    it "should return a full frame if asked for >= the frame's length" do
      frame = "this is a frame"
      @trans.should_receive(:read_all).with(4).and_return("\000\000\000\017")
      @trans.should_receive(:read_all).with(frame.length).and_return(frame)
      Thrift::FramedTransport.new(@trans).read(frame.length + 10).should == frame
    end

    it "should return slices of the frame when asked for < the frame's length" do
      frame = "this is a frame"
      @trans.should_receive(:read_all).with(4).and_return("\000\000\000\017")
      @trans.should_receive(:read_all).with(frame.length).and_return(frame)
      ftrans = Thrift::FramedTransport.new(@trans)
      ftrans.read(4).should == "this"
      ftrans.read(4).should == " is "
      ftrans.read(16).should == "a frame"
    end

    it "should return nothing if asked for <= 0" do
      Thrift::FramedTransport.new(@trans).read(-2).should == ""
    end

    it "should pull a new frame when the first is exhausted" do
      frame = "this is a frame"
      frame2 = "yet another frame"
      @trans.should_receive(:read_all).with(4).and_return("\000\000\000\017", "\000\000\000\021")
      @trans.should_receive(:read_all).with(frame.length).and_return(frame)
      @trans.should_receive(:read_all).with(frame2.length).and_return(frame2)
      ftrans = Thrift::FramedTransport.new(@trans)
      ftrans.read(4).should == "this"
      ftrans.read(8).should == " is a fr"
      ftrans.read(6).should == "ame"
      ftrans.read(4).should == "yet "
      ftrans.read(16).should == "another frame"
    end

    it "should buffer writes" do
      ftrans = Thrift::FramedTransport.new(@trans)
      @trans.should_not_receive(:write)
      ftrans.write("foo")
      ftrans.write("bar")
      ftrans.write("this is a frame")
    end

    it "should write slices of the buffer" do
      ftrans = Thrift::FramedTransport.new(@trans)
      ftrans.write("foobar", 3)
      ftrans.write("barfoo", 1)
      @trans.stub!(:flush)
      @trans.should_receive(:write).with("\000\000\000\004foob")
      ftrans.flush
    end

    it "should flush frames with a 4-byte header" do
      ftrans = Thrift::FramedTransport.new(@trans)
      @trans.should_receive(:write).with("\000\000\000\035one/two/three/this is a frame").ordered
      @trans.should_receive(:flush).ordered
      ftrans.write("one/")
      ftrans.write("two/")
      ftrans.write("three/")
      ftrans.write("this is a frame")
      ftrans.flush
    end

    it "should not flush the same buffered data twice" do
      ftrans = Thrift::FramedTransport.new(@trans)
      @trans.should_receive(:write).with("\000\000\000\007foo/bar")
      @trans.stub!(:flush)
      ftrans.write("foo")
      ftrans.write("/bar")
      ftrans.flush
      @trans.should_receive(:write).with("\000\000\000\000")
      ftrans.flush
    end
  end

  describe Thrift::FramedTransportFactory do
    it "should wrap the given transport in a FramedTransport" do
      trans = mock("Transport")
      Thrift::FramedTransport.should_receive(:new).with(trans)
      Thrift::FramedTransportFactory.new.get_transport(trans)
    end
  end

  describe Thrift::MemoryBufferTransport do
    before(:each) do
      @buffer = Thrift::MemoryBufferTransport.new
    end

    it "should accept a buffer on input and use it directly" do
      s = "this is a test"
      @buffer = Thrift::MemoryBufferTransport.new(s)
      @buffer.read(4).should == "this"
      s.slice!(-4..-1)
      @buffer.read(@buffer.available).should == " is a "
    end

    it "should always remain open" do
      @buffer.should be_open
      @buffer.close
      @buffer.should be_open
    end

    it "should respond to peek and available" do
      @buffer.write "some data"
      @buffer.peek.should be_true
      @buffer.available.should == 9
      @buffer.read(4)
      @buffer.peek.should be_true
      @buffer.available.should == 5
      @buffer.read(5)
      @buffer.peek.should be_false
      @buffer.available.should == 0
    end

    it "should be able to reset the buffer" do
      @buffer.write "test data"
      @buffer.reset_buffer("foobar")
      @buffer.available.should == 6
      @buffer.read(@buffer.available).should == "foobar"
      @buffer.reset_buffer
      @buffer.available.should == 0
    end

    it "should copy the given string when resetting the buffer" do
      s = "this is a test"
      @buffer.reset_buffer(s)
      @buffer.available.should == 14
      @buffer.read(10)
      @buffer.available.should == 4
      s.should == "this is a test"
    end

    it "should return from read what was given in write" do
      @buffer.write "test data"
      @buffer.read(4).should == "test"
      @buffer.read(@buffer.available).should == " data"
      @buffer.write "foo"
      @buffer.write " bar"
      @buffer.read(@buffer.available).should == "foo bar"
    end

    it "should throw an EOFError when there isn't enough data in the buffer" do
      @buffer.reset_buffer("")
      lambda{@buffer.read(1)}.should raise_error(EOFError)

      @buffer.reset_buffer("1234")
      lambda{@buffer.read(5)}.should raise_error(EOFError)
    end
  end

  describe Thrift::IOStreamTransport do
    before(:each) do
      @input = mock("Input", :closed? => false)
      @output = mock("Output", :closed? => false)
      @trans = Thrift::IOStreamTransport.new(@input, @output)
    end

    it "should be open as long as both input or output are open" do
      @trans.should be_open
      @input.stub!(:closed?).and_return(true)
      @trans.should be_open
      @input.stub!(:closed?).and_return(false)
      @output.stub!(:closed?).and_return(true)
      @trans.should be_open
      @input.stub!(:closed?).and_return(true)
      @trans.should_not be_open
    end

    it "should pass through read/write to input/output" do
      @input.should_receive(:read).with(17).and_return("+ read")
      @output.should_receive(:write).with("foobar").and_return("+ write")
      @trans.read(17).should == "+ read"
      @trans.write("foobar").should == "+ write"
    end

    it "should close both input and output when closed" do
      @input.should_receive(:close)
      @output.should_receive(:close)
      @trans.close
    end
  end
end
