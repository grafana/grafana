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

#import "THTTPSessionTransport.h"
#import "TTransportError.h"


@interface THTTPSessionTransportFactory ()

@property (strong, nonatomic) NSURLSession *session;
@property (strong, nonatomic) NSURL *url;

@end


@interface THTTPSessionTransport ()

@property (strong, nonatomic) THTTPSessionTransportFactory *factory;
@property (strong, nonatomic) NSMutableData *requestData;
@property (strong, nonatomic) NSData *responseData;
@property (assign, nonatomic) NSUInteger responseDataOffset;

-(instancetype) initWithFactory:(THTTPSessionTransportFactory *)factory;

@end


@implementation THTTPSessionTransportFactory

+(void) setupDefaultsForSessionConfiguration:(NSURLSessionConfiguration *)config withProtocolName:(NSString *)protocolName
{
  NSString *thriftContentType = @"application/x-thrift";
  if (protocolName.length) {
    thriftContentType = [thriftContentType stringByAppendingFormat:@"; p=%@", protocolName];
  }

  config.requestCachePolicy = NSURLRequestReloadIgnoringCacheData;
  config.HTTPShouldUsePipelining = YES;
  config.HTTPShouldSetCookies = NO;
  config.URLCache = nil;
  config.HTTPAdditionalHeaders = @{@"Content-Type":thriftContentType,
                                   @"Accept":thriftContentType,
                                   @"User-Agent":@"Thrift/Cocoa (Session)"};
}


-(id) initWithSession:(NSURLSession *)session URL:(NSURL *)url
{
  self = [super init];
  if (self) {
    _session = session;
    _url = url;
  }

  return self;
}

-(id<TAsyncTransport>) newTransport
{
  return [[THTTPSessionTransport alloc] initWithFactory:self];
}

-(NSURLSessionDataTask *) taskWithRequest:(NSURLRequest *)request
                        completionHandler:(void (^)(NSData *data, NSURLResponse *response, NSError *error))completionHandler
                                    error:(NSError *__autoreleasing *)error
{
  NSURLSessionDataTask *newTask = [_session dataTaskWithRequest:request completionHandler:completionHandler];
  if (!newTask) {
    if (error) {
      *error = [NSError errorWithDomain:TTransportErrorDomain
                                   code:TTransportErrorUnknown
                               userInfo:@{NSLocalizedDescriptionKey:@"Failed to create session data task"}];
    }
    return nil;
  }

  return newTask;
}

-(NSError *) validateResponse:(NSHTTPURLResponse *)response data:(NSData *)data
{
  if (_responseValidate) {
    return _responseValidate(response, data);
  }
  return nil;
}

@end



@implementation THTTPSessionTransport

-(instancetype) initWithFactory:(THTTPSessionTransportFactory *)factory
{
  self = [super init];
  if (self) {
    _factory = factory;
  }
  return self;
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
  if (!_requestData) {
    _requestData = [NSMutableData dataWithCapacity:256];
  }

  [_requestData appendBytes:data+offset length:length];

  return YES;
}

-(void) flushWithCompletion:(TAsyncCompletionBlock)completed failure:(TAsyncFailureBlock)failure
{
  NSError *error;

  NSMutableURLRequest *request = [[NSMutableURLRequest alloc] initWithURL:_factory.url];
  request.HTTPMethod = @"POST";
  request.HTTPBody = _requestData;

  _requestData = nil;

  NSURLSessionDataTask *task = [_factory taskWithRequest:request completionHandler:^(NSData *data, NSURLResponse *response, NSError *error) {

    // Check response type
    if (!error && ![response isKindOfClass:NSHTTPURLResponse.class]) {

      error = [NSError errorWithDomain:TTransportErrorDomain
                                   code:TTransportErrorUnknown
                               userInfo:@{TTransportErrorHttpErrorKey: @(THttpTransportErrorInvalidResponse)}];

    }

    // Check status code
    NSHTTPURLResponse *httpResponse = (id)response;
    if (!error && httpResponse.statusCode != 200) {

      THttpTransportError code;
      if (httpResponse.statusCode == 401) {
        code = THttpTransportErrorAuthentication;
      }
      else {
        code = THttpTransportErrorInvalidStatus;
      }

      error = [NSError errorWithDomain:TTransportErrorDomain
                                  code:TTransportErrorUnknown
                              userInfo:@{TTransportErrorHttpErrorKey: @(code),
                                         @"statusCode":@(httpResponse.statusCode)}];
    }

    // Allow factory to check
    if (!error) {
      error = [_factory validateResponse:httpResponse data:data];
    }

    _responseDataOffset = 0;

    if (error) {

      _responseData = nil;

      failure(error);

    }
    else {

      if (data == nil) {
        data = [NSData data];
      }

      _responseData = data;

      completed(self);
    }

  } error:&error];

  if (!task) {
    failure(error);
    return;
  }

  [task resume];
}

-(BOOL) flush:(NSError *__autoreleasing *)error
{
  dispatch_semaphore_t completed = dispatch_semaphore_create(0);

  __block BOOL result;
  __block NSError *internalError;

  [self flushWithCompletion:^(id < TAsyncTransport > transport) {

    result = YES;

    dispatch_semaphore_signal(completed);

  } failure:^(NSError *error) {

    internalError = error;

    result = NO;

    dispatch_semaphore_signal(completed);

  }];

  dispatch_semaphore_wait(completed, DISPATCH_TIME_FOREVER);

  if (error) {
    *error = internalError;
  }

  return result;
}

@end
