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


#import "TNSFileHandleTransport.h"
#import "TTransportError.h"


@interface TNSFileHandleTransport ()

@property(strong, nonatomic) NSFileHandle *inputFileHandle;
@property(strong, nonatomic) NSFileHandle *outputFileHandle;

@end


@implementation TNSFileHandleTransport

-(id) initWithFileHandle:(NSFileHandle *)fileHandle
{
  return [self initWithInputFileHandle:fileHandle
                      outputFileHandle:fileHandle];
}


-(id) initWithInputFileHandle:(NSFileHandle *)aInputFileHandle
             outputFileHandle:(NSFileHandle *)aOutputFileHandle
{
  self = [super init];
  if (self) {
    _inputFileHandle = aInputFileHandle;
    _outputFileHandle = aOutputFileHandle;
  }
  return self;
}


-(BOOL) readAll:(UInt8 *)buf offset:(UInt32)off length:(UInt32)len error:(NSError *__autoreleasing *)error
{
  UInt32 got = 0;
  while (got < len) {

    NSData *d = [_inputFileHandle readDataOfLength:len-got];
    if (d.length == 0) {
      if (error) {
        *error = [NSError errorWithDomain:TTransportErrorDomain
                                     code:TTransportErrorEndOfFile
                                 userInfo:nil];
      }
      return NO;
    }

    [d getBytes:buf+got length:d.length];
    got += d.length;
  }
  return YES;
}


-(UInt32) readAvail:(UInt8 *)buf offset:(UInt32)off maxLength:(UInt32)len error:(NSError *__autoreleasing *)error
{
  UInt32 got = 0;
  while (got < len) {

    NSData *d = [_inputFileHandle readDataOfLength:len-got];
    if (d.length == 0) {
      break;
    }

    [d getBytes:buf+got length:d.length];
    got += d.length;
  }
  return got;
}


-(BOOL) write:(const UInt8 *)data offset:(UInt32)offset length:(UInt32)length error:(NSError *__autoreleasing *)error
{
  void *pos = (void *)data + offset;

  @try {
    [_outputFileHandle writeData:[NSData dataWithBytesNoCopy:pos length:length freeWhenDone:NO]];
  }
  @catch (NSException *e) {
    if (error) {
      *error = [NSError errorWithDomain:TTransportErrorDomain
                                   code:TTransportErrorNotOpen
                               userInfo:@{}];
    }
    return NO;
  }

  return YES;
}


-(BOOL) flush:(NSError *__autoreleasing *)error
{
  return YES;
}

@end
