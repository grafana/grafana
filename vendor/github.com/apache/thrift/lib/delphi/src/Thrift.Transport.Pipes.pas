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
unit Thrift.Transport.Pipes;

{$WARN SYMBOL_PLATFORM OFF}
{$I Thrift.Defines.inc}

interface

uses
  {$IFDEF OLD_UNIT_NAMES}
  Windows, SysUtils, Math, AccCtrl, AclAPI, SyncObjs,
  {$ELSE}
  Winapi.Windows, System.SysUtils, System.Math, Winapi.AccCtrl, Winapi.AclAPI, System.SyncObjs,
  {$ENDIF}
  Thrift.Transport,
  Thrift.Utils,
  Thrift.Stream;

const
  DEFAULT_THRIFT_PIPE_OPEN_TIMEOUT = 10;  // default: fail fast on open


type
  //--- Pipe Streams ---


  TPipeStreamBase = class( TThriftStreamImpl)
  strict protected
    FPipe    : THandle;
    FTimeout : DWORD;
    FOpenTimeOut : DWORD;  // separate value to allow for fail-fast-on-open scenarios
    FOverlapped : Boolean;

    procedure Write( const buffer: TBytes; offset: Integer; count: Integer); override;
    function  Read( var buffer: TBytes; offset: Integer; count: Integer): Integer; override;
    //procedure Open; override; - see derived classes
    procedure Close; override;
    procedure Flush; override;

    function  ReadDirect(     var buffer: TBytes; offset: Integer; count: Integer): Integer;
    function  ReadOverlapped( var buffer: TBytes; offset: Integer; count: Integer): Integer;
    procedure WriteDirect(     const buffer: TBytes; offset: Integer; count: Integer);
    procedure WriteOverlapped( const buffer: TBytes; offset: Integer; count: Integer);

    function IsOpen: Boolean; override;
    function ToArray: TBytes; override;
  public
    constructor Create( aEnableOverlapped : Boolean;
                        const aTimeOut : DWORD = DEFAULT_THRIFT_TIMEOUT;
                        const aOpenTimeOut : DWORD = DEFAULT_THRIFT_PIPE_OPEN_TIMEOUT);
    destructor Destroy;  override;
  end;


  TNamedPipeStreamImpl = class sealed( TPipeStreamBase)
  strict private
    FPipeName  : string;
    FShareMode : DWORD;
    FSecurityAttribs : PSecurityAttributes;

  strict protected
    procedure Open; override;

  public
    constructor Create( const aPipeName : string;
                        const aEnableOverlapped : Boolean;
                        const aShareMode: DWORD = 0;
                        const aSecurityAttributes: PSecurityAttributes = nil;
                        const aTimeOut : DWORD = DEFAULT_THRIFT_TIMEOUT;
                        const aOpenTimeOut : DWORD = DEFAULT_THRIFT_PIPE_OPEN_TIMEOUT);  overload;
  end;


  THandlePipeStreamImpl = class sealed( TPipeStreamBase)
  strict private
    FSrcHandle : THandle;

  strict protected
    procedure Open; override;

  public
    constructor Create( const aPipeHandle : THandle;
                        const aOwnsHandle, aEnableOverlapped : Boolean;
                        const aTimeOut : DWORD = DEFAULT_THRIFT_TIMEOUT);  overload;
    destructor Destroy;  override;
  end;


  //--- Pipe Transports ---


  IPipeTransport = interface( IStreamTransport)
    ['{5E05CC85-434F-428F-BFB2-856A168B5558}']
  end;


  TPipeTransportBase = class( TStreamTransportImpl, IPipeTransport)
  public
    // ITransport
    function  GetIsOpen: Boolean; override;
    procedure Open; override;
    procedure Close; override;
  end;


  TNamedPipeTransportClientEndImpl = class( TPipeTransportBase)
  public
    // Named pipe constructors
    constructor Create( aPipe : THandle; aOwnsHandle : Boolean;
                        const aTimeOut : DWORD); overload;
    constructor Create( const aPipeName : string;
                        const aShareMode: DWORD = 0;
                        const aSecurityAttributes: PSecurityAttributes = nil;
                        const aTimeOut : DWORD = DEFAULT_THRIFT_TIMEOUT;
                        const aOpenTimeOut : DWORD = DEFAULT_THRIFT_PIPE_OPEN_TIMEOUT);  overload;
  end;


  TNamedPipeTransportServerEndImpl = class( TNamedPipeTransportClientEndImpl)
  strict private
    FHandle : THandle;
  public
    // ITransport
    procedure Close; override;
    constructor Create( aPipe : THandle; aOwnsHandle : Boolean;
                        const aTimeOut : DWORD = DEFAULT_THRIFT_TIMEOUT); reintroduce;
  end;


  TAnonymousPipeTransportImpl = class( TPipeTransportBase)
  public
    // Anonymous pipe constructor
    constructor Create(const aPipeRead, aPipeWrite : THandle;
                       aOwnsHandles : Boolean;
                       const aTimeOut : DWORD = DEFAULT_THRIFT_TIMEOUT); overload;
  end;


  //--- Server Transports ---


  IAnonymousPipeServerTransport = interface( IServerTransport)
    ['{7AEE6793-47B9-4E49-981A-C39E9108E9AD}']
    // Server side anonymous pipe ends
    function ReadHandle : THandle;
    function WriteHandle : THandle;
    // Client side anonymous pipe ends
    function ClientAnonRead : THandle;
    function ClientAnonWrite  : THandle;
  end;


  INamedPipeServerTransport = interface( IServerTransport)
    ['{9DF9EE48-D065-40AF-8F67-D33037D3D960}']
    function Handle : THandle;
  end;


  TPipeServerTransportBase = class( TServerTransportImpl)
  strict protected
    FStopServer : TEvent;
    procedure InternalClose; virtual; abstract;
    function QueryStopServer : Boolean;
  public
    constructor Create;
    destructor Destroy;  override;
    procedure Listen; override;
    procedure Close; override;
  end;


  TAnonymousPipeServerTransportImpl = class( TPipeServerTransportBase, IAnonymousPipeServerTransport)
  strict private
    FBufSize      : DWORD;

    // Server side anonymous pipe handles
    FReadHandle,
    FWriteHandle : THandle;

    //Client side anonymous pipe handles
    FClientAnonRead,
    FClientAnonWrite  : THandle;

    FTimeOut: DWORD;
  protected
    function Accept(const fnAccepting: TProc): ITransport; override;

    function CreateAnonPipe : Boolean;

    // IAnonymousPipeServerTransport
    function ReadHandle : THandle;
    function WriteHandle : THandle;
    function ClientAnonRead : THandle;
    function ClientAnonWrite  : THandle;

    procedure InternalClose; override;

  public
    constructor Create(aBufsize : Cardinal = 4096; aTimeOut : DWORD = DEFAULT_THRIFT_TIMEOUT);
  end;


  TNamedPipeServerTransportImpl = class( TPipeServerTransportBase, INamedPipeServerTransport)
  strict private
    FPipeName     : string;
    FMaxConns     : DWORD;
    FBufSize      : DWORD;
    FTimeout      : DWORD;
    FHandle       : THandle;
    FConnected    : Boolean;


  strict protected
    function Accept(const fnAccepting: TProc): ITransport; override;
    function CreateNamedPipe : THandle;
    function CreateTransportInstance : ITransport;

    // INamedPipeServerTransport
    function Handle : THandle;
    procedure InternalClose; override;

  public
    constructor Create( aPipename : string; aBufsize : Cardinal = 4096;
                        aMaxConns : Cardinal = PIPE_UNLIMITED_INSTANCES;
                        aTimeOut : Cardinal = INFINITE);
  end;


implementation


procedure ClosePipeHandle( var hPipe : THandle);
begin
  if hPipe <> INVALID_HANDLE_VALUE
  then try
    CloseHandle( hPipe);
  finally
    hPipe := INVALID_HANDLE_VALUE;
  end;
end;


function DuplicatePipeHandle( const hSource : THandle) : THandle;
begin
  if not DuplicateHandle( GetCurrentProcess, hSource,
                          GetCurrentProcess, @result,
                          0, FALSE, DUPLICATE_SAME_ACCESS)
  then raise TTransportExceptionNotOpen.Create('DuplicateHandle: '+SysErrorMessage(GetLastError));
end;



{ TPipeStreamBase }


constructor TPipeStreamBase.Create( aEnableOverlapped : Boolean;
                                    const aTimeOut, aOpenTimeOut : DWORD);
begin
  inherited Create;
  ASSERT( aTimeout > 0);  // aOpenTimeout may be 0
  FPipe        := INVALID_HANDLE_VALUE;
  FTimeout     := aTimeOut;
  FOpenTimeOut := aOpenTimeOut;
  FOverlapped  := aEnableOverlapped;
end;


destructor TPipeStreamBase.Destroy;
begin
  try
    Close;
  finally
    inherited Destroy;
  end;
end;


procedure TPipeStreamBase.Close;
begin
  ClosePipeHandle( FPipe);
end;


procedure TPipeStreamBase.Flush;
begin
  FlushFileBuffers( FPipe);
end;


function TPipeStreamBase.IsOpen: Boolean;
begin
  result := (FPipe <> INVALID_HANDLE_VALUE);
end;


procedure TPipeStreamBase.Write(const buffer: TBytes; offset, count: Integer);
begin
  if FOverlapped
  then WriteOverlapped( buffer, offset, count)
  else WriteDirect( buffer, offset, count);
end;


function TPipeStreamBase.Read( var buffer: TBytes; offset, count: Integer): Integer;
begin
  if FOverlapped
  then result := ReadOverlapped( buffer, offset, count)
  else result := ReadDirect( buffer, offset, count);
end;


procedure TPipeStreamBase.WriteDirect(const buffer: TBytes; offset, count: Integer);
var cbWritten : DWORD;
begin
  if not IsOpen
  then raise TTransportExceptionNotOpen.Create('Called write on non-open pipe');

  if not WriteFile( FPipe, buffer[offset], count, cbWritten, nil)
  then raise TTransportExceptionNotOpen.Create('Write to pipe failed');
end;


function TPipeStreamBase.ReadDirect( var buffer: TBytes; offset, count: Integer): Integer;
var cbRead, dwErr  : DWORD;
    bytes, retries  : LongInt;
    bOk     : Boolean;
const INTERVAL = 10;  // ms
begin
  if not IsOpen
  then raise TTransportExceptionNotOpen.Create('Called read on non-open pipe');

  // MSDN: Handle can be a handle to a named pipe instance,
  // or it can be a handle to the read end of an anonymous pipe,
  // The handle must have GENERIC_READ access to the pipe.
  if FTimeOut <> INFINITE then begin
    retries := Max( 1, Round( 1.0 * FTimeOut / INTERVAL));
    while TRUE do begin
      if not PeekNamedPipe( FPipe, nil, 0, nil, @bytes, nil) then begin
        dwErr := GetLastError;
        if (dwErr = ERROR_INVALID_HANDLE)
        or (dwErr = ERROR_BROKEN_PIPE)
        or (dwErr = ERROR_PIPE_NOT_CONNECTED)
        then begin
          result := 0;  // other side closed the pipe
          Exit;
        end;
      end
      else if bytes > 0 then begin
        Break;  // there are data
      end;

      Dec( retries);
      if retries > 0
      then Sleep( INTERVAL)
      else raise TTransportExceptionTimedOut.Create('Pipe read timed out');
    end;
  end;

  // read the data (or block INFINITE-ly)
  bOk := ReadFile( FPipe, buffer[offset], count, cbRead, nil);
  if (not bOk) and (GetLastError() <> ERROR_MORE_DATA)
  then result := 0 // No more data, possibly because client disconnected.
  else result := cbRead;
end;


procedure TPipeStreamBase.WriteOverlapped(const buffer: TBytes; offset, count: Integer);
var cbWritten, dwWait, dwError : DWORD;
    overlapped : IOverlappedHelper;
begin
  if not IsOpen
  then raise TTransportExceptionNotOpen.Create('Called write on non-open pipe');

  overlapped := TOverlappedHelperImpl.Create;

  if not WriteFile( FPipe, buffer[offset], count, cbWritten, overlapped.OverlappedPtr)
  then begin
    dwError := GetLastError;
    case dwError of
      ERROR_IO_PENDING : begin
        dwWait := overlapped.WaitFor(FTimeout);

        if (dwWait = WAIT_TIMEOUT)
        then raise TTransportExceptionTimedOut.Create('Pipe write timed out');

        if (dwWait <> WAIT_OBJECT_0)
        or not GetOverlappedResult( FPipe, overlapped.Overlapped, cbWritten, TRUE)
        then raise TTransportExceptionUnknown.Create('Pipe write error');
      end;

    else
      raise TTransportExceptionUnknown.Create(SysErrorMessage(dwError));
    end;
  end;

  ASSERT( DWORD(count) = cbWritten);
end;


function TPipeStreamBase.ReadOverlapped( var buffer: TBytes; offset, count: Integer): Integer;
var cbRead, dwWait, dwError  : DWORD;
    bOk     : Boolean;
    overlapped : IOverlappedHelper;
begin
  if not IsOpen
  then raise TTransportExceptionNotOpen.Create('Called read on non-open pipe');

  overlapped := TOverlappedHelperImpl.Create;

  // read the data
  bOk := ReadFile( FPipe, buffer[offset], count, cbRead, overlapped.OverlappedPtr);
  if not bOk then begin
    dwError := GetLastError;
    case dwError of
      ERROR_IO_PENDING : begin
        dwWait := overlapped.WaitFor(FTimeout);

        if (dwWait = WAIT_TIMEOUT)
        then raise TTransportExceptionTimedOut.Create('Pipe read timed out');

        if (dwWait <> WAIT_OBJECT_0)
        or not GetOverlappedResult( FPipe, overlapped.Overlapped, cbRead, TRUE)
        then raise TTransportExceptionUnknown.Create('Pipe read error');
      end;

    else
      raise TTransportExceptionUnknown.Create(SysErrorMessage(dwError));
    end;
  end;

  ASSERT( cbRead > 0);  // see TTransportImpl.ReadAll()
  ASSERT( cbRead = DWORD(count));
  result := cbRead;
end;


function TPipeStreamBase.ToArray: TBytes;
var bytes : LongInt;
begin
  SetLength( result, 0);
  bytes := 0;

  if  IsOpen
  and PeekNamedPipe( FPipe, nil, 0, nil, @bytes, nil)
  and (bytes > 0)
  then begin
    SetLength( result, bytes);
    Read( result, 0, bytes);
  end;
end;


{ TNamedPipeStreamImpl }


constructor TNamedPipeStreamImpl.Create( const aPipeName : string;
                                         const aEnableOverlapped : Boolean;
                                         const aShareMode: DWORD;
                                         const aSecurityAttributes: PSecurityAttributes;
                                         const aTimeOut, aOpenTimeOut : DWORD);
begin
  inherited Create( aEnableOverlapped, aTimeout, aOpenTimeOut);

  FPipeName        := aPipeName;
  FShareMode       := aShareMode;
  FSecurityAttribs := aSecurityAttributes;

  if Copy(FPipeName,1,2) <> '\\'
  then FPipeName := '\\.\pipe\' + FPipeName;  // assume localhost
end;


procedure TNamedPipeStreamImpl.Open;
var hPipe    : THandle;
    retries, timeout, dwErr : DWORD;
const INTERVAL = 10; // ms
begin
  if IsOpen then Exit;

  retries := Max( 1, Round( 1.0 * FOpenTimeOut / INTERVAL));
  timeout := FOpenTimeOut;

  // if the server hasn't gotten to the point where the pipe has been created, at least wait the timeout
  // According to MSDN, if no instances of the specified named pipe exist, the WaitNamedPipe function
  // returns IMMEDIATELY, regardless of the time-out value.
  // Always use INTERVAL, since WaitNamedPipe(0) defaults to some other value
  while not WaitNamedPipe( PChar(FPipeName), INTERVAL) do begin
    dwErr := GetLastError;
    if dwErr <> ERROR_FILE_NOT_FOUND
    then raise TTransportExceptionNotOpen.Create('Unable to open pipe, '+SysErrorMessage(dwErr));

    if timeout <> INFINITE then begin
      if (retries > 0)
      then Dec(retries)
      else raise TTransportExceptionNotOpen.Create('Unable to open pipe, timed out');
    end;

    Sleep(INTERVAL)
  end;

  // open that thingy
  hPipe := CreateFile( PChar( FPipeName),
                       GENERIC_READ or GENERIC_WRITE,
                       FShareMode,        // sharing
                       FSecurityAttribs,  // security attributes
                       OPEN_EXISTING,     // opens existing pipe
                       FILE_FLAG_OVERLAPPED or FILE_FLAG_WRITE_THROUGH, // async+fast, please
                       0);                // no template file

  if hPipe = INVALID_HANDLE_VALUE
  then raise TTransportExceptionNotOpen.Create('Unable to open pipe, '+SysErrorMessage(GetLastError));

  // everything fine
  FPipe := hPipe;
end;


{ THandlePipeStreamImpl }


constructor THandlePipeStreamImpl.Create( const aPipeHandle : THandle;
                                          const aOwnsHandle, aEnableOverlapped : Boolean;
                                          const aTimeOut : DWORD);
begin
  inherited Create( aEnableOverlapped, aTimeOut);

  if aOwnsHandle
  then FSrcHandle := aPipeHandle
  else FSrcHandle := DuplicatePipeHandle( aPipeHandle);

  Open;
end;


destructor THandlePipeStreamImpl.Destroy;
begin
  try
    ClosePipeHandle( FSrcHandle);
  finally
    inherited Destroy;
  end;
end;


procedure THandlePipeStreamImpl.Open;
begin
  if not IsOpen
  then FPipe := DuplicatePipeHandle( FSrcHandle);
end;


{ TPipeTransportBase }


function TPipeTransportBase.GetIsOpen: Boolean;
begin
  result := (FInputStream <> nil)  and (FInputStream.IsOpen)
        and (FOutputStream <> nil) and (FOutputStream.IsOpen);
end;


procedure TPipeTransportBase.Open;
begin
  FInputStream.Open;
  FOutputStream.Open;
end;


procedure TPipeTransportBase.Close;
begin
  FInputStream.Close;
  FOutputStream.Close;
end;


{ TNamedPipeTransportClientEndImpl }


constructor TNamedPipeTransportClientEndImpl.Create( const aPipeName : string; const aShareMode: DWORD;
                                   const aSecurityAttributes: PSecurityAttributes;
                                   const aTimeOut, aOpenTimeOut : DWORD);
// Named pipe constructor
begin
  inherited Create( nil, nil);
  FInputStream  := TNamedPipeStreamImpl.Create( aPipeName, TRUE, aShareMode, aSecurityAttributes, aTimeOut, aOpenTimeOut);
  FOutputStream := FInputStream;  // true for named pipes
end;


constructor TNamedPipeTransportClientEndImpl.Create( aPipe : THandle; aOwnsHandle : Boolean;
                                                     const aTimeOut : DWORD);
// Named pipe constructor
begin
  inherited Create( nil, nil);
  FInputStream  := THandlePipeStreamImpl.Create( aPipe, TRUE, aOwnsHandle, aTimeOut);
  FOutputStream := FInputStream;  // true for named pipes
end;


{ TNamedPipeTransportServerEndImpl }


constructor TNamedPipeTransportServerEndImpl.Create( aPipe : THandle; aOwnsHandle : Boolean;
                                                     const aTimeOut : DWORD);
// Named pipe constructor
begin
  FHandle := DuplicatePipeHandle( aPipe);
  inherited Create( aPipe, aOwnsHandle, aTimeOut);
end;


procedure TNamedPipeTransportServerEndImpl.Close;
begin
  FlushFileBuffers( FHandle);
  DisconnectNamedPipe( FHandle);  // force client off the pipe
  ClosePipeHandle( FHandle);

  inherited Close;
end;


{ TAnonymousPipeTransportImpl }


constructor TAnonymousPipeTransportImpl.Create( const aPipeRead, aPipeWrite : THandle;
                                                aOwnsHandles : Boolean;
                                                const aTimeOut : DWORD = DEFAULT_THRIFT_TIMEOUT);
// Anonymous pipe constructor
begin
  inherited Create( nil, nil);
  // overlapped is not supported with AnonPipes, see MSDN
  FInputStream  := THandlePipeStreamImpl.Create( aPipeRead, aOwnsHandles, FALSE, aTimeOut);
  FOutputStream := THandlePipeStreamImpl.Create( aPipeWrite, aOwnsHandles, FALSE, aTimeOut);
end;


{ TPipeServerTransportBase }


constructor TPipeServerTransportBase.Create;
begin
  inherited Create;
  FStopServer := TEvent.Create(nil,TRUE,FALSE,'');  // manual reset
end;


destructor TPipeServerTransportBase.Destroy;
begin
  try
    FreeAndNil( FStopServer);
  finally
    inherited Destroy;
  end;
end;


function TPipeServerTransportBase.QueryStopServer : Boolean;
begin
  result := (FStopServer = nil)
         or (FStopServer.WaitFor(0) <> wrTimeout);
end;


procedure TPipeServerTransportBase.Listen;
begin
  FStopServer.ResetEvent;
end;


procedure TPipeServerTransportBase.Close;
begin
  FStopServer.SetEvent;
  InternalClose;
end;


{ TAnonymousPipeServerTransportImpl }


constructor TAnonymousPipeServerTransportImpl.Create(aBufsize : Cardinal; aTimeOut : DWORD);
// Anonymous pipe CTOR
begin
  inherited Create;
  FBufsize  := aBufSize;
  FReadHandle := INVALID_HANDLE_VALUE;
  FWriteHandle := INVALID_HANDLE_VALUE;
  FClientAnonRead := INVALID_HANDLE_VALUE;
  FClientAnonWrite := INVALID_HANDLE_VALUE;
  FTimeOut := aTimeOut;

  // The anonymous pipe needs to be created first so that the server can
  // pass the handles on to the client before the serve (acceptImpl)
  // blocking call.
  if not CreateAnonPipe
  then raise TTransportExceptionNotOpen.Create(ClassName+'.Create() failed');
end;


function TAnonymousPipeServerTransportImpl.Accept(const fnAccepting: TProc): ITransport;
var buf    : Byte;
    br     : DWORD;
begin
  if Assigned(fnAccepting)
  then fnAccepting();

  // This 0-byte read serves merely as a blocking call.
  if not ReadFile( FReadHandle, buf, 0, br, nil)
  and (GetLastError() <> ERROR_MORE_DATA)
  then raise TTransportExceptionNotOpen.Create('TServerPipe unable to initiate pipe communication');

  // create the transport impl
  result := TAnonymousPipeTransportImpl.Create( FReadHandle, FWriteHandle, FALSE, FTimeOut);
end;


procedure TAnonymousPipeServerTransportImpl.InternalClose;
begin
  ClosePipeHandle( FReadHandle);
  ClosePipeHandle( FWriteHandle);
  ClosePipeHandle( FClientAnonRead);
  ClosePipeHandle( FClientAnonWrite);
end;


function TAnonymousPipeServerTransportImpl.ReadHandle : THandle;
begin
  result := FReadHandle;
end;


function TAnonymousPipeServerTransportImpl.WriteHandle : THandle;
begin
  result := FWriteHandle;
end;


function TAnonymousPipeServerTransportImpl.ClientAnonRead : THandle;
begin
  result := FClientAnonRead;
end;


function TAnonymousPipeServerTransportImpl.ClientAnonWrite  : THandle;
begin
  result := FClientAnonWrite;
end;


function TAnonymousPipeServerTransportImpl.CreateAnonPipe : Boolean;
var sd           : PSECURITY_DESCRIPTOR;
    sa           : SECURITY_ATTRIBUTES; //TSecurityAttributes;
    hCAR, hPipeW, hCAW, hPipe : THandle;
begin
  result := FALSE;

  sd := PSECURITY_DESCRIPTOR( LocalAlloc( LPTR,SECURITY_DESCRIPTOR_MIN_LENGTH));
  try
    Win32Check( InitializeSecurityDescriptor( sd, SECURITY_DESCRIPTOR_REVISION));
    Win32Check( SetSecurityDescriptorDacl( sd, TRUE, nil, FALSE));

    sa.nLength := sizeof( sa);
    sa.lpSecurityDescriptor := sd;
    sa.bInheritHandle       := TRUE; //allow passing handle to child

    if not CreatePipe( hCAR, hPipeW, @sa, FBufSize) then begin   //create stdin pipe
      raise TTransportExceptionNotOpen.Create('TServerPipe CreatePipe (anon) failed, '+SysErrorMessage(GetLastError));
      Exit;
    end;

    if not CreatePipe( hPipe, hCAW, @sa, FBufSize) then begin  //create stdout pipe
      CloseHandle( hCAR);
      CloseHandle( hPipeW);
      raise TTransportExceptionNotOpen.Create('TServerPipe CreatePipe (anon) failed, '+SysErrorMessage(GetLastError));
      Exit;
    end;

    FClientAnonRead  := hCAR;
    FClientAnonWrite := hCAW;
    FReadHandle      := hPipe;
    FWriteHandle     := hPipeW;

    result := TRUE;

  finally
    if sd <> nil then LocalFree( Cardinal(sd));
  end;
end;


{ TNamedPipeServerTransportImpl }


constructor TNamedPipeServerTransportImpl.Create( aPipename : string; aBufsize, aMaxConns, aTimeOut : Cardinal);
// Named Pipe CTOR
begin
  inherited Create;
  ASSERT( aTimeout > 0);
  FPipeName  := aPipename;
  FBufsize   := aBufSize;
  FMaxConns  := Max( 1, Min( PIPE_UNLIMITED_INSTANCES, aMaxConns));
  FHandle    := INVALID_HANDLE_VALUE;
  FTimeout   := aTimeOut;
  FConnected := FALSE;

  if Copy(FPipeName,1,2) <> '\\'
  then FPipeName := '\\.\pipe\' + FPipeName;  // assume localhost
end;


function TNamedPipeServerTransportImpl.Accept(const fnAccepting: TProc): ITransport;
var dwError, dwWait, dwDummy : DWORD;
    overlapped : IOverlappedHelper;
    handles : array[0..1] of THandle;
begin
  overlapped := TOverlappedHelperImpl.Create;

  ASSERT( not FConnected);
  CreateNamedPipe;
  while not FConnected do begin

    if QueryStopServer
    then Abort;

    if Assigned(fnAccepting)
    then fnAccepting();

    // Wait for the client to connect; if it succeeds, the
    // function returns a nonzero value. If the function returns
    // zero, GetLastError should return ERROR_PIPE_CONNECTED.
    if ConnectNamedPipe( Handle, overlapped.OverlappedPtr) then begin
      FConnected := TRUE;
      Break;
    end;

    // ConnectNamedPipe() returns FALSE for OverlappedIO, even if connected.
    // We have to check GetLastError() explicitly to find out
    dwError := GetLastError;
    case dwError of
      ERROR_PIPE_CONNECTED : begin
        FConnected := not QueryStopServer;  // special case: pipe immediately connected
      end;

      ERROR_IO_PENDING : begin
        handles[0] := overlapped.WaitHandle;
        handles[1] := FStopServer.Handle;
        dwWait := WaitForMultipleObjects( 2, @handles, FALSE, FTimeout);
        FConnected := (dwWait = WAIT_OBJECT_0)
                  and GetOverlappedResult( Handle, overlapped.Overlapped, dwDummy, TRUE)
                  and not QueryStopServer;
      end;

    else
      InternalClose;
      raise TTransportExceptionNotOpen.Create('Client connection failed');
    end;
  end;

  // create the transport impl
  result := CreateTransportInstance;
end;


function TNamedPipeServerTransportImpl.CreateTransportInstance : ITransport;
// create the transport impl
var hPipe : THandle;
begin
  hPipe := THandle( InterlockedExchangePointer( Pointer(FHandle), Pointer(INVALID_HANDLE_VALUE)));
  try
    FConnected := FALSE;
    result := TNamedPipeTransportServerEndImpl.Create( hPipe, TRUE, FTimeout);
  except
    ClosePipeHandle(hPipe);
    raise;
  end;
end;


procedure TNamedPipeServerTransportImpl.InternalClose;
var hPipe : THandle;
begin
  hPipe := THandle( InterlockedExchangePointer( Pointer(FHandle), Pointer(INVALID_HANDLE_VALUE)));
  if hPipe = INVALID_HANDLE_VALUE then Exit;

  try
    if FConnected
    then FlushFileBuffers( hPipe)
    else CancelIo( hPipe);
    DisconnectNamedPipe( hPipe);
  finally
    ClosePipeHandle( hPipe);
    FConnected := FALSE;
  end;
end;


function TNamedPipeServerTransportImpl.Handle : THandle;
begin
  {$IFDEF WIN64}
  result := THandle( InterlockedExchangeAdd64( Int64(FHandle), 0));
  {$ELSE}
  result := THandle( InterlockedExchangeAdd( Integer(FHandle), 0));
  {$ENDIF}
end;


function TNamedPipeServerTransportImpl.CreateNamedPipe : THandle;
var SIDAuthWorld : SID_IDENTIFIER_AUTHORITY ;
    everyone_sid : PSID;
    ea           : EXPLICIT_ACCESS;
    acl          : PACL;
    sd           : PSECURITY_DESCRIPTOR;
    sa           : SECURITY_ATTRIBUTES;
const
  SECURITY_WORLD_SID_AUTHORITY  : TSIDIdentifierAuthority = (Value : (0,0,0,0,0,1));
  SECURITY_WORLD_RID = $00000000;
begin
  sd := nil;
  everyone_sid := nil;
  try
    ASSERT( (FHandle = INVALID_HANDLE_VALUE) and not FConnected);

    // Windows - set security to allow non-elevated apps
    // to access pipes created by elevated apps.
    SIDAuthWorld := SECURITY_WORLD_SID_AUTHORITY;
    AllocateAndInitializeSid( SIDAuthWorld, 1, SECURITY_WORLD_RID, 0, 0, 0, 0, 0, 0, 0, everyone_sid);

    ZeroMemory( @ea, SizeOf(ea));
    ea.grfAccessPermissions := GENERIC_ALL; //SPECIFIC_RIGHTS_ALL or STANDARD_RIGHTS_ALL;
    ea.grfAccessMode        := SET_ACCESS;
    ea.grfInheritance       := NO_INHERITANCE;
    ea.Trustee.TrusteeForm  := TRUSTEE_IS_SID;
    ea.Trustee.TrusteeType  := TRUSTEE_IS_WELL_KNOWN_GROUP;
    ea.Trustee.ptstrName    := PChar(everyone_sid);

    acl := nil;
    SetEntriesInAcl( 1, @ea, nil, acl);

    sd := PSECURITY_DESCRIPTOR( LocalAlloc( LPTR,SECURITY_DESCRIPTOR_MIN_LENGTH));
    Win32Check( InitializeSecurityDescriptor( sd, SECURITY_DESCRIPTOR_REVISION));
    Win32Check( SetSecurityDescriptorDacl( sd, TRUE, acl, FALSE));

    sa.nLength := SizeOf(sa);
    sa.lpSecurityDescriptor := sd;
    sa.bInheritHandle       := FALSE;

    // Create an instance of the named pipe
    {$IFDEF OLD_UNIT_NAMES}
    result := Windows.CreateNamedPipe(
    {$ELSE}
    result := Winapi.Windows.CreateNamedPipe(
    {$ENDIF}
        PChar( FPipeName),        // pipe name
        PIPE_ACCESS_DUPLEX or     // read/write access
        FILE_FLAG_OVERLAPPED,     // async mode
        PIPE_TYPE_BYTE or         // byte type pipe
        PIPE_READMODE_BYTE,       // byte read mode
        FMaxConns,                // max. instances
        FBufSize,                 // output buffer size
        FBufSize,                 // input buffer size
        FTimeout,                 // time-out, see MSDN
        @sa                       // default security attribute
    );

    if( result <> INVALID_HANDLE_VALUE)
    then InterlockedExchangePointer( Pointer(FHandle), Pointer(result))
    else raise TTransportExceptionNotOpen.Create('CreateNamedPipe() failed ' + IntToStr(GetLastError));

  finally
    if sd <> nil then LocalFree( Cardinal( sd));
    if acl <> nil then LocalFree( Cardinal( acl));
    if everyone_sid <> nil then FreeSid(everyone_sid);
  end;
end;



end.



