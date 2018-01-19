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
import java.util.HashMap;
import java.util.Map;

import javax.security.sasl.Sasl;
import javax.security.sasl.SaslClient;
import javax.security.sasl.SaslException;
import javax.security.sasl.SaslServer;

import org.apache.thrift.EncodingUtils;
import org.apache.thrift.TByteArrayOutputStream;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * A superclass for SASL client/server thrift transports. A subclass need only
 * implement the <code>open</code> method.
 */
abstract class TSaslTransport extends TTransport {

  private static final Logger LOGGER = LoggerFactory.getLogger(TSaslTransport.class);

  protected static final int DEFAULT_MAX_LENGTH = 0x7FFFFFFF;

  protected static final int MECHANISM_NAME_BYTES = 1;
  protected static final int STATUS_BYTES = 1;
  protected static final int PAYLOAD_LENGTH_BYTES = 4;

  protected static enum SaslRole {
    SERVER, CLIENT;
  }

  /**
   * Status bytes used during the initial Thrift SASL handshake.
   */
  protected static enum NegotiationStatus {
    START((byte)0x01),
    OK((byte)0x02),
    BAD((byte)0x03),
    ERROR((byte)0x04),
    COMPLETE((byte)0x05);

    private final byte value;

    private static final Map<Byte, NegotiationStatus> reverseMap =
      new HashMap<Byte, NegotiationStatus>();
    static {
      for (NegotiationStatus s : NegotiationStatus.class.getEnumConstants()) {
        reverseMap.put(s.getValue(), s);
      }
    }

    private NegotiationStatus(byte val) {
      this.value = val;
    }

    public byte getValue() {
      return value;
    }

    public static NegotiationStatus byValue(byte val) {
      return reverseMap.get(val);
    }
  }

  /**
   * Transport underlying this one.
   */
  protected TTransport underlyingTransport;

  /**
   * Either a SASL client or a SASL server.
   */
  private SaslParticipant sasl;

  /**
   * Whether or not we should wrap/unwrap reads/writes. Determined by whether or
   * not a QOP is negotiated during the SASL handshake.
   */
  private boolean shouldWrap = false;

  /**
   * Buffer for input.
   */
  private TMemoryInputTransport readBuffer = new TMemoryInputTransport();

  /**
   * Buffer for output.
   */
  private final TByteArrayOutputStream writeBuffer = new TByteArrayOutputStream(1024);

  /**
   * Create a TSaslTransport. It's assumed that setSaslServer will be called
   * later to initialize the SASL endpoint underlying this transport.
   *
   * @param underlyingTransport
   *          The thrift transport which this transport is wrapping.
   */
  protected TSaslTransport(TTransport underlyingTransport) {
    this.underlyingTransport = underlyingTransport;
  }

  /**
   * Create a TSaslTransport which acts as a client.
   *
   * @param saslClient
   *          The <code>SaslClient</code> which this transport will use for SASL
   *          negotiation.
   * @param underlyingTransport
   *          The thrift transport which this transport is wrapping.
   */
  protected TSaslTransport(SaslClient saslClient, TTransport underlyingTransport) {
    sasl = new SaslParticipant(saslClient);
    this.underlyingTransport = underlyingTransport;
  }

  protected void setSaslServer(SaslServer saslServer) {
    sasl = new SaslParticipant(saslServer);
  }

  // Used to read the status byte and payload length.
  private final byte[] messageHeader = new byte[STATUS_BYTES + PAYLOAD_LENGTH_BYTES];

  /**
   * Send a complete Thrift SASL message.
   *
   * @param status
   *          The status to send.
   * @param payload
   *          The data to send as the payload of this message.
   * @throws TTransportException
   */
  protected void sendSaslMessage(NegotiationStatus status, byte[] payload) throws TTransportException {
    if (payload == null)
      payload = new byte[0];

    messageHeader[0] = status.getValue();
    EncodingUtils.encodeBigEndian(payload.length, messageHeader, STATUS_BYTES);

    if (LOGGER.isDebugEnabled())
      LOGGER.debug(getRole() + ": Writing message with status {} and payload length {}",
                   status, payload.length);
    underlyingTransport.write(messageHeader);
    underlyingTransport.write(payload);
    underlyingTransport.flush();
  }

  /**
   * Read a complete Thrift SASL message.
   *
   * @return The SASL status and payload from this message.
   * @throws TTransportException
   *           Thrown if there is a failure reading from the underlying
   *           transport, or if a status code of BAD or ERROR is encountered.
   */
  protected SaslResponse receiveSaslMessage() throws TTransportException {
    underlyingTransport.readAll(messageHeader, 0, messageHeader.length);

    byte statusByte = messageHeader[0];

    NegotiationStatus status = NegotiationStatus.byValue(statusByte);
    if (status == null) {
      throw sendAndThrowMessage(NegotiationStatus.ERROR, "Invalid status " + statusByte);
    }

    int payloadBytes = EncodingUtils.decodeBigEndian(messageHeader, STATUS_BYTES);
    if (payloadBytes < 0 || payloadBytes > 104857600 /* 100 MB */) {
      throw sendAndThrowMessage(
        NegotiationStatus.ERROR, "Invalid payload header length: " + payloadBytes);
    }

    byte[] payload = new byte[payloadBytes];
    underlyingTransport.readAll(payload, 0, payload.length);

    if (status == NegotiationStatus.BAD || status == NegotiationStatus.ERROR) {
      try {
        String remoteMessage = new String(payload, "UTF-8");
        throw new TTransportException("Peer indicated failure: " + remoteMessage);
      } catch (UnsupportedEncodingException e) {
        throw new TTransportException(e);
      }
    }

    if (LOGGER.isDebugEnabled())
      LOGGER.debug(getRole() + ": Received message with status {} and payload length {}",
                   status, payload.length);
    return new SaslResponse(status, payload);
  }

  /**
   * Send a Thrift SASL message with the given status (usually BAD or ERROR) and
   * string message, and then throw a TTransportException with the given
   * message.
   *
   * @param status
   *          The Thrift SASL status code to send. Usually BAD or ERROR.
   * @param message
   *          The optional message to send to the other side.
   * @throws TTransportException
   *           Always thrown with the message provided.
   * @return always throws TTransportException but declares return type to allow
   *          throw sendAndThrowMessage(...) to inform compiler control flow
   */
  protected TTransportException sendAndThrowMessage(NegotiationStatus status, String message) throws TTransportException {
    try {
      sendSaslMessage(status, message.getBytes("UTF-8"));
    } catch (Exception e) {
      LOGGER.warn("Could not send failure response", e);
      message += "\nAlso, could not send response: " + e.toString();
    }
    throw new TTransportException(message);
  }

  /**
   * Implemented by subclasses to start the Thrift SASL handshake process. When
   * this method completes, the <code>SaslParticipant</code> in this class is
   * assumed to be initialized.
   *
   * @throws TTransportException
   * @throws SaslException
   */
  abstract protected void handleSaslStartMessage() throws TTransportException, SaslException;

  protected abstract SaslRole getRole();

  /**
   * Opens the underlying transport if it's not already open and then performs
   * SASL negotiation. If a QOP is negotiated during this SASL handshake, it used
   * for all communication on this transport after this call is complete.
   */
  @Override
  public void open() throws TTransportException {
    /*
     * readSaslHeader is used to tag whether the SASL header has been read properly.
     * If there is a problem in reading the header, there might not be any
     * data in the stream, possibly a TCP health check from load balancer.
     */
    boolean readSaslHeader = false;

    LOGGER.debug("opening transport {}", this);
    if (sasl != null && sasl.isComplete())
      throw new TTransportException("SASL transport already open");

    if (!underlyingTransport.isOpen())
      underlyingTransport.open();

    try {
      // Negotiate a SASL mechanism. The client also sends its
      // initial response, or an empty one.
      handleSaslStartMessage();
      readSaslHeader = true;
      LOGGER.debug("{}: Start message handled", getRole());

      SaslResponse message = null;
      while (!sasl.isComplete()) {
        message = receiveSaslMessage();
        if (message.status != NegotiationStatus.COMPLETE &&
            message.status != NegotiationStatus.OK) {
          throw new TTransportException("Expected COMPLETE or OK, got " + message.status);
        }

        byte[] challenge = sasl.evaluateChallengeOrResponse(message.payload);

        // If we are the client, and the server indicates COMPLETE, we don't need to
        // send back any further response.
        if (message.status == NegotiationStatus.COMPLETE &&
            getRole() == SaslRole.CLIENT) {
          LOGGER.debug("{}: All done!", getRole());
          break;
        }

        sendSaslMessage(sasl.isComplete() ? NegotiationStatus.COMPLETE : NegotiationStatus.OK,
                        challenge);
      }
      LOGGER.debug("{}: Main negotiation loop complete", getRole());

      assert sasl.isComplete();

      // If we're the client, and we're complete, but the server isn't
      // complete yet, we need to wait for its response. This will occur
      // with ANONYMOUS auth, for example, where we send an initial response
      // and are immediately complete.
      if (getRole() == SaslRole.CLIENT &&
          (message == null || message.status == NegotiationStatus.OK)) {
        LOGGER.debug("{}: SASL Client receiving last message", getRole());
        message = receiveSaslMessage();
        if (message.status != NegotiationStatus.COMPLETE) {
          throw new TTransportException(
            "Expected SASL COMPLETE, but got " + message.status);
        }
      }
    } catch (SaslException e) {
      try {
        LOGGER.error("SASL negotiation failure", e);
        throw sendAndThrowMessage(NegotiationStatus.BAD, e.getMessage());
      } finally {
        underlyingTransport.close();
      }
    } catch (TTransportException e) {
      /*
       * If there is no-data or no-sasl header in the stream, throw a different
       * type of exception so we can handle this scenario differently.
       */
      if (!readSaslHeader && e.getType() == TTransportException.END_OF_FILE) {
        underlyingTransport.close();
        LOGGER.debug("No data or no sasl data in the stream");
        throw new TSaslTransportException("No data or no sasl data in the stream");
      }
      throw e;
    }

    String qop = (String) sasl.getNegotiatedProperty(Sasl.QOP);
    if (qop != null && !qop.equalsIgnoreCase("auth"))
      shouldWrap = true;
  }

  /**
   * Get the underlying <code>SaslClient</code>.
   *
   * @return The <code>SaslClient</code>, or <code>null</code> if this transport
   *         is backed by a <code>SaslServer</code>.
   */
  public SaslClient getSaslClient() {
    return sasl.saslClient;
  }

  /**
   * Get the underlying transport that Sasl is using.
   * @return The <code>TTransport</code> transport
   */
   public TTransport getUnderlyingTransport() {
     return underlyingTransport;
   }

  /**
   * Get the underlying <code>SaslServer</code>.
   *
   * @return The <code>SaslServer</code>, or <code>null</code> if this transport
   *         is backed by a <code>SaslClient</code>.
   */
  public SaslServer getSaslServer() {
    return sasl.saslServer;
  }

  /**
   * Read a 4-byte word from the underlying transport and interpret it as an
   * integer.
   *
   * @return The length prefix of the next SASL message to read.
   * @throws TTransportException
   *           Thrown if reading from the underlying transport fails.
   */
  protected int readLength() throws TTransportException {
    byte[] lenBuf = new byte[4];
    underlyingTransport.readAll(lenBuf, 0, lenBuf.length);
    return EncodingUtils.decodeBigEndian(lenBuf);
  }

  /**
   * Write the given integer as 4 bytes to the underlying transport.
   *
   * @param length
   *          The length prefix of the next SASL message to write.
   * @throws TTransportException
   *           Thrown if writing to the underlying transport fails.
   */
  protected void writeLength(int length) throws TTransportException {
    byte[] lenBuf = new byte[4];
    TFramedTransport.encodeFrameSize(length, lenBuf);
    underlyingTransport.write(lenBuf);
  }

  // Below is the SASL implementation of the TTransport interface.

  /**
   * Closes the underlying transport and disposes of the SASL implementation
   * underlying this transport.
   */
  @Override
  public void close() {
    underlyingTransport.close();
    try {
      sasl.dispose();
    } catch (SaslException e) {
      // Not much we can do here.
    }
  }

  /**
   * True if the underlying transport is open and the SASL handshake is
   * complete.
   */
  @Override
  public boolean isOpen() {
    return underlyingTransport.isOpen() && sasl != null && sasl.isComplete();
  }

  /**
   * Read from the underlying transport. Unwraps the contents if a QOP was
   * negotiated during the SASL handshake.
   */
  @Override
  public int read(byte[] buf, int off, int len) throws TTransportException {
    if (!isOpen())
      throw new TTransportException("SASL authentication not complete");

    int got = readBuffer.read(buf, off, len);
    if (got > 0) {
      return got;
    }

    // Read another frame of data
    try {
      readFrame();
    } catch (SaslException e) {
      throw new TTransportException(e);
    }

    return readBuffer.read(buf, off, len);
  }

  /**
   * Read a single frame of data from the underlying transport, unwrapping if
   * necessary.
   *
   * @throws TTransportException
   *           Thrown if there's an error reading from the underlying transport.
   * @throws SaslException
   *           Thrown if there's an error unwrapping the data.
   */
  private void readFrame() throws TTransportException, SaslException {
    int dataLength = readLength();

    if (dataLength < 0)
      throw new TTransportException("Read a negative frame size (" + dataLength + ")!");

    byte[] buff = new byte[dataLength];
    LOGGER.debug("{}: reading data length: {}", getRole(), dataLength);
    underlyingTransport.readAll(buff, 0, dataLength);
    if (shouldWrap) {
      buff = sasl.unwrap(buff, 0, buff.length);
      LOGGER.debug("data length after unwrap: {}", buff.length);
    }
    readBuffer.reset(buff);
  }

  /**
   * Write to the underlying transport.
   */
  @Override
  public void write(byte[] buf, int off, int len) throws TTransportException {
    if (!isOpen())
      throw new TTransportException("SASL authentication not complete");

    writeBuffer.write(buf, off, len);
  }

  /**
   * Flushes to the underlying transport. Wraps the contents if a QOP was
   * negotiated during the SASL handshake.
   */
  @Override
  public void flush() throws TTransportException {
    byte[] buf = writeBuffer.get();
    int dataLength = writeBuffer.len();
    writeBuffer.reset();

    if (shouldWrap) {
      LOGGER.debug("data length before wrap: {}", dataLength);
      try {
        buf = sasl.wrap(buf, 0, dataLength);
      } catch (SaslException e) {
        throw new TTransportException(e);
      }
      dataLength = buf.length;
    }
    LOGGER.debug("writing data length: {}", dataLength);
    writeLength(dataLength);
    underlyingTransport.write(buf, 0, dataLength);
    underlyingTransport.flush();
  }

  /**
   * Used exclusively by readSaslMessage to return both a status and data.
   */
  protected static class SaslResponse {
    public NegotiationStatus status;
    public byte[] payload;

    public SaslResponse(NegotiationStatus status, byte[] payload) {
      this.status = status;
      this.payload = payload;
    }
  }

  /**
   * Used to abstract over the <code>SaslServer</code> and
   * <code>SaslClient</code> classes, which share a lot of their interface, but
   * unfortunately don't share a common superclass.
   */
  private static class SaslParticipant {
    // One of these will always be null.
    public SaslServer saslServer;
    public SaslClient saslClient;

    public SaslParticipant(SaslServer saslServer) {
      this.saslServer = saslServer;
    }

    public SaslParticipant(SaslClient saslClient) {
      this.saslClient = saslClient;
    }

    public byte[] evaluateChallengeOrResponse(byte[] challengeOrResponse) throws SaslException {
      if (saslClient != null) {
        return saslClient.evaluateChallenge(challengeOrResponse);
      } else {
        return saslServer.evaluateResponse(challengeOrResponse);
      }
    }

    public boolean isComplete() {
      if (saslClient != null)
        return saslClient.isComplete();
      else
        return saslServer.isComplete();
    }

    public void dispose() throws SaslException {
      if (saslClient != null)
        saslClient.dispose();
      else
        saslServer.dispose();
    }

    public byte[] unwrap(byte[] buf, int off, int len) throws SaslException {
      if (saslClient != null)
        return saslClient.unwrap(buf, off, len);
      else
        return saslServer.unwrap(buf, off, len);
    }

    public byte[] wrap(byte[] buf, int off, int len) throws SaslException {
      if (saslClient != null)
        return saslClient.wrap(buf, off, len);
      else
        return saslServer.wrap(buf, off, len);
    }

    public Object getNegotiatedProperty(String propName) {
      if (saslClient != null)
        return saslClient.getNegotiatedProperty(propName);
      else
        return saslServer.getNegotiatedProperty(propName);
    }
  }
}
