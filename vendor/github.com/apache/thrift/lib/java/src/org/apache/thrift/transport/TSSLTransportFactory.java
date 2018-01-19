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

import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.InputStream;
import java.io.IOException;
import java.net.InetAddress;
import java.net.URL;
import java.net.MalformedURLException;
import java.security.KeyStore;
import java.util.Arrays;

import javax.net.ssl.KeyManagerFactory;
import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLServerSocket;
import javax.net.ssl.SSLServerSocketFactory;
import javax.net.ssl.SSLSocket;
import javax.net.ssl.SSLSocketFactory;
import javax.net.ssl.TrustManagerFactory;

/**
 *  A Factory for providing and setting up Client and Server SSL wrapped
 *  TSocket and TServerSocket
 */
public class TSSLTransportFactory {

  /**
   * Get a SSL wrapped TServerSocket bound to the specified port. In this
   * configuration the default settings are used. Default settings are retrieved
   * from System properties that are set.
   *
   * Example system properties:
   * -Djavax.net.ssl.trustStore=&lt;truststore location&gt;
   * -Djavax.net.ssl.trustStorePassword=password
   * -Djavax.net.ssl.keyStore=&lt;keystore location&gt;
   * -Djavax.net.ssl.keyStorePassword=password
   *
   * @param port
   * @return A SSL wrapped TServerSocket
   * @throws TTransportException
   */
  public static TServerSocket getServerSocket(int port) throws TTransportException {
    return getServerSocket(port, 0);
  }

  /**
   * Get a default SSL wrapped TServerSocket bound to the specified port
   *
   * @param port
   * @param clientTimeout
   * @return A SSL wrapped TServerSocket
   * @throws TTransportException
   */
  public static TServerSocket getServerSocket(int port, int clientTimeout) throws TTransportException {
    return getServerSocket(port, clientTimeout, false, null);
  }

  /**
   * Get a default SSL wrapped TServerSocket bound to the specified port and interface
   *
   * @param port
   * @param clientTimeout
   * @param ifAddress
   * @return A SSL wrapped TServerSocket
   * @throws TTransportException
   */
  public static TServerSocket getServerSocket(int port, int clientTimeout, boolean clientAuth, InetAddress ifAddress) throws TTransportException {
    SSLServerSocketFactory factory = (SSLServerSocketFactory) SSLServerSocketFactory.getDefault();
    return createServer(factory, port, clientTimeout, clientAuth, ifAddress, null);
  }

  /**
   * Get a configured SSL wrapped TServerSocket bound to the specified port and interface.
   * Here the TSSLTransportParameters are used to set the values for the algorithms, keystore,
   * truststore and other settings
   *
   * @param port
   * @param clientTimeout
   * @param ifAddress
   * @param params
   * @return A SSL wrapped TServerSocket
   * @throws TTransportException
   */
  public static TServerSocket getServerSocket(int port, int clientTimeout, InetAddress ifAddress, TSSLTransportParameters params) throws TTransportException {
    if (params == null || !(params.isKeyStoreSet || params.isTrustStoreSet)) {
      throw new TTransportException("Either one of the KeyStore or TrustStore must be set for SSLTransportParameters");
    }

    SSLContext ctx = createSSLContext(params);
    return createServer(ctx.getServerSocketFactory(), port, clientTimeout, params.clientAuth, ifAddress, params);
  }

  private static TServerSocket createServer(SSLServerSocketFactory factory, int port, int timeout, boolean clientAuth,
                                    InetAddress ifAddress, TSSLTransportParameters params) throws TTransportException {
    try {
      SSLServerSocket serverSocket = (SSLServerSocket) factory.createServerSocket(port, 100, ifAddress);
      serverSocket.setSoTimeout(timeout);
      serverSocket.setNeedClientAuth(clientAuth);
      if (params != null && params.cipherSuites != null) {
        serverSocket.setEnabledCipherSuites(params.cipherSuites);
      }
      return new TServerSocket(new TServerSocket.ServerSocketTransportArgs().
        serverSocket(serverSocket).clientTimeout(timeout));
    } catch (Exception e) {
      throw new TTransportException("Could not bind to port " + port, e);
    }
  }

  /**
   * Get a default SSL wrapped TSocket connected to the specified host and port. All
   * the client methods return a bound connection. So there is no need to call open() on the
   * TTransport.
   *
   * @param host
   * @param port
   * @param timeout
   * @return A SSL wrapped TSocket
   * @throws TTransportException
   */
  public static TSocket getClientSocket(String host, int port, int timeout) throws TTransportException {
    SSLSocketFactory factory = (SSLSocketFactory) SSLSocketFactory.getDefault();
    return createClient(factory, host, port, timeout);
  }

  /**
   * Get a default SSL wrapped TSocket connected to the specified host and port.
   *
   * @param host
   * @param port
   * @return A SSL wrapped TSocket
   * @throws TTransportException
   */
  public static TSocket getClientSocket(String host, int port) throws TTransportException {
    return getClientSocket(host, port, 0);
  }

  /**
   * Get a custom configured SSL wrapped TSocket. The SSL settings are obtained from the
   * passed in TSSLTransportParameters.
   *
   * @param host
   * @param port
   * @param timeout
   * @param params
   * @return A SSL wrapped TSocket
   * @throws TTransportException
   */
  public static TSocket getClientSocket(String host, int port, int timeout, TSSLTransportParameters params) throws TTransportException {
    if (params == null || !(params.isKeyStoreSet || params.isTrustStoreSet)) {
      throw new TTransportException("Either one of the KeyStore or TrustStore must be set for SSLTransportParameters");
    }

    SSLContext ctx = createSSLContext(params);
    return createClient(ctx.getSocketFactory(), host, port, timeout);
  }

  private static SSLContext createSSLContext(TSSLTransportParameters params) throws TTransportException {
    SSLContext ctx;
    InputStream in = null;
    InputStream is = null;

    try {
      ctx = SSLContext.getInstance(params.protocol);
      TrustManagerFactory tmf = null;
      KeyManagerFactory kmf = null;

      if (params.isTrustStoreSet) {
        tmf = TrustManagerFactory.getInstance(params.trustManagerType);
        KeyStore ts = KeyStore.getInstance(params.trustStoreType);
        in = getStoreAsStream(params.trustStore);
        ts.load(in,
                (params.trustPass != null ? params.trustPass.toCharArray() : null));
        tmf.init(ts);
      }

      if (params.isKeyStoreSet) {
        kmf = KeyManagerFactory.getInstance(params.keyManagerType);
        KeyStore ks = KeyStore.getInstance(params.keyStoreType);
        is = getStoreAsStream(params.keyStore);
        ks.load(is, params.keyPass.toCharArray());
        kmf.init(ks, params.keyPass.toCharArray());
      }

      if (params.isKeyStoreSet && params.isTrustStoreSet) {
        ctx.init(kmf.getKeyManagers(), tmf.getTrustManagers(), null);
      }
      else if (params.isKeyStoreSet) {
        ctx.init(kmf.getKeyManagers(), null, null);
      }
      else {
        ctx.init(null, tmf.getTrustManagers(), null);
      }

    } catch (Exception e) {
      throw new TTransportException("Error creating the transport", e);
    } finally {
      if (in != null) {
        try {
          in.close();
        } catch (IOException e) {
          e.printStackTrace();
        }
      }
      if (is != null) {
        try {
          is.close();
        } catch (IOException e) {
          e.printStackTrace();
        }
      }
    }

    return ctx;
  }

  private static InputStream getStoreAsStream(String store) throws IOException {
    try {
      return new FileInputStream(store);
    } catch(FileNotFoundException e) {
    }

    InputStream storeStream = null;
    try {
      storeStream = new URL(store).openStream();
      if (storeStream != null) {
        return storeStream;
      }
    } catch(MalformedURLException e) {
    }

    storeStream = Thread.currentThread().getContextClassLoader().getResourceAsStream(store);

    if (storeStream != null) {
      return storeStream;
    } else {
      throw new IOException("Could not load file: " + store);
    }
  }

  private static TSocket createClient(SSLSocketFactory factory, String host, int port, int timeout) throws TTransportException {
    try {
      SSLSocket socket = (SSLSocket) factory.createSocket(host, port);
      socket.setSoTimeout(timeout);
      return new TSocket(socket);
    } catch (Exception e) {
      throw new TTransportException("Could not connect to " + host + " on port " + port, e);
    }
  }


  /**
   * A Class to hold all the SSL parameters
   */
  public static class TSSLTransportParameters {
    protected String protocol = "TLS";
    protected String keyStore;
    protected String keyPass;
    protected String keyManagerType = KeyManagerFactory.getDefaultAlgorithm();
    protected String keyStoreType = "JKS";
    protected String trustStore;
    protected String trustPass;
    protected String trustManagerType = TrustManagerFactory.getDefaultAlgorithm();
    protected String trustStoreType = "JKS";
    protected String[] cipherSuites;
    protected boolean clientAuth = false;
    protected boolean isKeyStoreSet = false;
    protected boolean isTrustStoreSet = false;

    public TSSLTransportParameters() {}

    /**
     * Create parameters specifying the protocol and cipher suites
     *
     * @param protocol The specific protocol (TLS/SSL) can be specified with versions
     * @param cipherSuites
     */
    public TSSLTransportParameters(String protocol, String[] cipherSuites) {
      this(protocol, cipherSuites, false);
    }

    /**
     * Create parameters specifying the protocol, cipher suites and if client authentication
     * is required
     *
     * @param protocol The specific protocol (TLS/SSL) can be specified with versions
     * @param cipherSuites
     * @param clientAuth
     */
    public TSSLTransportParameters(String protocol, String[] cipherSuites, boolean clientAuth) {
      if (protocol != null) {
        this.protocol = protocol;
      }
      this.cipherSuites = cipherSuites != null ? Arrays.copyOf(cipherSuites, cipherSuites.length) : null;
      this.clientAuth = clientAuth;
    }

    /**
     * Set the keystore, password, certificate type and the store type
     *
     * @param keyStore Location of the Keystore on disk
     * @param keyPass Keystore password
     * @param keyManagerType The default is X509
     * @param keyStoreType The default is JKS
     */
    public void setKeyStore(String keyStore, String keyPass, String keyManagerType, String keyStoreType) {
      this.keyStore = keyStore;
      this.keyPass = keyPass;
      if (keyManagerType != null) {
        this.keyManagerType = keyManagerType;
      }
      if (keyStoreType != null) {
        this.keyStoreType = keyStoreType;
      }
      isKeyStoreSet = true;
    }

    /**
     * Set the keystore and password
     *
     * @param keyStore Location of the Keystore on disk
     * @param keyPass Keystore password
     */
    public void setKeyStore(String keyStore, String keyPass) {
      setKeyStore(keyStore, keyPass, null, null);
    }

    /**
     * Set the truststore, password, certificate type and the store type
     *
     * @param trustStore Location of the Truststore on disk
     * @param trustPass Truststore password
     * @param trustManagerType The default is X509
     * @param trustStoreType The default is JKS
     */
    public void setTrustStore(String trustStore, String trustPass, String trustManagerType, String trustStoreType) {
      this.trustStore = trustStore;
      this.trustPass = trustPass;
      if (trustManagerType != null) {
        this.trustManagerType = trustManagerType;
      }
      if (trustStoreType != null) {
        this.trustStoreType = trustStoreType;
      }
      isTrustStoreSet = true;
    }

    /**
     * Set the truststore and password
     *
     * @param trustStore Location of the Truststore on disk
     * @param trustPass Truststore password
     */
    public void setTrustStore(String trustStore, String trustPass) {
      setTrustStore(trustStore, trustPass, null, null);
    }

    /**
     * Set if client authentication is required
     *
     * @param clientAuth
     */
    public void requireClientAuth(boolean clientAuth) {
      this.clientAuth = clientAuth;
    }
  }
}
