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

#import "TProtocolDecorator.h"


@interface TProtocolDecorator ()

@property(strong, nonatomic) id<TProtocol> concreteProtocol;

@end


@implementation TProtocolDecorator

-(id) initWithProtocol:(id <TProtocol>)protocol
{
  self = [super init];
  if (self) {
    _concreteProtocol = protocol;
  }
  return self;
}

-(id <TTransport>) transport
{
  return [_concreteProtocol transport];
}

-(BOOL) readMessageBeginReturningName:(NSString **)name
                                 type:(SInt32 *)type
                           sequenceID:(SInt32 *)sequenceID
                                error:(NSError *__autoreleasing *)error
{
  return [_concreteProtocol readMessageBeginReturningName:name
                                                     type:type
                                               sequenceID:sequenceID
                                                    error:error];
}

-(BOOL) readMessageEnd:(NSError *__autoreleasing *)error
{
  return [_concreteProtocol readMessageEnd:error];
}

-(BOOL) readStructBeginReturningName:(NSString **)name
                               error:(NSError *__autoreleasing *)error
{
  return [_concreteProtocol readStructBeginReturningName:name error:error];
}

-(BOOL) readStructEnd:(NSError *__autoreleasing *)error
{
  return [_concreteProtocol readStructEnd:error];
}

-(BOOL) readFieldBeginReturningName:(NSString **)name
                               type:(SInt32 *)fieldType
                            fieldID:(SInt32 *)fieldID
                              error:(NSError *__autoreleasing *)error
{
  return [_concreteProtocol readFieldBeginReturningName:name
                                                   type:fieldType
                                                fieldID:fieldID
                                                  error:error];
}
-(BOOL) readFieldEnd:(NSError *__autoreleasing *)error
{
  return [_concreteProtocol readFieldEnd:error];
}

-(BOOL) readString:(NSString *__autoreleasing *)value error:(NSError *__autoreleasing *)error
{
  return [_concreteProtocol readString:value error:error];
}

-(BOOL) readBool:(BOOL *)value error:(NSError *__autoreleasing *)error
{
  return [_concreteProtocol readBool:value error:error];
}

-(BOOL) readByte:(UInt8 *)value error:(NSError *__autoreleasing *)error
{
  return [_concreteProtocol readByte:value error:error];
}

-(BOOL) readI16:(SInt16 *)value error:(NSError *__autoreleasing *)error
{
  return [_concreteProtocol readI16:value error:error];
}

-(BOOL) readI32:(SInt32 *)value error:(NSError *__autoreleasing *)error
{
  return [_concreteProtocol readI32:value error:error];
}

-(BOOL) readI64:(SInt64 *)value error:(NSError *__autoreleasing *)error
{
  return [_concreteProtocol readI64:value error:error];
}

-(BOOL) readDouble:(double *)value error:(NSError *__autoreleasing *)error
{
  return [_concreteProtocol readDouble:value error:error];
}

-(BOOL) readBinary:(NSData *__autoreleasing *)value error:(NSError *__autoreleasing *)error
{
  return [_concreteProtocol readBinary:value error:error];
}

-(BOOL) readMapBeginReturningKeyType:(SInt32 *)keyType
                           valueType:(SInt32 *)valueType
                                size:(SInt32 *)size
                               error:(NSError *__autoreleasing *)error
{
  return [_concreteProtocol readMapBeginReturningKeyType:keyType
                                               valueType:valueType
                                                    size:size
                                                   error:error];
}
-(BOOL) readMapEnd:(NSError *__autoreleasing *)error
{
  return [_concreteProtocol readMapEnd:error];
}


-(BOOL) readSetBeginReturningElementType:(SInt32 *)elementType
                                    size:(SInt32 *)size
                                   error:(NSError *__autoreleasing *)error
{
  return [_concreteProtocol readSetBeginReturningElementType:elementType
                                                        size:size
                                                       error:error];
}
-(BOOL) readSetEnd:(NSError *__autoreleasing *)error
{
  return [_concreteProtocol readSetEnd:error];
}

-(BOOL) readListBeginReturningElementType:(SInt32 *)elementType
                                     size:(SInt32 *)size
                                    error:(NSError *__autoreleasing *)error
{
  return [_concreteProtocol readListBeginReturningElementType:elementType
                                                         size:size
                                                        error:error];
}
-(BOOL) readListEnd:(NSError *__autoreleasing *)error
{
  return [_concreteProtocol readListEnd:error];
}

-(BOOL) writeMessageBeginWithName:(NSString *)name
                             type:(SInt32)messageType
                       sequenceID:(SInt32)sequenceID
                            error:(NSError *__autoreleasing *)error
{
  return [_concreteProtocol writeMessageBeginWithName:name
                                                 type:messageType
                                           sequenceID:sequenceID
                                                error:error];
}
-(BOOL) writeMessageEnd:(NSError *__autoreleasing *)error
{
  return [_concreteProtocol writeMessageEnd:error];
}

-(BOOL) writeStructBeginWithName:(NSString *)name error:(NSError *__autoreleasing *)error
{
  return [_concreteProtocol writeStructBeginWithName:name error:error];
}
-(BOOL) writeStructEnd:(NSError *__autoreleasing *)error
{
  return [_concreteProtocol writeStructEnd:error];
}

-(BOOL) writeFieldBeginWithName:(NSString *)name
                           type:(SInt32)fieldType
                        fieldID:(SInt32)fieldID
                          error:(NSError *__autoreleasing *)error
{
  return [_concreteProtocol writeFieldBeginWithName:name
                                               type:fieldType
                                            fieldID:fieldID
                                              error:error];
}

-(BOOL) writeI32:(SInt32)value error:(NSError *__autoreleasing *)error
{
  return [_concreteProtocol writeI32:value error:error];
}

-(BOOL) writeI64:(SInt64)value error:(NSError *__autoreleasing *)error
{
  return [_concreteProtocol writeI64:value error:error];
}

-(BOOL) writeI16:(SInt16)value error:(NSError *__autoreleasing *)error
{
  return [_concreteProtocol writeI16:value error:error];
}

-(BOOL) writeByte:(UInt8)value error:(NSError *__autoreleasing *)error
{
  return [_concreteProtocol writeByte:value error:error];
}

-(BOOL) writeString:(NSString *)value error:(NSError *__autoreleasing *)error
{
  return [_concreteProtocol writeString:value error:error];
}

-(BOOL) writeDouble:(double)value error:(NSError *__autoreleasing *)error
{
  return [_concreteProtocol writeDouble:value error:error];
}

-(BOOL) writeBool:(BOOL)value error:(NSError *__autoreleasing *)error
{
  return [_concreteProtocol writeBool:value error:error];
}

-(BOOL) writeBinary:(NSData *)data error:(NSError *__autoreleasing *)error
{
  return [_concreteProtocol writeBinary:data error:error];
}

-(BOOL) writeFieldStop:(NSError *__autoreleasing *)error
{
  return [_concreteProtocol writeFieldStop:error];
}

-(BOOL) writeFieldEnd:(NSError *__autoreleasing *)error
{
  return [_concreteProtocol writeFieldEnd:error];
}

-(BOOL) writeMapBeginWithKeyType:(SInt32)keyType
                       valueType:(SInt32)valueType
                            size:(SInt32)size
                           error:(NSError *__autoreleasing *)error
{
  return [_concreteProtocol writeMapBeginWithKeyType:keyType
                                           valueType:valueType
                                                size:size
                                               error:error];
}

-(BOOL) writeMapEnd:(NSError *__autoreleasing *)error
{
  return [_concreteProtocol writeMapEnd:error];
}

-(BOOL) writeSetBeginWithElementType:(SInt32)elementType
                                size:(SInt32)size
                               error:(NSError *__autoreleasing *)error
{
  return [_concreteProtocol writeSetBeginWithElementType:elementType size:size error:error];
}

-(BOOL) writeSetEnd:(NSError *__autoreleasing *)error
{
  return [_concreteProtocol writeSetEnd:error];
}

-(BOOL) writeListBeginWithElementType:(SInt32)elementType
                                 size:(SInt32)size
                                error:(NSError *__autoreleasing *)error
{
  return [_concreteProtocol writeListBeginWithElementType:elementType size:size error:error];
}

-(BOOL) writeListEnd:(NSError *__autoreleasing *)error
{
  return [_concreteProtocol writeListEnd:error];
}

@end
