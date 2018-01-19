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

#import "THTTPTransport.h"
#import "TTransportError.h"


@interface THTTPTransport ()

@property (strong, nonatomic) NSURL *url;
@property (strong, nonatomic) NSMutableURLRequest *request;
@property (strong, nonatomic) NSMutableData *requestData;
@property (strong, nonatomic) NSData *responseData;
@property (assign, nonatomic) NSUInteger responseDataOffset;
@property (strong, nonatomic) NSString *userAgent;
@property (assign, nonatomic) NSTimeInterval timeout;

@end


@implementation THTTPTransport

-(void) setupRequest
{
  // set up our request object that we'll use for each request
  _request = [[NSMutableURLRequest alloc] initWithURL:_url];
  [_request setHTTPMethod:@"POST"];
  [_request setValue:@"application/x-thrift" forHTTPHeaderField:@"Content-Type"];
  [_request setValue:@"application/x-thrift" forHTTPHeaderField:@"Accept"];

  NSString *userAgent = _userAgent;
  if (!userAgent) {
    userAgent = @"Thrift/Cocoa";
  }
  [_request setValue:userAgent forHTTPHeaderField:@"User-Agent"];

  [_request setCachePolicy:NSURLRequestReloadIgnoringCacheData];
  if (_timeout) {
    [_request setTimeoutInterval:_timeout];
  }
}


-(id) initWithURL:(NSURL *)aURL
{
  return [self initWithURL:aURL
                 userAgent:nil
                   timeout:0];
}


-(id) initWithURL:(NSURL *)aURL
        userAgent:(NSString *)aUserAgent
          timeout:(int)aTimeout
{
  self = [super init];
  if (!self) {
    return nil;
  }

  _timeout = aTimeout;
  _userAgent = aUserAgent;
  _url = aURL;

  [self setupRequest];

  // create our request data buffer
  _requestData = [[NSMutableData alloc] initWithCapacity:1024];

  return self;
}

-(void) setURL:(NSURL *)aURL
{
  _url = aURL;

  [self setupRequest];
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

-(UInt32) readAvail:(UInt8 *)outBuffer offset:(UInt32)outBufferOffset maxLength:(UInt32)maxLength error:(NSError *__autoreleasing *)error
{
  NSUInteger avail = _responseData.length - _responseDataOffset;

  NSRange range;
  range.location = _responseDataOffset;
  range.length = MIN(maxLength, avail);

  [_responseData getBytes:outBuffer+outBufferOffset range:range];
  _responseDataOffset += range.length;

  return (UInt32)range.length;
}

-(BOOL) write:(const UInt8 *)data offset:(UInt32)offset length:(UInt32)length error:(NSError *__autoreleasing *)error
{
  [_requestData appendBytes:data+offset length:length];

  return YES;
}

-(BOOL) flush:(NSError *__autoreleasing *)error
{
  [_request setHTTPBody:_requestData];

  _responseDataOffset = 0;

  // make the HTTP request
  NSURLResponse *response;
  _responseData = [NSURLConnection sendSynchronousRequest:_request returningResponse:&response error:error];
  if (!_responseData) {
    return NO;
  }

  [_requestData setLength:0];

  if (![response isKindOfClass:NSHTTPURLResponse.class]) {
    if (error) {
      *error = [NSError errorWithDomain:TTransportErrorDomain
                                   code:TTransportErrorUnknown
                               userInfo:@{TTransportErrorHttpErrorKey: @(THttpTransportErrorInvalidResponse)}];
    }
    return NO;
  }

  NSHTTPURLResponse *httpResponse = (NSHTTPURLResponse *)response;
  if ([httpResponse statusCode] != 200) {
    if (error) {

      THttpTransportError code;
      if (httpResponse.statusCode == 401) {
        code = THttpTransportErrorAuthentication;
      }
      else {
        code = THttpTransportErrorInvalidStatus;
      }

      *error = [NSError errorWithDomain:TTransportErrorDomain
                                   code:TTransportErrorUnknown
                               userInfo:@{TTransportErrorHttpErrorKey: @(code),
                                          @"statusCode":@(httpResponse.statusCode)}];
    }
    return NO;
  }

  return YES;
}

@end
