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

package org.apache.thrift.transport;

import org.apache.thrift.TException;

/**
 * Transport exceptions.
 *
 */
public class TTransportException extends TException {

  private static final long serialVersionUID = 1L;

  public static final int UNKNOWN = 0;
  public static final int NOT_OPEN = 1;
  public static final int ALREADY_OPEN = 2;
  public static final int TIMED_OUT = 3;
  public static final int END_OF_FILE = 4;

  protected int type_ = UNKNOWN;

  public TTransportException() {
    super();
  }

  public TTransportException(int type) {
    super();
    type_ = type;
  }

  public TTransportException(int type, String message) {
    super(message);
    type_ = type;
  }

  public TTransportException(String message) {
    super(message);
  }

  public TTransportException(int type, Throwable cause) {
    super(cause);
    type_ = type;
  }

  public TTransportException(Throwable cause) {
    super(cause);
  }

  public TTransportException(String message, Throwable cause) {
    super(message, cause);
  }

  public TTransportException(int type, String message, Throwable cause) {
    super(message, cause);
    type_ = type;
  }

  public int getType() {
    return type_;
  }

}
