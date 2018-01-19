/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership. The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

package org.apache.thrift;

import org.apache.thrift.protocol.TMessage;
import org.apache.thrift.protocol.TMessageType;
import org.apache.thrift.protocol.TProtocol;

/**
 * A TServiceClient is used to communicate with a TService implementation
 * across protocols and transports.
 */
public abstract class TServiceClient {
  public TServiceClient(TProtocol prot) {
    this(prot, prot);
  }

  public TServiceClient(TProtocol iprot, TProtocol oprot) {
    iprot_ = iprot;
    oprot_ = oprot;
  }

  protected TProtocol iprot_;
  protected TProtocol oprot_;

  protected int seqid_;

  /**
   * Get the TProtocol being used as the input (read) protocol.
   * @return the TProtocol being used as the input (read) protocol.
   */
  public TProtocol getInputProtocol() {
    return this.iprot_;
  }

  /**
   * Get the TProtocol being used as the output (write) protocol.
   * @return the TProtocol being used as the output (write) protocol.
   */
  public TProtocol getOutputProtocol() {
    return this.oprot_;
  }

  protected void sendBase(String methodName, TBase<?,?> args) throws TException {
    sendBase(methodName, args, TMessageType.CALL);
  }

  protected void sendBaseOneway(String methodName, TBase<?,?> args) throws TException {
    sendBase(methodName, args, TMessageType.ONEWAY);
  }

  private void sendBase(String methodName, TBase<?,?> args, byte type) throws TException {
    oprot_.writeMessageBegin(new TMessage(methodName, type, ++seqid_));
    args.write(oprot_);
    oprot_.writeMessageEnd();
    oprot_.getTransport().flush();
  }

  protected void receiveBase(TBase<?,?> result, String methodName) throws TException {
    TMessage msg = iprot_.readMessageBegin();
    if (msg.type == TMessageType.EXCEPTION) {
      TApplicationException x = new TApplicationException();
      x.read(iprot_);
      iprot_.readMessageEnd();
      throw x;
    }
    System.out.format("Received %d%n", msg.seqid);
    if (msg.seqid != seqid_) {
      throw new TApplicationException(TApplicationException.BAD_SEQUENCE_ID,
          String.format("%s failed: out of sequence response: expected %d but got %d", methodName, seqid_, msg.seqid));
    }
    result.read(iprot_);
    iprot_.readMessageEnd();
  }
}
