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

shared_examples_for "a socket" do
  it "should open a socket" do
    @socket.open.should == @handle
  end

  it "should be open whenever it has a handle" do
    @socket.should_not be_open
    @socket.open
    @socket.should be_open
    @socket.handle = nil
    @socket.should_not be_open
    @socket.handle = @handle
    @socket.close
    @socket.should_not be_open
  end

  it "should write data to the handle" do
    @socket.open
    @handle.should_receive(:write).with("foobar")
    @socket.write("foobar")
    @handle.should_receive(:write).with("fail").and_raise(StandardError)
    lambda { @socket.write("fail") }.should raise_error(Thrift::TransportException) { |e| e.type.should == Thrift::TransportException::NOT_OPEN }
  end

  it "should raise an error when it cannot read from the handle" do
    @socket.open
    @handle.should_receive(:readpartial).with(17).and_raise(StandardError)
    lambda { @socket.read(17) }.should raise_error(Thrift::TransportException) { |e| e.type.should == Thrift::TransportException::NOT_OPEN }
  end

  it "should return the data read when reading from the handle works" do
    @socket.open
    @handle.should_receive(:readpartial).with(17).and_return("test data")
    @socket.read(17).should == "test data"
  end

  it "should declare itself as closed when it has an error" do
    @socket.open
    @handle.should_receive(:write).with("fail").and_raise(StandardError)
    @socket.should be_open
    lambda { @socket.write("fail") }.should raise_error
    @socket.should_not be_open
  end

  it "should raise an error when the stream is closed" do
    @socket.open
    @handle.stub!(:closed?).and_return(true)
    @socket.should_not be_open
    lambda { @socket.write("fail") }.should raise_error(IOError, "closed stream")
    lambda { @socket.read(10) }.should raise_error(IOError, "closed stream")
  end

  it "should support the timeout accessor for read" do
    @socket.timeout = 3
    @socket.open
    IO.should_receive(:select).with([@handle], nil, nil, 3).and_return([[@handle], [], []])
    @handle.should_receive(:readpartial).with(17).and_return("test data")
    @socket.read(17).should == "test data"
  end

  it "should support the timeout accessor for write" do
    @socket.timeout = 3
    @socket.open
    IO.should_receive(:select).with(nil, [@handle], nil, 3).twice.and_return([[], [@handle], []])
    @handle.should_receive(:write_nonblock).with("test data").and_return(4)
    @handle.should_receive(:write_nonblock).with(" data").and_return(5)
    @socket.write("test data").should == 9
  end

  it "should raise an error when read times out" do
    @socket.timeout = 0.5
    @socket.open
    IO.should_receive(:select).once {sleep(0.5); nil}
    lambda { @socket.read(17) }.should raise_error(Thrift::TransportException) { |e| e.type.should == Thrift::TransportException::TIMED_OUT }
  end

  it "should raise an error when write times out" do
    @socket.timeout = 0.5
    @socket.open
    IO.should_receive(:select).with(nil, [@handle], nil, 0.5).any_number_of_times.and_return(nil)
    lambda { @socket.write("test data") }.should raise_error(Thrift::TransportException) { |e| e.type.should == Thrift::TransportException::TIMED_OUT }
  end
end
