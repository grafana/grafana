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

#import "TApplicationError.h"
#import "TProtocolUtil.h"


NSString *TApplicationErrorDomain = @"TApplicationErrorDomain";


NSString *TApplicationErrorNameKey = @"name";
NSString *TApplicationErrorReasonKey = @"reason";
NSString *TApplicationErrorMethodKey = @"method";


@implementation NSError (TApplicationError)

-(NSString *) reason
{
  return self.userInfo[TApplicationErrorReasonKey];
}

-(NSString *) name
{
  return self.userInfo[TApplicationErrorNameKey];
}

+(instancetype) errorWithType:(TApplicationError)type reason:(NSString *)reason
{
  NSString *name;
  switch (type) {
  case TApplicationErrorUnknownMethod:
    name = @"Unknown Method";
    break;

  case TApplicationErrorInvalidMessageType:
    name = @"Invalid Message Type";
    break;

  case TApplicationErrorWrongMethodName:
    name = @"Wrong Method Name";
    break;

  case TApplicationErrorBadSequenceId:
    name = @"Bad Sequence ID";
    break;

  case TApplicationErrorMissingResult:
    name = @"Missing Result";
    break;

  case TApplicationErrorInternalError:
    name = @"Internal Error";
    break;

  case TApplicationErrorProtocolError:
    name = @"Protocol Error";
    break;

  case TApplicationErrorInvalidTransform:
    name = @"Invalid Transform";
    break;

  case TApplicationErrorInvalidProtocol:
    name = @"Invalid Protocol";
    break;

  case TApplicationErrorUnsupportedClientType:
    name = @"Unsupported Client Type";
    break;

  default:
    name = @"Unknown";
    break;
  }

  NSDictionary *userInfo;
  if (reason) {
    userInfo = @{TApplicationErrorNameKey:name,
                 TApplicationErrorReasonKey:reason};
  }
  else {
    userInfo = @{TApplicationErrorNameKey:name};
  }

  return [NSError errorWithDomain:TApplicationErrorDomain
                             code:type
                         userInfo:userInfo];
}


+(instancetype) read:(id<TProtocol>)protocol
{
  NSString *reason = nil;
  SInt32 type = TApplicationErrorUnknown;
  SInt32 fieldType;
  SInt32 fieldID;

  NSError *error;
  if (![protocol readStructBeginReturningName:NULL error:&error]) {
    return error;
  }

  while (true) {

    if (![protocol readFieldBeginReturningName:NULL
                                          type:&fieldType
                                       fieldID:&fieldID
                                         error:&error])
    {
      return error;
    }

    if (fieldType == TTypeSTOP) {
      break;
    }

    switch (fieldID) {
    case 1:
      if (fieldType == TTypeSTRING) {
        if (![protocol readString:&reason error:&error]) {
          return error;
        }
      }
      else {
        if (![TProtocolUtil skipType:fieldType onProtocol:protocol error:&error]) {
          return error;
        }
      }
      break;

    case 2:
      if (fieldType == TTypeI32) {
        if (![protocol readI32:&type error:&error]) {
          return error;
        }
      }
      else {
        if (![TProtocolUtil skipType:fieldType onProtocol:protocol error:&error]) {
          return error;
        }
      }
      break;

    default:
      if (![TProtocolUtil skipType:fieldType onProtocol:protocol error:&error]) {
        return error;
      }
      break;
    }
    if (![protocol readFieldEnd:&error]) {
      return error;
    }

  }

  if (![protocol readStructEnd:&error]) {
    return error;
  }

  return [NSError errorWithType:type reason:reason];
}


-(BOOL) write:(id<TProtocol>)protocol error:(NSError *__autoreleasing *)error
{
  if (![protocol writeStructBeginWithName:@"TApplicationException" error:error]) {
    return NO;
  }

  if (self.localizedDescription != nil) {
    if (![protocol writeFieldBeginWithName:@"message"
                                      type:TTypeSTRING
                                   fieldID:1 error:error])
    {
      return NO;
    }

    if (![protocol writeString:self.localizedDescription error:error]) {
      return NO;
    }

    if (![protocol writeFieldEnd:error]) {
      return NO;
    }
  }

  if (![protocol writeFieldBeginWithName:@"type"
                                    type:TTypeI32
                                 fieldID:2
                                   error:error])
  {
    return NO;
  }

  if (![protocol writeI32:(SInt32)self.code error:error]) {
    return NO;
  }

  if (![protocol writeFieldEnd:error]) {
    return NO;
  }

  if (![protocol writeFieldStop:error]) {
    return NO;
  }

  if (![protocol writeStructEnd:error]) {
    return NO;
  }

  return YES;
}

@end
