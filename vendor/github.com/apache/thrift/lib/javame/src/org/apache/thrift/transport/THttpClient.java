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

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.Enumeration;
import java.util.Hashtable;

import javax.microedition.io.Connector;
import javax.microedition.io.HttpConnection;

/**
 * HTTP implementation of the TTransport interface. Used for working with a
 * Thrift web services implementation.
 *
 */
public class THttpClient extends TTransport {

  private String url_ = null;

  private final ByteArrayOutputStream requestBuffer_ = new ByteArrayOutputStream();

  private InputStream inputStream_ = null;

  private HttpConnection connection = null;

  private int connectTimeout_ = 0;

  private int readTimeout_ = 0;

  private Hashtable customHeaders_ = null;

  public THttpClient(String url) throws TTransportException {
    url_ = url;
  }

  public void setConnectTimeout(int timeout) {
    connectTimeout_ = timeout;
  }

  public void setReadTimeout(int timeout) {
    readTimeout_ = timeout;
  }

  public void setCustomHeaders(Hashtable headers) {
    customHeaders_ = headers;
  }

  public void setCustomHeader(String key, String value) {
    if (customHeaders_ == null) {
      customHeaders_ = new Hashtable();
    }
    customHeaders_.put(key, value);
  }

  public void open() {}

  public void close() {
    if (null != inputStream_) {
      try {
        inputStream_.close();
      } catch (IOException ioe) {
      }
      inputStream_ = null;
    }

    if (connection != null) {
      try {
        connection.close();
      } catch (IOException ioe) {
      }
      connection = null;
    }
  }

  public boolean isOpen() {
    return true;
  }

  public int read(byte[] buf, int off, int len) throws TTransportException {
    if (inputStream_ == null) {
      throw new TTransportException("Response buffer is empty, no request.");
    }
    try {
      int ret = inputStream_.read(buf, off, len);
      if (ret == -1) {
        throw new TTransportException("No more data available.");
      }
      return ret;
    } catch (IOException iox) {
      throw new TTransportException(iox);
    }
  }

  public void write(byte[] buf, int off, int len) {
    requestBuffer_.write(buf, off, len);
  }
  
  public void flush() throws TTransportException {
    // Extract request and reset buffer
    byte[] data = requestBuffer_.toByteArray();
    requestBuffer_.reset();

    try {
      // Create connection object
      connection = (HttpConnection)Connector.open(url_);
  
      // Make the request
      connection.setRequestMethod("POST");
      connection.setRequestProperty("Content-Type", "application/x-thrift");
      connection.setRequestProperty("Accept", "application/x-thrift");
      connection.setRequestProperty("User-Agent", "JavaME/THttpClient");

      connection.setRequestProperty("Connection", "Keep-Alive");
      connection.setRequestProperty("Keep-Alive", "5000");
      connection.setRequestProperty("Http-version", "HTTP/1.1");
      connection.setRequestProperty("Cache-Control", "no-transform");

      if (customHeaders_ != null) {
        for (Enumeration e = customHeaders_.keys() ; e.hasMoreElements() ;) {
          String key = (String)e.nextElement();
          String value = (String)customHeaders_.get(key);
          connection.setRequestProperty(key, value);
        }
      }
  
      OutputStream os = connection.openOutputStream();
      os.write(data);
      os.close();

      int responseCode = connection.getResponseCode();
      if (responseCode != HttpConnection.HTTP_OK) {
        throw new TTransportException("HTTP Response code: " + responseCode);
      }

      // Read the responses
      inputStream_ = connection.openInputStream();
    } catch (IOException iox) {
      System.out.println(iox.toString());
      throw new TTransportException(iox);
    }
  }
}
