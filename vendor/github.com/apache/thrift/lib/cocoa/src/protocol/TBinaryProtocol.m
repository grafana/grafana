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

#import "TBinaryProtocol.h"
#import "TProtocolError.h"


static SInt32 VERSION_1 = 0x80010000;
static SInt32 VERSION_MASK = 0xffff0000;


static TBinaryProtocolFactory *gSharedFactory = nil;


@implementation TBinaryProtocolFactory

+(TBinaryProtocolFactory *) sharedFactory
{
  if (gSharedFactory == nil) {
    gSharedFactory = [[TBinaryProtocolFactory alloc] init];
  }

  return gSharedFactory;
}

-(NSString *) protocolName
{
  return @"binary";
}

-(TBinaryProtocol *) newProtocolOnTransport:(id <TTransport>)transport
{
  return [[TBinaryProtocol alloc] initWithTransport:transport];
}

@end


@interface TBinaryProtocol ()

@property(strong, nonatomic) id <TTransport> transport;

@property(assign, nonatomic) BOOL strictRead;
@property(assign, nonatomic) BOOL strictWrite;

@property(strong, nonatomic) NSString *currentMessageName;
@property(strong, nonatomic) NSString *currentFieldName;

@end


@implementation TBinaryProtocol

-(id) initWithTransport:(id <TTransport>)aTransport
{
  return [self initWithTransport:aTransport strictRead:NO strictWrite:YES];
}

-(id) initWithTransport:(id <TTransport>)transport
             strictRead:(BOOL)strictRead
            strictWrite:(BOOL)strictWrite
{
  self = [super init];
  if (self) {
    _transport = transport;
    _strictRead = strictRead;
    _strictWrite = strictWrite;
  }
  return self;
}

-(id <TTransport>) transport
{
  return _transport;
}

-(NSString *) readStringBody:(int)size error:(NSError **)error
{
  NSMutableData *data = [NSMutableData dataWithLength:size];
  if (!data) {
    PROTOCOL_ERROR(nil, Unknown, @"Unable to allocate %d bytes", size);
  }

  if (![_transport readAll:data.mutableBytes offset:0 length:size error:error]) {
    PROTOCOL_TRANSPORT_ERROR(nil, error, @"Transport read failed");
  }

  return [[NSString alloc] initWithData:data encoding:NSUTF8StringEncoding];
}


-(BOOL) readMessageBeginReturningName:(NSString **)name
                                 type:(SInt32 *)type
                           sequenceID:(SInt32 *)sequenceID
                                error:(NSError *__autoreleasing *)error
{
  SInt32 size;
  if (![self readI32:&size error:error]) {
    return NO;
  }
  ;

  if (size < 0) {
    int version = size & VERSION_MASK;
    if (version != VERSION_1) {
      PROTOCOL_ERROR(NO, BadVersion, @"Bad message version");
    }
    if (type != NULL) {
      *type = size & 0x00FF;
    }
    NSString *messageName;
    if (![self readString:&messageName error:error]) {
      return NO;
    }
    if (name != nil) {
      *name = messageName;
    }
  }
  else {

    if (_strictRead) {
      PROTOCOL_ERROR(NO, InvalidData, @"Missing message version, old client?");
    }

    if (_messageSizeLimit > 0 && size > _messageSizeLimit) {
      PROTOCOL_ERROR(NO, SizeLimit, @"Message exceeeds size limit of %d", (int)size);
    }

    NSString *messageName = [self readStringBody:size error:error];
    if (!messageName) {
      return NO;
    }

    if (name != NULL) {
      *name = messageName;
    }

    UInt8 messageType;
    if (![self readByte:&messageType error:error]) {
      return NO;
    }

    if (type != NULL) {
      *type = messageType;
    }
  }

  SInt32 seqID;
  if (![self readI32:&seqID error:error]) {
    return NO;
  }
  if (sequenceID != NULL) {
    *sequenceID = seqID;
  }

  return YES;
}


-(BOOL) readMessageEnd:(NSError *__autoreleasing *)error
{
  return YES;
}


-(BOOL) readStructBeginReturningName:(NSString *__autoreleasing *)name error:(NSError *__autoreleasing *)error
{
  return YES;
}


-(BOOL) readStructEnd:(NSError *__autoreleasing *)error
{
  return YES;
}


-(BOOL) readFieldBeginReturningName:(NSString *__autoreleasing *)name
                               type:(SInt32 *)fieldType
                            fieldID:(SInt32 *)fieldID
                              error:(NSError *__autoreleasing *)error
{
  if (name != nil) {
    *name = nil;
  }

  UInt8 ft;
  if (![self readByte:&ft error:error]) {
    return NO;
  }
  if (fieldType != NULL) {
    *fieldType = ft;
  }
  if (ft != TTypeSTOP) {
    SInt16 fid;
    if (![self readI16:&fid error:error]) {
      return NO;
    }
    if (fieldID != NULL) {
      *fieldID = fid;
    }
  }
  return YES;
}


-(BOOL) readFieldEnd:(NSError *__autoreleasing *)error
{
  return YES;
}


-(BOOL) readString:(NSString *__autoreleasing *)value error:(NSError *__autoreleasing *)error
{
  SInt32 size;
  if (![self readI32:&size error:error]) {
    return NO;
  }

  NSString *string = [self readStringBody:size error:error];
  if (!string) {
    return NO;
  }

  *value = string;

  return YES;
}


-(BOOL) readBool:(BOOL *)value error:(NSError *__autoreleasing *)error
{
  UInt8 byte;
  if (![self readByte:&byte error:error]) {
    return NO;
  }

  *value = byte == 1;

  return YES;
}


-(BOOL) readByte:(UInt8 *)value error:(NSError *__autoreleasing *)error
{
  UInt8 buff[1];
  if (![_transport readAll:buff offset:0 length:1 error:error]) {
    PROTOCOL_TRANSPORT_ERROR(NO, error, @"Transport read failed");
  }

  *value = buff[0];

  return YES;
}


-(BOOL) readI16:(SInt16 *)value error:(NSError *__autoreleasing *)error
{
  UInt8 buff[2];
  if (![_transport readAll:buff offset:0 length:2 error:error]) {
    PROTOCOL_TRANSPORT_ERROR(NO, error, @"Transport read failed");
  }

  *value =
    ((SInt16)(buff[0] & 0xff) << 8) |
    ((SInt16)(buff[1] & 0xff));

  return YES;
}


-(BOOL) readI32:(SInt32 *)value error:(NSError *__autoreleasing *)error
{
  UInt8 i32rd[4];
  if (![_transport readAll:i32rd offset:0 length:4 error:error]) {
    PROTOCOL_TRANSPORT_ERROR(NO, error, @"Transport read failed");
  }

  *value =
    ((i32rd[0] & 0xff) << 24) |
    ((i32rd[1] & 0xff) << 16) |
    ((i32rd[2] & 0xff) <<  8) |
    ((i32rd[3] & 0xff));

  return YES;
}


-(BOOL) readI64:(SInt64 *)value error:(NSError *__autoreleasing *)error
{
  UInt8 buff[8];
  if (![_transport readAll:buff offset:0 length:8 error:error]) {
    PROTOCOL_TRANSPORT_ERROR(NO, error, @"Transport read failed");
  }

  *value =
    ((SInt64)(buff[0] & 0xff) << 56) |
    ((SInt64)(buff[1] & 0xff) << 48) |
    ((SInt64)(buff[2] & 0xff) << 40) |
    ((SInt64)(buff[3] & 0xff) << 32) |
    ((SInt64)(buff[4] & 0xff) << 24) |
    ((SInt64)(buff[5] & 0xff) << 16) |
    ((SInt64)(buff[6] & 0xff) <<  8) |
    ((SInt64)(buff[7] & 0xff));

  return YES;
}


-(BOOL) readDouble:(double *)value error:(NSError *__autoreleasing *)error
{
  // FIXME - will this get us into trouble on PowerPC?
  return [self readI64:(SInt64 *)value error:error];
}


-(BOOL) readBinary:(NSData *__autoreleasing *)value error:(NSError *__autoreleasing *)error
{
  SInt32 size;
  if (![self readI32:&size error:error]) {
    return NO;
  }

  NSMutableData *data = [NSMutableData dataWithLength:size];
  if (!data) {
    PROTOCOL_ERROR(NO, Unknown, @"Unable to allocate %d bytes", (int)size);
  }

  if (![_transport readAll:data.mutableBytes offset:0 length:size error:error]) {
    PROTOCOL_TRANSPORT_ERROR(NO, error, @"Transport read failed");
  }

  *value = data;

  return YES;
}


-(BOOL) readMapBeginReturningKeyType:(SInt32 *)keyType
                           valueType:(SInt32 *)valueType
                                size:(SInt32 *)size
                               error:(NSError *__autoreleasing *)error
{
  UInt8 kt;
  if (![self readByte:&kt error:error]) {
    return NO;
  }

  UInt8 vt;
  if (![self readByte:&vt error:error]) {
    return NO;
  }

  SInt32 s;
  if (![self readI32:&s error:error]) {
    return NO;
  }

  if (keyType != NULL) {
    *keyType = kt;
  }

  if (valueType != NULL) {
    *valueType = vt;
  }

  if (size != NULL) {
    *size = s;
  }

  return YES;
}


-(BOOL) readMapEnd:(NSError *__autoreleasing *)error
{
  return YES;
}


-(BOOL) readSetBeginReturningElementType:(SInt32 *)elementType
                                    size:(SInt32 *)size
                                   error:(NSError *__autoreleasing *)error
{
  UInt8 et;
  if (![self readByte:&et error:error]) {
    return NO;
  }

  SInt32 s;
  if (![self readI32:&s error:error]) {
    return NO;
  }

  if (elementType != NULL) {
    *elementType = et;
  }

  if (size != NULL) {
    *size = s;
  }

  return YES;
}


-(BOOL) readSetEnd:(NSError *__autoreleasing *)error
{
  return YES;
}


-(BOOL) readListBeginReturningElementType:(SInt32 *)elementType
                                     size:(SInt32 *)size
                                    error:(NSError *__autoreleasing *)error
{
  UInt8 et;
  if (![self readByte:&et error:error]) {
    return NO;
  }

  SInt32 s;
  if (![self readI32:&s error:error]) {
    return NO;
  }

  if (elementType != NULL) {
    *elementType = et;
  }

  if (size != NULL) {
    *size = s;
  }

  return YES;
}


-(BOOL) readListEnd:(NSError *__autoreleasing *)error
{
  return YES;
}



-(BOOL) writeMessageBeginWithName:(NSString *)name
                             type:(SInt32)messageType
                       sequenceID:(SInt32)sequenceID
                            error:(NSError *__autoreleasing *)error
{
  if (_strictWrite) {

    int version = VERSION_1 | messageType;

    if (![self writeI32:version error:error]) {
      return NO;
    }

    if (![self writeString:name error:error]) {
      return NO;
    }

    if (![self writeI32:sequenceID error:error]) {
      return NO;
    }
  }
  else {

    if (![self writeString:name error:error]) {
      return NO;
    }

    if (![self writeByte:messageType error:error]) {
      return NO;
    }

    if (![self writeI32:sequenceID error:error]) {
      return NO;
    }
  }

  _currentMessageName = name;

  return YES;
}


-(BOOL) writeMessageEnd:(NSError *__autoreleasing *)error
{
  _currentMessageName = nil;
  return YES;
}


-(BOOL) writeStructBeginWithName:(NSString *)name
                           error:(NSError *__autoreleasing *)error
{
  return YES;
}


-(BOOL) writeStructEnd:(NSError *__autoreleasing *)error
{
  return YES;
}


-(BOOL) writeFieldBeginWithName:(NSString *)name
                           type:(SInt32)fieldType
                        fieldID:(SInt32)fieldID
                          error:(NSError *__autoreleasing *)error
{
  if (![self writeByte:fieldType error:error]) {
    return NO;
  }

  if (![self writeI16:fieldID error:error]) {
    return NO;
  }

  return YES;
}


-(BOOL) writeBool:(BOOL)value error:(NSError *__autoreleasing *)error
{
  return [self writeByte:(value ? 1 : 0) error:error];
}


-(BOOL) writeByte:(UInt8)value error:(NSError *__autoreleasing *)error
{
  if (![_transport write:&value offset:0 length:1 error:error]) {
    PROTOCOL_TRANSPORT_ERROR(NO, error, @"Transport write failed");
  }
  return YES;
}


-(BOOL) writeI16:(short)value error:(NSError *__autoreleasing *)error
{
  UInt8 buff[2];
  buff[0] = 0xff & (value >> 8);
  buff[1] = 0xff & value;

  if (![_transport write:buff offset:0 length:2 error:error]) {
    PROTOCOL_TRANSPORT_ERROR(NO, error, @"Transport write failed");
  }

  return YES;
}


-(BOOL) writeI32:(SInt32)value error:(NSError *__autoreleasing *)error
{
  UInt8 buff[4];
  buff[0] = 0xFF & (value >> 24);
  buff[1] = 0xFF & (value >> 16);
  buff[2] = 0xFF & (value >> 8);
  buff[3] = 0xFF & value;

  if (![_transport write:buff offset:0 length:4 error:error]) {
    PROTOCOL_TRANSPORT_ERROR(NO, error, @"Transport write failed");
  }

  return YES;
}


-(BOOL) writeI64:(SInt64)value error:(NSError *__autoreleasing *)error
{
  UInt8 buff[8];
  buff[0] = 0xFF & (value >> 56);
  buff[1] = 0xFF & (value >> 48);
  buff[2] = 0xFF & (value >> 40);
  buff[3] = 0xFF & (value >> 32);
  buff[4] = 0xFF & (value >> 24);
  buff[5] = 0xFF & (value >> 16);
  buff[6] = 0xFF & (value >> 8);
  buff[7] = 0xFF & value;

  if (![_transport write:buff offset:0 length:8 error:error]) {
    PROTOCOL_TRANSPORT_ERROR(NO, error, @"Transport write failed");
  }

  return YES;
}


-(BOOL) writeDouble:(double)value error:(NSError *__autoreleasing *)error
{
  // FIXME - will this get us in trouble on PowerPC?
  if (![self writeI64:*(SInt64 *)&value error:error]) {
    return NO;
  }

  return YES;
}


-(BOOL) writeString:(NSString *)value error:(NSError *__autoreleasing *)error
{
  if (value != nil) {

    const char *utf8Bytes = [value UTF8String];

    SInt32 length = (SInt32)strlen(utf8Bytes);
    if (![self writeI32:length error:error]) {
      return NO;
    }

    if (![_transport write:(UInt8 *)utf8Bytes offset:0 length:(int)length error:error]) {
      PROTOCOL_TRANSPORT_ERROR(NO, error, @"Transport write failed");
    }

  }
  else {

    // instead of crashing when we get null, let's write out a zero
    // length string
    if (![self writeI32:0 error:error]) {
      return NO;
    }

  }

  return YES;
}


-(BOOL) writeBinary:(NSData *)data error:(NSError *__autoreleasing *)error
{
  if (![self writeI32:(SInt32)data.length error:error]) {
    return NO;
  }

  if (![_transport write:data.bytes offset:0 length:(UInt32)data.length error:error]) {
    PROTOCOL_TRANSPORT_ERROR(NO, error, @"Transport write failed");
  }

  return YES;
}


-(BOOL) writeFieldStop:(NSError *__autoreleasing *)error
{
  if (![self writeByte:TTypeSTOP error:error]) {
    return NO;
  }

  return YES;
}


-(BOOL) writeFieldEnd:(NSError *__autoreleasing *)error
{
  return YES;
}


-(BOOL) writeMapBeginWithKeyType:(SInt32)keyType
                       valueType:(SInt32)valueType
                            size:(SInt32)size
                           error:(NSError *__autoreleasing *)error
{
  if (![self writeByte:keyType error:error]) {
    return NO;
  }
  if (![self writeByte:valueType error:error]) {
    return NO;
  }
  if (![self writeI32:(int)size error:error]) {
    return NO;
  }
  return YES;
}


-(BOOL) writeMapEnd:(NSError *__autoreleasing *)error
{
  return YES;
}


-(BOOL) writeSetBeginWithElementType:(SInt32)elementType
                                size:(SInt32)size
                               error:(NSError *__autoreleasing *)error
{
  if (![self writeByte:elementType error:error]) {
    return NO;
  }
  if (![self writeI32:size error:error]) {
    return NO;
  }
  return YES;
}


-(BOOL) writeSetEnd:(NSError *__autoreleasing *)error
{
  return YES;
}


-(BOOL) writeListBeginWithElementType:(SInt32)elementType
                                 size:(SInt32)size
                                error:(NSError *__autoreleasing *)error
{
  if (![self writeByte:elementType error:error]) {
    return NO;
  }
  if (![self writeI32:size error:error]) {
    return NO;
  }
  return YES;
}


-(BOOL) writeListEnd:(NSError *__autoreleasing *)error
{
  return YES;
}

@end
