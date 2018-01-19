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

/**
 * Class for encoding and decoding Base64 data.
 *
 * This class is kept at package level because the interface does no input
 * validation and is therefore too low-level for generalized reuse.
 *
 * Note also that the encoding does not pad with equal signs , as discussed in
 * section 2.2 of the RFC (http://www.faqs.org/rfcs/rfc3548.html). Furthermore,
 * bad data encountered when decoding is neither rejected or ignored but simply
 * results in bad decoded data -- this is not in compliance with the RFC but is
 * done in the interest of performance.
 *
 */
class TBase64Utils {

  private static final String ENCODE_TABLE =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

  /**
   * Encode len bytes of data in src at offset srcOff, storing the result into
   * dst at offset dstOff. len must be 1, 2, or 3. dst must have at least len+1
   * bytes of space at dstOff. src and dst should not be the same object. This
   * method does no validation of the input values in the interest of
   * performance.
   *
   * @param src  the source of bytes to encode
   * @param srcOff  the offset into the source to read the unencoded bytes
   * @param len  the number of bytes to encode (must be 1, 2, or 3).
   * @param dst  the destination for the encoding
   * @param dstOff  the offset into the destination to place the encoded bytes
   */
  static final void encode(byte[] src, int srcOff, int len,  byte[] dst,
                           int dstOff) {
    dst[dstOff] = (byte)ENCODE_TABLE.charAt((src[srcOff] >> 2) & 0x3F);
    if (len == 3) {
      dst[dstOff + 1] =
        (byte)ENCODE_TABLE.charAt(
                         ((src[srcOff] << 4) & 0x30) | ((src[srcOff+1] >> 4) & 0x0F));
      dst[dstOff + 2] =
        (byte)ENCODE_TABLE.charAt(
                         ((src[srcOff+1] << 2) & 0x3C) | ((src[srcOff+2] >> 6) & 0x03));
      dst[dstOff + 3] =
        (byte)ENCODE_TABLE.charAt(src[srcOff+2] & 0x3F);
    }
    else if (len == 2) {
      dst[dstOff+1] =
        (byte)ENCODE_TABLE.charAt(
                          ((src[srcOff] << 4) & 0x30) | ((src[srcOff+1] >> 4) & 0x0F));
      dst[dstOff + 2] =
        (byte)ENCODE_TABLE.charAt((src[srcOff+1] << 2) & 0x3C);
    }
    else { // len == 1) {
      dst[dstOff + 1] =
        (byte)ENCODE_TABLE.charAt((src[srcOff] << 4) & 0x30);
    }
  }

  private static final byte[] DECODE_TABLE = {
    -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
    -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
    -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,62,-1,-1,-1,63,
    52,53,54,55,56,57,58,59,60,61,-1,-1,-1,-1,-1,-1,
    -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9,10,11,12,13,14,
    15,16,17,18,19,20,21,22,23,24,25,-1,-1,-1,-1,-1,
    -1,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,
    41,42,43,44,45,46,47,48,49,50,51,-1,-1,-1,-1,-1,
    -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
    -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
    -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
    -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
    -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
    -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
    -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
    -1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,-1,
  };

  /**
   * Decode len bytes of data in src at offset srcOff, storing the result into
   * dst at offset dstOff. len must be 2, 3, or 4. dst must have at least len-1
   * bytes of space at dstOff. src and dst may be the same object as long as
   * dstoff <= srcOff. This method does no validation of the input values in
   * the interest of performance.
   *
   * @param src  the source of bytes to decode
   * @param srcOff  the offset into the source to read the encoded bytes
   * @param len  the number of bytes to decode (must be 2, 3, or 4)
   * @param dst  the destination for the decoding
   * @param dstOff  the offset into the destination to place the decoded bytes
   */
  static final void decode(byte[] src, int srcOff, int len,  byte[] dst,
                           int dstOff) {
    dst[dstOff] = (byte)
      ((DECODE_TABLE[src[srcOff] & 0x0FF] << 2) |
       (DECODE_TABLE[src[srcOff+1] & 0x0FF] >> 4));
    if (len > 2) {
      dst[dstOff+1] = (byte)
        (((DECODE_TABLE[src[srcOff+1] & 0x0FF] << 4) & 0xF0) |
         (DECODE_TABLE[src[srcOff+2] & 0x0FF] >> 2));
      if (len > 3) {
        dst[dstOff+2] = (byte)
          (((DECODE_TABLE[src[srcOff+2] & 0x0FF] << 6) & 0xC0) |
           DECODE_TABLE[src[srcOff+3] & 0x0FF]);
      }
    }
  }
}
