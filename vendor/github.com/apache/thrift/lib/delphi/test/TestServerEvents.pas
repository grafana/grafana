(*
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
 *)

unit TestServerEvents;

interface

uses
  SysUtils,
  Thrift,
  Thrift.Protocol,
  Thrift.Transport,
  Thrift.Server,
  Thrift.Console;

type
  TRequestEventsImpl = class( TInterfacedObject, IRequestEvents)
  protected
    FStart : TDateTime;
    // IRequestProcessingEvents
    procedure PreRead;
    procedure PostRead;
    procedure PreWrite;
    procedure PostWrite;
    procedure OnewayComplete;
    procedure UnhandledError( const e : Exception);
    procedure CleanupContext;
  public
    constructor Create;
  end;


  TProcessorEventsImpl = class( TInterfacedObject, IProcessorEvents)
  protected
    FReqs : Integer;
    // IProcessorEvents
    procedure Processing( const transport : ITransport);
    function  CreateRequestContext( const aFunctionName : string) : IRequestEvents;
    procedure CleanupContext;
  public
    constructor Create;
  end;


  TServerEventsImpl = class( TInterfacedObject, IServerEvents)
  protected
    // IServerEvents
    procedure PreServe;
    procedure PreAccept;
    function  CreateProcessingContext( const input, output : IProtocol) : IProcessorEvents;
  end;


implementation

{ TServerEventsImpl }

procedure TServerEventsImpl.PreServe;
begin
  Console.WriteLine('ServerEvents: Server starting to serve requests');
end;


procedure TServerEventsImpl.PreAccept;
begin
  Console.WriteLine('ServerEvents: Server transport is ready to accept incoming calls');
end;


function TServerEventsImpl.CreateProcessingContext(const input, output: IProtocol): IProcessorEvents;
begin
  result := TProcessorEventsImpl.Create;
end;


{ TProcessorEventsImpl }

constructor TProcessorEventsImpl.Create;
begin
  inherited Create;
  FReqs := 0;
  Console.WriteLine('ProcessorEvents: Client connected, processing begins');
end;

procedure TProcessorEventsImpl.Processing(const transport: ITransport);
begin
  Console.WriteLine('ProcessorEvents: Processing of incoming request begins');
end;


function TProcessorEventsImpl.CreateRequestContext( const aFunctionName: string): IRequestEvents;
begin
  result := TRequestEventsImpl.Create;
  Inc( FReqs);
end;


procedure TProcessorEventsImpl.CleanupContext;
begin
  Console.WriteLine( 'ProcessorEvents: completed after handling '+IntToStr(FReqs)+' requests.');
end;


{ TRequestEventsImpl }


constructor TRequestEventsImpl.Create;
begin
  inherited Create;
  FStart := Now;
  Console.WriteLine('RequestEvents: New request');
end;


procedure TRequestEventsImpl.PreRead;
begin
  Console.WriteLine('RequestEvents: Reading request message ...');
end;


procedure TRequestEventsImpl.PostRead;
begin
  Console.WriteLine('RequestEvents: Reading request message completed');
end;

procedure TRequestEventsImpl.PreWrite;
begin
  Console.WriteLine('RequestEvents: Writing response message ...');
end;


procedure TRequestEventsImpl.PostWrite;
begin
  Console.WriteLine('RequestEvents: Writing response message completed');
end;


procedure TRequestEventsImpl.OnewayComplete;
begin
  Console.WriteLine('RequestEvents: Oneway message processed');
end;


procedure TRequestEventsImpl.UnhandledError(const e: Exception);
begin
  Console.WriteLine('RequestEvents: Unhandled exception of type '+e.classname);
end;


procedure TRequestEventsImpl.CleanupContext;
var millis : Double;
begin
  millis := (Now - FStart) * (24*60*60*1000);
  Console.WriteLine( 'Request processing completed in '+IntToStr(Round(millis))+' ms');
end;


end.
