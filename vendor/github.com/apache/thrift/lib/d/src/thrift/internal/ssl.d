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
module thrift.internal.ssl;

import core.memory : GC;
import core.stdc.config;
import core.stdc.errno : errno;
import core.stdc.string : strerror;
import deimos.openssl.err;
import deimos.openssl.ssl;
import deimos.openssl.x509v3;
import std.array : empty, appender;
import std.conv : to;
import std.socket : Address;
import thrift.transport.ssl;

/**
 * Checks if the peer is authorized after the SSL handshake has been
 * completed on the given conncetion and throws an TSSLException if not.
 *
 * Params:
 *   ssl = The SSL connection to check.
 *   accessManager = The access manager to check the peer againts.
 *   peerAddress = The (IP) address of the peer.
 *   hostName = The host name of the peer.
 */
void authorize(SSL* ssl, TAccessManager accessManager,
  Address peerAddress, lazy string hostName
) {
  alias TAccessManager.Decision Decision;

  auto rc = SSL_get_verify_result(ssl);
  if (rc != X509_V_OK) {
    throw new TSSLException("SSL_get_verify_result(): " ~
      to!string(X509_verify_cert_error_string(rc)));
  }

  auto cert = SSL_get_peer_certificate(ssl);
  if (cert is null) {
    // Certificate is not present.
    if (SSL_get_verify_mode(ssl) & SSL_VERIFY_FAIL_IF_NO_PEER_CERT) {
      throw new TSSLException(
        "Authorize: Required certificate not present.");
    }

    // If we don't have an access manager set, we don't intend to authorize
    // the client, so everything's fine.
    if (accessManager) {
      throw new TSSLException(
        "Authorize: Certificate required for authorization.");
    }
    return;
  }

  if (accessManager is null) {
    // No access manager set, can return immediately as the cert is valid
    // and all peers are authorized.
    X509_free(cert);
    return;
  }

  // both certificate and access manager are present
  auto decision = accessManager.verify(peerAddress);

  if (decision != Decision.SKIP) {
    X509_free(cert);
    if (decision != Decision.ALLOW) {
      throw new TSSLException("Authorize: Access denied based on remote IP.");
    }
    return;
  }

  // Check subjectAltName(s), if present.
  auto alternatives = cast(STACK_OF!(GENERAL_NAME)*)
    X509_get_ext_d2i(cert, NID_subject_alt_name, null, null);
  if (alternatives != null) {
    auto count = sk_GENERAL_NAME_num(alternatives);
    for (int i = 0; decision == Decision.SKIP && i < count; i++) {
      auto name = sk_GENERAL_NAME_value(alternatives, i);
      if (name is null) {
        continue;
      }
      auto data = ASN1_STRING_data(name.d.ia5);
      auto length = ASN1_STRING_length(name.d.ia5);
      switch (name.type) {
        case GENERAL_NAME.GEN_DNS:
          decision = accessManager.verify(hostName, cast(char[])data[0 .. length]);
          break;
        case GENERAL_NAME.GEN_IPADD:
          decision = accessManager.verify(peerAddress, data[0 .. length]);
          break;
        default:
          // Do nothing.
      }
    }

    // DMD @@BUG@@: Empty template arguments parens should not be needed.
    sk_GENERAL_NAME_pop_free!()(alternatives, &GENERAL_NAME_free);
  }

  // If we are alredy done, return.
  if (decision != Decision.SKIP) {
    X509_free(cert);
    if (decision != Decision.ALLOW) {
      throw new TSSLException("Authorize: Access denied.");
    }
    return;
  }

  // Check commonName.
  auto name = X509_get_subject_name(cert);
  if (name !is null) {
    X509_NAME_ENTRY* entry;
    char* utf8;
    int last = -1;
    while (decision == Decision.SKIP) {
      last = X509_NAME_get_index_by_NID(name, NID_commonName, last);
      if (last == -1)
        break;
      entry = X509_NAME_get_entry(name, last);
      if (entry is null)
        continue;
      auto common = X509_NAME_ENTRY_get_data(entry);
      auto size = ASN1_STRING_to_UTF8(&utf8, common);
      decision = accessManager.verify(hostName, utf8[0 .. size]);
      CRYPTO_free(utf8);
    }
  }
  X509_free(cert);
  if (decision != Decision.ALLOW) {
    throw new TSSLException("Authorize: Could not authorize peer.");
  }
}

/*
 * OpenSSL error information used for storing D exceptions on the OpenSSL
 * error stack.
 */
enum ERR_LIB_D_EXCEPTION = ERR_LIB_USER;
enum ERR_F_D_EXCEPTION = 0; // function id - what to use here?
enum ERR_R_D_EXCEPTION = 1234; // 99 and above are reserved for applications
enum ERR_FILE_D_EXCEPTION = "d_exception";
enum ERR_LINE_D_EXCEPTION = 0;
enum ERR_FLAGS_D_EXCEPTION = 0;

/**
 * Returns an exception for the last.
 *
 * Params:
 *   location = An optional "location" to add to the error message (typically
 *     the last SSL API call).
 */
Exception getSSLException(string location = null, string clientFile = __FILE__,
  size_t clientLine = __LINE__
) {
  // We can return either an exception saved from D BIO code, or a "true"
  // OpenSSL error. Because there can possibly be more than one error on the
  // error stack, we have to fetch all of them, and pick the last, i.e. newest
  // one. We concatenate multiple successive OpenSSL error messages into a
  // single one, but always just return the last D expcetion.
  string message; // Probably better use an Appender here.
  bool hadMessage;
  Exception exception;

  void initMessage() {
    message.destroy();
    hadMessage = false;
    if (!location.empty) {
      message ~= location;
      message ~= ": ";
    }
  }
  initMessage();

  auto errn = errno;

  const(char)* file = void;
  int line = void;
  const(char)* data = void;
  int flags = void;
  c_ulong code = void;
  while ((code = ERR_get_error_line_data(&file, &line, &data, &flags)) != 0) {
    if (ERR_GET_REASON(code) == ERR_R_D_EXCEPTION) {
      initMessage();
      GC.removeRoot(cast(void*)data);
      exception = cast(Exception)data;
    } else {
      exception = null;

      if (hadMessage) {
        message ~= ", ";
      }

      auto reason = ERR_reason_error_string(code);
      if (reason) {
        message ~= "SSL error: " ~ to!string(reason);
      } else {
        message ~= "SSL error #" ~ to!string(code);
      }

      hadMessage = true;
    }
  }

  // If the last item from the stack was a D exception, throw it.
  if (exception) return exception;

  // We are dealing with an OpenSSL error that doesn't root in a D exception.
  if (!hadMessage) {
    // If we didn't get an actual error from the stack yet, try errno.
    string errnString;
    if (errn != 0) {
      errnString = to!string(strerror(errn));
    }
    if (errnString.empty) {
      message ~= "Unknown error";
    } else {
      message ~= errnString;
    }
  }

  message ~= ".";
  return new TSSLException(message, clientFile, clientLine);
}
