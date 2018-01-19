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
#import "TSocketTransport.h"

#if !TARGET_OS_IPHONE
#import <CoreServices/CoreServices.h>
#else
#import <CFNetwork/CFNetwork.h>
#endif

@interface TSocketTransport () <NSStreamDelegate>
@end


@implementation TSocketTransport

-(id) initWithHostname:(NSString *)hostname
                  port:(int)port
{
  NSInputStream *inputStream = nil;
  NSOutputStream *outputStream = nil;

  CFReadStreamRef readStream = NULL;
  CFWriteStreamRef writeStream = NULL;
  CFStreamCreatePairWithSocketToHost(kCFAllocatorDefault, (__bridge CFStringRef)hostname, port, &readStream, &writeStream);
  if (readStream && writeStream) {

    CFReadStreamSetProperty(readStream, kCFStreamPropertyShouldCloseNativeSocket, kCFBooleanTrue);
    CFWriteStreamSetProperty(writeStream, kCFStreamPropertyShouldCloseNativeSocket, kCFBooleanTrue);

    inputStream = (__bridge NSInputStream *)readStream;
    [inputStream setDelegate:self];
    [inputStream scheduleInRunLoop:NSRunLoop.currentRunLoop forMode:NSDefaultRunLoopMode];
    [inputStream open];

    outputStream = (__bridge NSOutputStream *)writeStream;
    [outputStream setDelegate:self];
    [outputStream scheduleInRunLoop:NSRunLoop.currentRunLoop forMode:NSDefaultRunLoopMode];
    [outputStream open];
  }
  else {

    if (readStream) {
      CFRelease(readStream);
    }

    if (writeStream) {
      CFRelease(writeStream);
    }

    return nil;
  }

  return [super initWithInputStream:inputStream outputStream:outputStream];
}

@end
