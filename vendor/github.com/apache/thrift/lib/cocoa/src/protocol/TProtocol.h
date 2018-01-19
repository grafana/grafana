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

#import <Foundation/Foundation.h>

#import "TTransport.h"


NS_ASSUME_NONNULL_BEGIN


typedef NS_ENUM (int, TMessageType) {
  TMessageTypeCALL = 1,
  TMessageTypeREPLY = 2,
  TMessageTypeEXCEPTION = 3,
  TMessageTypeONEWAY = 4
};

typedef NS_ENUM (int, TType) {
  TTypeSTOP   = 0,
  TTypeVOID   = 1,
  TTypeBOOL   = 2,
  TTypeBYTE   = 3,
  TTypeDOUBLE = 4,
  TTypeI16    = 6,
  TTypeI32    = 8,
  TTypeI64    = 10,
  TTypeSTRING = 11,
  TTypeSTRUCT = 12,
  TTypeMAP    = 13,
  TTypeSET    = 14,
  TTypeLIST   = 15
};


@protocol TProtocol <NSObject>

-(id <TTransport>) transport;

-(BOOL) readMessageBeginReturningName:(NSString *__nullable __autoreleasing *__nullable)name
                                 type:(nullable SInt32 *)type
                           sequenceID:(nullable SInt32 *)sequenceID
                                error:(NSError *__autoreleasing *)error;
-(BOOL) readMessageEnd:(NSError *__autoreleasing *)error;

-(BOOL) readStructBeginReturningName:(NSString *__nullable __autoreleasing *__nullable)name
                               error:(NSError *__autoreleasing *)error;
-(BOOL) readStructEnd:(NSError *__autoreleasing *)error;

-(BOOL) readFieldBeginReturningName:(NSString *__nullable __autoreleasing *__nullable)name
                               type:(SInt32 *)fieldType
                            fieldID:(nullable SInt32 *)fieldID
                              error:(NSError *__autoreleasing *)error;
-(BOOL) readFieldEnd:(NSError *__autoreleasing *)error;

-(BOOL) readString:(NSString *__nonnull __autoreleasing *__nonnull)value error:(NSError **)error;

-(BOOL) readBool:(BOOL *)value error:(NSError *__autoreleasing *)error;

-(BOOL) readByte:(UInt8 *)value error:(NSError *__autoreleasing *)error;

-(BOOL) readI16:(SInt16 *)value error:(NSError *__autoreleasing *)error;

-(BOOL) readI32:(SInt32 *)value error:(NSError *__autoreleasing *)error;

-(BOOL) readI64:(SInt64 *)value error:(NSError *__autoreleasing *)error;

-(BOOL) readDouble:(double *)value error:(NSError *__autoreleasing *)error;

-(BOOL) readBinary:(NSData *__nonnull __autoreleasing *__nonnull)value error:(NSError **)error;

-(BOOL) readMapBeginReturningKeyType:(nullable SInt32 *)keyType
                           valueType:(nullable SInt32 *)valueType
                                size:(SInt32 *)size
                               error:(NSError *__autoreleasing *)error;
-(BOOL) readMapEnd:(NSError *__autoreleasing *)error;


-(BOOL) readSetBeginReturningElementType:(nullable SInt32 *)elementType
                                    size:(SInt32 *)size
                                   error:(NSError *__autoreleasing *)error;
-(BOOL) readSetEnd:(NSError *__autoreleasing *)error;


-(BOOL) readListBeginReturningElementType:(nullable SInt32 *)elementType
                                     size:(SInt32 *)size
                                    error:(NSError *__autoreleasing *)error;
-(BOOL) readListEnd:(NSError *__autoreleasing *)error;


-(BOOL) writeMessageBeginWithName:(NSString *)name
                             type:(SInt32)messageType
                       sequenceID:(SInt32)sequenceID
                            error:(NSError *__autoreleasing *)error;
-(BOOL) writeMessageEnd:(NSError *__autoreleasing *)error;

-(BOOL) writeStructBeginWithName:(NSString *)name error:(NSError **)error;
-(BOOL) writeStructEnd:(NSError *__autoreleasing *)error;

-(BOOL) writeFieldBeginWithName:(NSString *)name
                           type:(SInt32)fieldType
                        fieldID:(SInt32)fieldID
                          error:(NSError *__autoreleasing *)error;

-(BOOL) writeI32:(SInt32)value error:(NSError *__autoreleasing *)error;

-(BOOL) writeI64:(SInt64)value error:(NSError *__autoreleasing *)error;

-(BOOL) writeI16:(short)value error:(NSError *__autoreleasing *)error;

-(BOOL) writeByte:(UInt8)value error:(NSError *__autoreleasing *)error;

-(BOOL) writeString:(NSString *)value error:(NSError *__autoreleasing *)error;

-(BOOL) writeDouble:(double)value error:(NSError *__autoreleasing *)error;

-(BOOL) writeBool:(BOOL)value error:(NSError *__autoreleasing *)error;

-(BOOL) writeBinary:(NSData *)data error:(NSError *__autoreleasing *)error;

-(BOOL) writeFieldStop:(NSError *__autoreleasing *)error;

-(BOOL) writeFieldEnd:(NSError *__autoreleasing *)error;

-(BOOL) writeMapBeginWithKeyType:(SInt32)keyType
                       valueType:(SInt32)valueType
                            size:(SInt32)size
                           error:(NSError *__autoreleasing *)error;
-(BOOL) writeMapEnd:(NSError *__autoreleasing *)error;


-(BOOL) writeSetBeginWithElementType:(SInt32)elementType
                                size:(SInt32)size
                               error:(NSError *__autoreleasing *)error;
-(BOOL) writeSetEnd:(NSError *__autoreleasing *)error;


-(BOOL) writeListBeginWithElementType:(SInt32)elementType
                                 size:(SInt32)size
                                error:(NSError *__autoreleasing *)error;

-(BOOL) writeListEnd:(NSError *__autoreleasing *)error;


@end


NS_ASSUME_NONNULL_END
