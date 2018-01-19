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

import java.io.ByteArrayInputStream;
import java.io.UnsupportedEncodingException;

import org.apache.thrift.protocol.TBinaryProtocol;
import org.apache.thrift.protocol.TProtocolFactory;
import org.apache.thrift.transport.TIOStreamTransport;

/**
 * Generic utility for easily deserializing objects from a byte array or Java
 * String.
 *
 */
public class TDeserializer {
  private final TProtocolFactory protocolFactory_;

  /**
   * Create a new TDeserializer that uses the TBinaryProtocol by default.
   */
  public TDeserializer() {
    this(new TBinaryProtocol.Factory());
  }

  /**
   * Create a new TDeserializer. It will use the TProtocol specified by the
   * factory that is passed in.
   *
   * @param protocolFactory Factory to create a protocol
   */
  public TDeserializer(TProtocolFactory protocolFactory) {
    protocolFactory_ = protocolFactory;
  }

  /**
   * Deserialize the Thrift object from a byte array.
   *
   * @param base The object to read into
   * @param bytes The array to read from
   */
  public void deserialize(TBase base, byte[] bytes) throws TException {
    base.read(
        protocolFactory_.getProtocol(
          new TIOStreamTransport(
            new ByteArrayInputStream(bytes))));
  }

  /**
   * Deserialize the Thrift object from a Java string, using a specified
   * character set for decoding.
   *
   * @param base The object to read into
   * @param data The string to read from
   * @param charset Valid JVM charset
   */
  public void deserialize(TBase base, String data, String charset) throws TException {
    try {
      deserialize(base, data.getBytes(charset));
    } catch (UnsupportedEncodingException uex) {
      throw new TException("JVM DOES NOT SUPPORT ENCODING: " + charset);
    }
  }

  /**
   * Deerialize the Thrift object from a Java string, using the default JVM
   * charset encoding.
   *
   * @param base The object to read into
   * @param data The string to read from
   * @return Serialized object as a String
   */
  public void toString(TBase base, String data) throws TException {
    deserialize(base, data.getBytes());
  }
}

