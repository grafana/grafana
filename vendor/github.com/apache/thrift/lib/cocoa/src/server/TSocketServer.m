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
#import "TSocketServer.h"
#import "TNSFileHandleTransport.h"
#import "TProtocol.h"
#import "TTransportError.h"

#import <sys/socket.h>
#include <netinet/in.h>



NSString *const TSocketServerClientConnectionFinished = @"TSocketServerClientConnectionFinished";
NSString *const TSocketServerProcessorKey = @"TSocketServerProcessor";
NSString *const TSockerServerTransportKey = @"TSockerServerTransport";


@interface TSocketServer ()

@property(strong, nonatomic) id<TProtocolFactory> inputProtocolFactory;
@property(strong, nonatomic) id<TProtocolFactory> outputProtocolFactory;
@property(strong, nonatomic) id<TProcessorFactory> processorFactory;
@property(strong, nonatomic) NSFileHandle *socketFileHandle;
@property(strong, nonatomic) dispatch_queue_t processingQueue;

@end


@implementation TSocketServer

-(instancetype) initWithPort:(int)port
             protocolFactory:(id <TProtocolFactory>)protocolFactory
            processorFactory:(id <TProcessorFactory>)processorFactory;
{
  self = [super init];

  _inputProtocolFactory = protocolFactory;
  _outputProtocolFactory = protocolFactory;
  _processorFactory = processorFactory;

  dispatch_queue_attr_t processingQueueAttr =
    dispatch_queue_attr_make_with_qos_class(DISPATCH_QUEUE_CONCURRENT, QOS_CLASS_BACKGROUND, 0);

  _processingQueue = dispatch_queue_create("TSocketServer.processing", processingQueueAttr);

  // create a socket.
  int fd = -1;
  CFSocketRef socket = CFSocketCreate(kCFAllocatorDefault, PF_INET, SOCK_STREAM, IPPROTO_TCP, 0, NULL, NULL);
  if (socket) {
    CFSocketSetSocketFlags(socket, CFSocketGetSocketFlags(socket) & ~kCFSocketCloseOnInvalidate);
    fd = CFSocketGetNative(socket);
    int yes = 1;
    setsockopt(fd, SOL_SOCKET, SO_REUSEADDR, (void *)&yes, sizeof(yes));

    struct sockaddr_in addr;
    memset(&addr, 0, sizeof(addr));
    addr.sin_len = sizeof(addr);
    addr.sin_family = AF_INET;
    addr.sin_port = htons(port);
    addr.sin_addr.s_addr = htonl(INADDR_ANY);
    NSData *address = [NSData dataWithBytes:&addr length:sizeof(addr)];
    if (CFSocketSetAddress(socket, (__bridge CFDataRef)address) != kCFSocketSuccess) {
      CFSocketInvalidate(socket);
      CFRelease(socket);
      NSLog(@"TSocketServer: Could not bind to address");
      return nil;
    }
  }
  else {
    NSLog(@"TSocketServer: No server socket");
    return nil;
  }

  // wrap it in a file handle so we can get messages from it
  _socketFileHandle = [[NSFileHandle alloc] initWithFileDescriptor:fd
                                                    closeOnDealloc:YES];

  // throw away our socket
  CFSocketInvalidate(socket);
  CFRelease(socket);

  // register for notifications of accepted incoming connections
  [[NSNotificationCenter defaultCenter] addObserver:self
                                           selector:@selector(connectionAccepted:)
                                               name:NSFileHandleConnectionAcceptedNotification
                                             object:_socketFileHandle];

  // tell socket to listen
  [_socketFileHandle acceptConnectionInBackgroundAndNotify];

  NSLog(@"TSocketServer: Listening on TCP port %d", port);

  return self;
}


-(void) dealloc
{
  [[NSNotificationCenter defaultCenter] removeObserver:self];
}


-(void) connectionAccepted:(NSNotification *)notification
{
  NSFileHandle *socket = [notification.userInfo objectForKey:NSFileHandleNotificationFileHandleItem];

  // Now that we have a client connected, handle request on queue
  dispatch_async(_processingQueue, ^{

    [self handleClientConnection:socket];

  });

  // Continue accepting connections
  [_socketFileHandle acceptConnectionInBackgroundAndNotify];
}


-(void) handleClientConnection:(NSFileHandle *)clientSocket
{
  @autoreleasepool {

    TNSFileHandleTransport *transport = [[TNSFileHandleTransport alloc] initWithFileHandle:clientSocket];
    id<TProcessor> processor = [_processorFactory processorForTransport:transport];

    id <TProtocol> inProtocol = [_inputProtocolFactory newProtocolOnTransport:transport];
    id <TProtocol> outProtocol = [_outputProtocolFactory newProtocolOnTransport:transport];

    NSError *error;
    if (![processor processOnInputProtocol:inProtocol outputProtocol:outProtocol error:&error]) {
      // Handle error
      NSLog(@"Error processing request: %@", error);
    }

    dispatch_async(dispatch_get_main_queue(), ^{

      [NSNotificationCenter.defaultCenter postNotificationName:TSocketServerClientConnectionFinished
                                                        object:self
                                                      userInfo:@{TSocketServerProcessorKey: processor,
                                                                 TSockerServerTransportKey: transport}];
    });

  }
}

@end
