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

import java.io.UnsupportedEncodingException;
import java.util.Map;

import javax.security.auth.callback.CallbackHandler;
import javax.security.sasl.Sasl;
import javax.security.sasl.SaslClient;
import javax.security.sasl.SaslException;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Wraps another Thrift <code>TTransport</code>, but performs SASL client
 * negotiation on the call to <code>open()</code>. This class will wrap ensuing
 * communication over it, if a SASL QOP is negotiated with the other party.
 */
public class TSaslClientTransport extends TSaslTransport {

  private static final Logger LOGGER = LoggerFactory.getLogger(TSaslClientTransport.class);

  /**
   * The name of the mechanism this client supports.
   */
  private final String mechanism;

  /**
   * Uses the given <code>SaslClient</code>.
   * 
   * @param saslClient
   *          The <code>SaslClient</code> to use for the subsequent SASL
   *          negotiation.
   * @param transport
   *          Transport underlying this one.
   */
  public TSaslClientTransport(SaslClient saslClient, TTransport transport) {
    super(saslClient, transport);
    mechanism = saslClient.getMechanismName();
  }

  /**
   * Creates a <code>SaslClient</code> using the given SASL-specific parameters.
   * See the Java documentation for <code>Sasl.createSaslClient</code> for the
   * details of the parameters.
   * 
   * @param transport
   *          The underlying Thrift transport.
   * @throws SaslException
   */
  public TSaslClientTransport(String mechanism, String authorizationId, String protocol,
      String serverName, Map<String, String> props, CallbackHandler cbh, TTransport transport)
      throws SaslException {
    super(Sasl.createSaslClient(new String[] { mechanism }, authorizationId, protocol, serverName,
        props, cbh), transport);
    this.mechanism = mechanism;
  }


  @Override
  protected SaslRole getRole() {
    return SaslRole.CLIENT;
  }

  /**
   * Performs the client side of the initial portion of the Thrift SASL
   * protocol. Generates and sends the initial response to the server, including
   * which mechanism this client wants to use.
   */
  @Override
  protected void handleSaslStartMessage() throws TTransportException, SaslException {
    SaslClient saslClient = getSaslClient();

    byte[] initialResponse = new byte[0];
    if (saslClient.hasInitialResponse())
      initialResponse = saslClient.evaluateChallenge(initialResponse);

    LOGGER.debug("Sending mechanism name {} and initial response of length {}", mechanism,
        initialResponse.length);

    byte[] mechanismBytes;
	try {
		mechanismBytes = mechanism.getBytes("UTF-8");
	} catch (UnsupportedEncodingException e) {
		throw new TTransportException(e);
	}
    sendSaslMessage(NegotiationStatus.START,
                    mechanismBytes);
    // Send initial response
    sendSaslMessage(saslClient.isComplete() ? NegotiationStatus.COMPLETE : NegotiationStatus.OK,
                    initialResponse);
    underlyingTransport.flush();
  }
}
