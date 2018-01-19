// ThriftCommon.h : Common includes, namespaces and templates 
// for sample Thrift client and server
//
// Add the following paths to the Project's properties:
//
// Configuration Properties -> C/C++ -> General-> Additional Include Directories --
// ../;../../../lib/cpp/src;../../../../boost;../../../../boost/boost/tr1;
//
// Configuration Properties -> Linker -> General -> Additional Library Directories --
// ../../../lib/cpp/$(Configuration);../../../../Boost/lib
//
// Configuration Properties -> Linker -> Input -> Additional Dependencies --
// libthrift.lib
//
// ... adjust relative paths as necessary.
//

#ifdef _WIN32 //thrift is crashing when using boost threads on Mac OSX
#  define USE_BOOST_THREAD 1
#  include <boost/thread.hpp>
#else
#  include <sys/socket.h>
#  include <netinet/in.h>
#endif

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Required Includes
//'server' side #includes
#include <thrift/concurrency/ThreadManager.h>
#include <thrift/concurrency/PlatformThreadFactory.h>
#include <thrift/server/TThreadPoolServer.h>
#include <thrift/server/TSimpleServer.h>
//'client' side #includes
#include <thrift/transport/TPipeServer.h>
#include <thrift/transport/TPipe.h>
#include <thrift/transport/TBufferTransports.h>
#include <thrift/transport/TSocket.h>
#include <thrift/transport/TTransport.h>

#include <thrift/protocol/TBinaryProtocol.h>


//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
// Required Namespaces
//'server' side namespaces
using namespace apache::thrift::server;
using namespace apache::thrift::concurrency;
//common namespaces
using namespace apache::thrift;
using namespace apache::thrift::protocol;
using namespace apache::thrift::transport;
//using namespace boost; //using ns boost can introduce type conflicts
//~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

namespace thriftcommon
{
	//----------------------------------------------------------------------------
	//
	//Start the thrift 'server' (both server & client side run one for bidir event signaling)
	// *** This function template will block ***
	//
	template <class MyHandler, class MyProcessor>
	void RunThriftServer (boost::shared_ptr<MyHandler> hndlr, 
		                  int NumThreads, 
						  boost::shared_ptr<TServerTransport> transport,
						  boost::shared_ptr<TServer> &server)
	{
#ifdef _WIN32
		if (!hndlr.get())
			throw std::exception("RunThriftServer() invalid handler");
		if (!transport.get())
			throw std::exception("RunThriftServer() invalid transport");
#else
		if ( !hndlr.get() || !transport.get() )
			throw std::exception();
#endif

		boost::shared_ptr<MyHandler> handler(hndlr);
		boost::shared_ptr<TProcessor> processor(new MyProcessor(handler));
		boost::shared_ptr<TTransportFactory> tfactory(new TBufferedTransportFactory());
		boost::shared_ptr<TProtocolFactory> pfactory(new TBinaryProtocolFactory());

		if(NumThreads <= 1)
		{	//Single-threaded server
			server.reset(new TSimpleServer(processor, transport, tfactory, pfactory));
		}
		else
		{	//Multi-threaded server
			boost::shared_ptr<ThreadManager> threadManager = ThreadManager::newSimpleThreadManager(NumThreads);
			boost::shared_ptr<PlatformThreadFactory> threadFactory = boost::shared_ptr<PlatformThreadFactory>(new PlatformThreadFactory());
			threadManager->threadFactory(threadFactory);
			threadManager->start();
			server.reset(new TThreadPoolServer(processor, transport, tfactory, pfactory, threadManager));
		}

		printf("Starting the 'server'...\n");
		server->serve();
		printf("done.\n");
	}

	// Thrift server wrapper function that accepts a pipe name.
	// A handler must be passed in to this version.
	template <class MyHandler, class MyProcessor>
	void RunThriftServer (boost::shared_ptr<MyHandler> hndlr, int NumThreads, std::string pipename, boost::shared_ptr<TServer> &svr)
	{
#ifndef _WIN32  //Mac, *nix
		unlink(pipename.c_str());
#endif
		boost::shared_ptr<TServerTransport> transport(new TPipeServer(pipename, 1024, NumThreads)); //Named pipe
		RunThriftServer<MyHandler, MyProcessor>(hndlr, NumThreads, transport, svr);
	}

	// Thrift server wrapper function that accepts a pipe name.
	// This version instantiates its own handler.
	template <class MyHandler, class MyProcessor>
	void RunThriftServer (int NumThreads, std::string pipename)
	{
		boost::shared_ptr<MyHandler> handler(new MyHandler());
		boost::shared_ptr<TServer> server;

		RunThriftServer<MyHandler, MyProcessor>(handler, NumThreads, pipename, server);
	}

	// Thrift server wrapper function that accepts a socket port number.
	// A handler must be passed in to this version.
	template <class MyHandler, class MyProcessor>
	void RunThriftServer (boost::shared_ptr<MyHandler> hndlr, int NumThreads, int Port)
	{
		boost::shared_ptr<TServerTransport> transport(new TServerSocket(Port));
		boost::shared_ptr<TServer> server;
		RunThriftServer<MyHandler, MyProcessor>(hndlr, NumThreads, transport, server);
	}

	// Thrift server wrapper function that accepts a socket port number.
	// This version instantiates its own handler.
	template <class MyHandler, class MyProcessor>
	void RunThriftServer (int NumThreads, int Port)
	{
		boost::shared_ptr<MyHandler> handler(new MyHandler());

		RunThriftServer<MyHandler, MyProcessor>(handler, NumThreads, Port);
	}

	//
	template <class MyHandler, class MyProcessor>
	void RunThriftServer (boost::shared_ptr<MyHandler> hndlr, int NumThreads, boost::shared_ptr<TServerTransport> transport)
	{
		boost::shared_ptr<TServer> server;
		RunThriftServer<MyHandler, MyProcessor>(hndlr, NumThreads, transport, server);
	}

	//----------------------------------------------------------------------------
	//Connect to thrift 'server' - Socket version
	//(both server & client side run one for bidir event signaling)
	//
	template <class MyClient, class MyTransport>
	void ConnectToServer (boost::shared_ptr<MyClient> &client, boost::shared_ptr<MyTransport> &transport, int Port)
	{
		//Client side connection using sockets transport.
		boost::shared_ptr<TTransport> socket(new TSocket("localhost", Port));
		transport.reset(new TBufferedTransport(socket));
		boost::shared_ptr<TProtocol> protocol(new TBinaryProtocol(transport));

		client.reset(new MyClient(protocol));
	}

	//Connect to thrift 'server' - Named Pipe version
	template <class MyClient, class MyTransport>
	void ConnectToServer (boost::shared_ptr<MyClient> &client, boost::shared_ptr<MyTransport> &transport, std::string pipename)
	{
		//Client side connection using Named Pipe transport.
		boost::shared_ptr<TTransport> pipe(new TPipe(pipename));
		transport.reset(new TBufferedTransport(pipe));
		boost::shared_ptr<TProtocol> protocol(new TBinaryProtocol(transport));

		client.reset(new MyClient(protocol));
	}

	//Connect to thrift 'server' - Anonymous Pipe version
	//Currently only supported under Windows
#ifdef _WIN32
	template <class MyClient, class MyTransport>
	void ConnectToServer (boost::shared_ptr<MyClient> &client, boost::shared_ptr<MyTransport> &transport, HANDLE RdPipe, HANDLE WrtPipe)
	{
		//Client side connection using sockets transport.
#ifdef _WIN32
		boost::shared_ptr<TTransport> pipe(new TPipe((int)RdPipe, (int)WrtPipe));
		transport.reset(new TBufferedTransport(pipe));
#else
		boost::shared_ptr<TTransport> socket(new TSocket("localhost"));
		transport.reset(new TBufferedTransport(socket));
#endif
		boost::shared_ptr<TProtocol> protocol(new TBinaryProtocol(transport));

		client.reset(new MyClient(protocol));
	}
#endif

	//----------------------------------------------------------------------------
	//Launch child process and pass R/W anonymous pipe handles on cmd line.
	//Currently only supported under Windows
#ifdef _WIN32
	bool LaunchAnonPipeChild(std::string app, boost::shared_ptr<TServerTransport> transport);
#endif
}
