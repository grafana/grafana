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

package org.apache.thrift.protocol;

import org.apache.thrift.TException;

/**
 * Protocol exceptions.
 *
 */
public class TProtocolException extends TException {


  private static final long serialVersionUID = 1L;
  public static final int UNKNOWN = 0;
  public static final int INVALID_DATA = 1;
  public static final int NEGATIVE_SIZE = 2;
  public static final int SIZE_LIMIT = 3;
  public static final int BAD_VERSION = 4;
  public static final int NOT_IMPLEMENTED = 5;
  public static final int DEPTH_LIMIT = 6;

  protected int type_ = UNKNOWN;

  public TProtocolException() {
    super();
  }

  public TProtocolException(int type) {
    super();
    type_ = type;
  }

  public TProtocolException(int type, String message) {
    super(message);
    type_ = type;
  }

  public TProtocolException(String message) {
    super(message);
  }

  public TProtocolException(int type, Throwable cause) {
    super(cause);
    type_ = type;
  }

  public TProtocolException(Throwable cause) {
    super(cause);
  }

  public TProtocolException(String message, Throwable cause) {
    super(message, cause);
  }

  public TProtocolException(int type, String message, Throwable cause) {
    super(message, cause);
    type_ = type;
  }

  public int getType() {
    return type_;
  }

}
