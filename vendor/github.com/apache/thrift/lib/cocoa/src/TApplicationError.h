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

#import "TProtocol.h"

extern NSString *TApplicationErrorDomain;

typedef NS_ENUM (int, TApplicationError) {
  TApplicationErrorUnknown                = 0,
  TApplicationErrorUnknownMethod          = 1,
  TApplicationErrorInvalidMessageType     = 2,
  TApplicationErrorWrongMethodName        = 3,
  TApplicationErrorBadSequenceId          = 4,
  TApplicationErrorMissingResult          = 5,
  TApplicationErrorInternalError          = 6,
  TApplicationErrorProtocolError          = 7,
  TApplicationErrorInvalidTransform       = 8,
  TApplicationErrorInvalidProtocol        = 9,
  TApplicationErrorUnsupportedClientType  = 10,
};


extern NSString *TApplicationErrorNameKey;
extern NSString *TApplicationErrorReasonKey;
extern NSString *TApplicationErrorMethodKey;


@interface NSError (TApplicationError)

@property (readonly, copy) NSString *name;
@property (readonly, copy) NSString *reason;

+(instancetype) errorWithType:(TApplicationError)type reason:(NSString *)reason;

+(instancetype) read:(id<TProtocol>)protocol;

-(BOOL) write:(id<TProtocol>)outProtocol error:(NSError *__autoreleasing *)error;

@end
