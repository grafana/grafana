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

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.IOException;

import java.net.URL;
import java.net.HttpURLConnection;
import java.util.HashMap;
import java.util.Map;

import org.apache.http.HttpEntity;
import org.apache.http.HttpHost;
import org.apache.http.HttpResponse;
import org.apache.http.HttpStatus;
import org.apache.http.client.HttpClient;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.entity.ByteArrayEntity;
import org.apache.http.params.CoreConnectionPNames;

/**
 * HTTP implementation of the TTransport interface. Used for working with a
 * Thrift web services implementation (using for example TServlet).
 *
 * This class offers two implementations of the HTTP transport.
 * One uses HttpURLConnection instances, the other HttpClient from Apache
 * Http Components.
 * The chosen implementation depends on the constructor used to
 * create the THttpClient instance.
 * Using the THttpClient(String url) constructor or passing null as the
 * HttpClient to THttpClient(String url, HttpClient client) will create an
 * instance which will use HttpURLConnection.
 *
 * When using HttpClient, the following configuration leads to 5-15% 
 * better performance than the HttpURLConnection implementation:
 *
 * http.protocol.version=HttpVersion.HTTP_1_1
 * http.protocol.content-charset=UTF-8
 * http.protocol.expect-continue=false
 * http.connection.stalecheck=false
 *
 * Also note that under high load, the HttpURLConnection implementation
 * may exhaust the open file descriptor limit.
 *
 * @see <a href="https://issues.apache.org/jira/browse/THRIFT-970">THRIFT-970</a>
 */

public class THttpClient extends TTransport {

  private URL url_ = null;

  private final ByteArrayOutputStream requestBuffer_ = new ByteArrayOutputStream();

  private InputStream inputStream_ = null;

  private int connectTimeout_ = 0;

  private int readTimeout_ = 0;

  private Map<String,String> customHeaders_ = null;

  private final HttpHost host;
  
  private final HttpClient client;
  
  public static class Factory extends TTransportFactory {
    
    private final String url;
    private final HttpClient client;
    
    public Factory(String url) {
      this.url = url;
      this.client = null;
    }

    public Factory(String url, HttpClient client) {
      this.url = url;
      this.client = client;
    }
    
    @Override
    public TTransport getTransport(TTransport trans) {
      try {
        if (null != client) {
          return new THttpClient(url, client);
        } else {
          return new THttpClient(url);
        }
      } catch (TTransportException tte) {
        return null;
      }
    }
  }

  public THttpClient(String url) throws TTransportException {
    try {
      url_ = new URL(url);
      this.client = null;
      this.host = null;
    } catch (IOException iox) {
      throw new TTransportException(iox);
    }
  }

  public THttpClient(String url, HttpClient client) throws TTransportException {
    try {
      url_ = new URL(url);
      this.client = client;
      this.host = new HttpHost(url_.getHost(), -1 == url_.getPort() ? url_.getDefaultPort() : url_.getPort(), url_.getProtocol());
    } catch (IOException iox) {
      throw new TTransportException(iox);
    }
  }

  public void setConnectTimeout(int timeout) {
    connectTimeout_ = timeout;
    if (null != this.client) {
      // WARNING, this modifies the HttpClient params, this might have an impact elsewhere if the
      // same HttpClient is used for something else.
      client.getParams().setParameter(CoreConnectionPNames.CONNECTION_TIMEOUT, connectTimeout_);
    }
  }

  public void setReadTimeout(int timeout) {
    readTimeout_ = timeout;
    if (null != this.client) {
      // WARNING, this modifies the HttpClient params, this might have an impact elsewhere if the
      // same HttpClient is used for something else.
      client.getParams().setParameter(CoreConnectionPNames.SO_TIMEOUT, readTimeout_);
    }
  }

  public void setCustomHeaders(Map<String,String> headers) {
    customHeaders_ = headers;
  }

  public void setCustomHeader(String key, String value) {
    if (customHeaders_ == null) {
      customHeaders_ = new HashMap<String, String>();
    }
    customHeaders_.put(key, value);
  }

  public void open() {}

  public void close() {
    if (null != inputStream_) {
      try {
        inputStream_.close();
      } catch (IOException ioe) {
        ;
      }
      inputStream_ = null;
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

  /**
   * copy from org.apache.http.util.EntityUtils#consume. Android has it's own httpcore
   * that doesn't have a consume.
   */
  private static void consume(final HttpEntity entity) throws IOException {
      if (entity == null) {
          return;
      }
      if (entity.isStreaming()) {
          InputStream instream = entity.getContent();
          if (instream != null) {
              instream.close();
          }
      }
  }

  private void flushUsingHttpClient() throws TTransportException {
    
    if (null == this.client) {
      throw new TTransportException("Null HttpClient, aborting.");
    }

    // Extract request and reset buffer
    byte[] data = requestBuffer_.toByteArray();
    requestBuffer_.reset();

    HttpPost post = null;
    
    InputStream is = null;
    
    try {      
      // Set request to path + query string
      post = new HttpPost(this.url_.getFile());
      
      //
      // Headers are added to the HttpPost instance, not
      // to HttpClient.
      //
      
      post.setHeader("Content-Type", "application/x-thrift");
      post.setHeader("Accept", "application/x-thrift");
      post.setHeader("User-Agent", "Java/THttpClient/HC");
      
      if (null != customHeaders_) {
        for (Map.Entry<String, String> header : customHeaders_.entrySet()) {
          post.setHeader(header.getKey(), header.getValue());
        }
      }

      post.setEntity(new ByteArrayEntity(data));
      
      HttpResponse response = this.client.execute(this.host, post);
      int responseCode = response.getStatusLine().getStatusCode();

      //      
      // Retrieve the inputstream BEFORE checking the status code so
      // resources get freed in the finally clause.
      //

      is = response.getEntity().getContent();
      
      if (responseCode != HttpStatus.SC_OK) {
        throw new TTransportException("HTTP Response code: " + responseCode);
      }

      // Read the responses into a byte array so we can release the connection
      // early. This implies that the whole content will have to be read in
      // memory, and that momentarily we might use up twice the memory (while the
      // thrift struct is being read up the chain).
      // Proceeding differently might lead to exhaustion of connections and thus
      // to app failure.
      
      byte[] buf = new byte[1024];
      ByteArrayOutputStream baos = new ByteArrayOutputStream();
      
      int len = 0;
      do {
        len = is.read(buf);
        if (len > 0) {
          baos.write(buf, 0, len);
        }
      } while (-1 != len);
      
      try {
        // Indicate we're done with the content.
        consume(response.getEntity());
      } catch (IOException ioe) {
        // We ignore this exception, it might only mean the server has no
        // keep-alive capability.
      }
            
      inputStream_ = new ByteArrayInputStream(baos.toByteArray());
    } catch (IOException ioe) {
      // Abort method so the connection gets released back to the connection manager
      if (null != post) {
        post.abort();
      }
      throw new TTransportException(ioe);
    } finally {
      if (null != is) {
        // Close the entity's input stream, this will release the underlying connection
        try {
          is.close();
        } catch (IOException ioe) {
          throw new TTransportException(ioe);
        }
      }
    }
  }

  public void flush() throws TTransportException {

    if (null != this.client) {
      flushUsingHttpClient();
      return;
    }

    // Extract request and reset buffer
    byte[] data = requestBuffer_.toByteArray();
    requestBuffer_.reset();

    try {
      // Create connection object
      HttpURLConnection connection = (HttpURLConnection)url_.openConnection();

      // Timeouts, only if explicitly set
      if (connectTimeout_ > 0) {
        connection.setConnectTimeout(connectTimeout_);
      }
      if (readTimeout_ > 0) {
        connection.setReadTimeout(readTimeout_);
      }

      // Make the request
      connection.setRequestMethod("POST");
      connection.setRequestProperty("Content-Type", "application/x-thrift");
      connection.setRequestProperty("Accept", "application/x-thrift");
      connection.setRequestProperty("User-Agent", "Java/THttpClient");
      if (customHeaders_ != null) {
        for (Map.Entry<String, String> header : customHeaders_.entrySet()) {
          connection.setRequestProperty(header.getKey(), header.getValue());
        }
      }
      connection.setDoOutput(true);
      connection.connect();
      connection.getOutputStream().write(data);

      int responseCode = connection.getResponseCode();
      if (responseCode != HttpURLConnection.HTTP_OK) {
        throw new TTransportException("HTTP Response code: " + responseCode);
      }

      // Read the responses
      inputStream_ = connection.getInputStream();

    } catch (IOException iox) {
      throw new TTransportException(iox);
    }
  }
}
