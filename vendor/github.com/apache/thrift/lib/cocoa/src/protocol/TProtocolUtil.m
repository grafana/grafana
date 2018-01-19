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

#import "TProtocolUtil.h"

@implementation TProtocolUtil

+(BOOL) skipType:(int)type onProtocol:(id <TProtocol>)protocol error:(NSError **)error
{
  switch (type) {
  case TTypeBOOL: {
    BOOL val;
    if (![protocol readBool:&val error:error]) {
      return NO;
    }
  }
  break;

  case TTypeBYTE: {
    UInt8 val;
    if (![protocol readByte:&val error:error]) {
      return NO;
    }
  }
  break;

  case TTypeI16: {
    SInt16 val;
    if (![protocol readI16:&val error:error]) {
      return NO;
    }
  }
  break;

  case TTypeI32: {
    SInt32 val;
    if (![protocol readI32:&val error:error]) {
      return NO;
    }
  }
  break;

  case TTypeI64: {
    SInt64 val;
    if (![protocol readI64:&val error:error]) {
      return NO;
    }
  }
  break;

  case TTypeDOUBLE: {
    double val;
    if (![protocol readDouble:&val error:error]) {
      return NO;
    }
  }
  break;

  case TTypeSTRING: {
    NSString *val;
    if (![protocol readString:&val error:error]) {
      return NO;
    }
  }
  break;

  case TTypeSTRUCT: {
    if (![protocol readStructBeginReturningName:NULL error:error]) {
      return NO;
    }
    while (true) {
      SInt32 fieldType;
      if (![protocol readFieldBeginReturningName:nil type:&fieldType fieldID:nil error:error]) {
        return NO;
      }
      if (fieldType == TTypeSTOP) {
        break;
      }
      if (![self skipType:fieldType onProtocol:protocol error:error]) {
        return NO;
      }
      if (![protocol readFieldEnd:error]) {
        return NO;
      }
    }
    if (![protocol readStructEnd:error]) {
      return NO;
    }
  }
  break;

  case TTypeMAP: {
    SInt32 keyType;
    SInt32 valueType;
    SInt32 size;
    if (![protocol readMapBeginReturningKeyType:&keyType valueType:&valueType size:&size error:error]) {
      return NO;
    }
    int i;
    for (i = 0; i < size; i++) {
      if (![TProtocolUtil skipType:keyType onProtocol:protocol error:error]) {
        return NO;
      }
      if (![TProtocolUtil skipType:valueType onProtocol:protocol error:error]) {
        return NO;
      }
    }
    if (![protocol readMapEnd:error]) {
      return NO;
    }
  }
  break;

  case TTypeSET: {
    SInt32 elemType;
    SInt32 size;
    if (![protocol readSetBeginReturningElementType:&elemType size:&size error:error]) {
      return NO;
    }
    int i;
    for (i = 0; i < size; i++) {
      if (![TProtocolUtil skipType:elemType onProtocol:protocol error:error]) {
        return NO;
      }
    }
    if (![protocol readSetEnd:error]) {
      return NO;
    }
  }
  break;

  case TTypeLIST: {
    SInt32 elemType;
    SInt32 size;
    if (![protocol readListBeginReturningElementType:&elemType size:&size error:error]) {
      return NO;
    }
    int i;
    for (i = 0; i < size; i++) {
      if (![TProtocolUtil skipType:elemType onProtocol:protocol error:error]) {
        return NO;
      }
    }
    if (![protocol readListEnd:error]) {
      return NO;
    }
  }
  break;

  }

  return YES;
}

@end
