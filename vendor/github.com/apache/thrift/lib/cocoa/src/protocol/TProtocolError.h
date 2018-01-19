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

#import "TError.h"


extern NSString *TProtocolErrorDomain;

typedef NS_ENUM (int, TProtocolError) {
  TProtocolErrorUnknown                   = 0,
  TProtocolErrorInvalidData               = 1,
  TProtocolErrorNegativeSize              = 2,
  TProtocolErrorSizeLimit                 = 3,
  TProtocolErrorBadVersion                = 4,
  TProtocolErrorNotImplemented            = 5,
  TProtocolErrorDepthLimit                = 6,
};


typedef NS_ENUM(int, TProtocolExtendedError) {
  TProtocolExtendedErrorMissingRequiredField  = 1001,
  TProtocolExtendedErrorUnexpectedType        = 1002,
  TProtocolExtendedErrorMismatchedProtocol    = 1003,
};

extern NSString *TProtocolErrorExtendedErrorKey;
extern NSString *TProtocolErrorFieldNameKey;
extern NSString *TProtocolErrorExpectedIdKey;
extern NSString *TProtocolErrorExpectedVersionKey;
extern NSString *TProtocolErrorTypeKey;
extern NSString *TProtocolErrorSourceLineKey;
extern NSString *TProtocolErrorSourceFileKey;
extern NSString *TProtocolErrorSourceMethodKey;
extern NSString *TProtocolErrorMessageNameKey;


#define PROTOCOL_ERROR(ret, err, ...) \
  if (error) {  \
    *error = [NSError errorWithDomain:TProtocolErrorDomain \
                                 code:TProtocolError ## err \
                             userInfo:@{NSLocalizedDescriptionKey: [NSString stringWithFormat:__VA_ARGS__], \
                                        @"SourceFile": [NSString stringWithUTF8String:__FILE__], \
                                        @"SourceLine": @(__LINE__), \
                                        @"SourceFunction": [NSString stringWithUTF8String:__PRETTY_FUNCTION__], \
                                        @"Message": self.currentMessageName ? self.currentMessageName : @""}]; \
  } \
  return ret

#define PROTOCOL_TRANSPORT_ERROR(ret, errorPtr, ...) \
  if (errorPtr) { \
    *error = [NSError errorWithDomain:TProtocolErrorDomain \
                                 code:TProtocolErrorUnknown \
                             userInfo:@{NSLocalizedDescriptionKey: [[NSString stringWithFormat:__VA_ARGS__] stringByAppendingFormat:@": %@", [(*errorPtr) localizedDescription]], \
                                        TProtocolErrorSourceFileKey: [NSString stringWithUTF8String:__FILE__], \
                                        TProtocolErrorSourceLineKey: @(__LINE__), \
                                        TProtocolErrorSourceMethodKey: [NSString stringWithUTF8String:__PRETTY_FUNCTION__], \
                                        TProtocolErrorMessageNameKey: self.currentMessageName ? self.currentMessageName : @"", \
                                        NSUnderlyingErrorKey: *errorPtr}]; \
  } \
  return ret
