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

#import "TFramedTransport.h"
#import "TTransportError.h"

#define HEADER_SIZE 4
#define INIT_FRAME_SIZE 1024


@interface TFramedTransport ()

@property(strong, nonatomic) id<TTransport> transport;
@property(strong, nonatomic) NSMutableData *writeBuffer;
@property(strong, nonatomic) NSMutableData *readBuffer;
@property(assign, nonatomic) NSUInteger readOffset;

@end


@implementation TFramedTransport

-(id) initWithTransport:(id <TTransport>)aTransport
{
  if ((self = [self init])) {
    _transport = aTransport;
    _readBuffer = nil;
    _readOffset = 0;
    _writeBuffer = [NSMutableData dataWithLength:HEADER_SIZE];
  }
  return self;
}

-(BOOL) flush:(NSError **)error
{
  int len = (int)[_writeBuffer length];
  int data_len = len - HEADER_SIZE;
  if (data_len < 0) {
    if (error) {
      *error = [NSError errorWithDomain:TTransportErrorDomain
                                   code:TTransportErrorUnknown
                               userInfo:@{}];
    }
    return NO;
  }

  UInt8 i32rd[HEADER_SIZE];
  i32rd[0] = (UInt8)(0xff & (data_len >> 24));
  i32rd[1] = (UInt8)(0xff & (data_len >> 16));
  i32rd[2] = (UInt8)(0xff & (data_len >> 8));
  i32rd[3] = (UInt8)(0xff & (data_len));

  // should we make a copy of the writeBuffer instead? Better for threaded
  //  operations!
  [_writeBuffer replaceBytesInRange:NSMakeRange(0, HEADER_SIZE)
                          withBytes:i32rd length:HEADER_SIZE];

  if (![_transport write:_writeBuffer.mutableBytes offset:0 length:len error:error]) {
    return NO;
  }

  if (![_transport flush:error]) {
    return NO;
  }

  _writeBuffer.length = HEADER_SIZE;

  return YES;
}

-(BOOL) write:(const UInt8 *)data offset:(UInt32)offset length:(UInt32)length error:(NSError *__autoreleasing *)error
{
  [_writeBuffer appendBytes:data+offset length:length];

  return YES;
}

-(BOOL) readAll:(UInt8 *)outBuffer offset:(UInt32)outBufferOffset length:(UInt32)length error:(NSError *__autoreleasing *)error
{
  UInt32 got = [self readAvail:outBuffer offset:outBufferOffset maxLength:length error:error];
  if (got != length) {

    // Report underflow only if readAvail didn't report error already
    if (error && !*error) {
      *error = [NSError errorWithDomain:TTransportErrorDomain
                                   code:TTransportErrorEndOfFile
                               userInfo:nil];
    }

    return NO;
  }

  return YES;
}

-(UInt32) readAvail:(UInt8 *)outBuffer offset:(UInt32)outBufferOffset maxLength:(UInt32)length error:(NSError *__autoreleasing *)error
{
  UInt32 got = 0;
  while (got < length) {

    NSUInteger avail = _readBuffer.length - _readOffset;
    if (avail == 0) {
      if (![self readFrame:error]) {
        return 0;
      }
      avail = _readBuffer.length;
    }

    NSRange range;
    range.location = _readOffset;
    range.length = MIN(length - got, avail);

    [_readBuffer getBytes:outBuffer+outBufferOffset+got range:range];
    _readOffset += range.length;
    got += range.length;
  }

  return got;
}

-(BOOL) readFrame:(NSError **)error
{
  UInt8 i32rd[HEADER_SIZE];
  if (![_transport readAll:i32rd offset:0 length:HEADER_SIZE error:error]) {
    return NO;
  }

  SInt32 size =
    ((i32rd[0] & 0xff) << 24) |
    ((i32rd[1] & 0xff) << 16) |
    ((i32rd[2] & 0xff) <<  8) |
    ((i32rd[3] & 0xff));

  if (_readBuffer == nil) {

    _readBuffer = [NSMutableData dataWithLength:size];

  }
  else {

    SInt32 len = (SInt32)_readBuffer.length;
    if (len >= size) {

      _readBuffer.length = size;

    }
    else {

      // increase length of data buffer
      [_readBuffer increaseLengthBy:size-len];

    }

  }

  // copy into internal memory buffer
  if (![_transport readAll:_readBuffer.mutableBytes offset:0 length:size error:error]) {
    return NO;
  }

  return YES;
}

@end
