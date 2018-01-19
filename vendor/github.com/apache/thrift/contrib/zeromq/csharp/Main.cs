using System;
using System.Threading;
using Thrift.Protocol;
using ZMQ;
using ZmqServer;
using ZmqClient;

namespace ZmqServer
{
	class MainClass
	{
		public static void Main (string[] args)
		{
			new Thread(Server.serve).Start();
			Client.work();
		}
		
		static class Server{
			public static void serve(){
				StorageHandler s=new StorageHandler();
				Storage.Processor p=new Storage.Processor(s);
				
				ZMQ.Context c=new ZMQ.Context();
				
				TZmqServer tzs=new TZmqServer(p,c,"tcp://127.0.0.1:9090",ZMQ.SocketType.PAIR);
				tzs.Serve();
			}
			
			class StorageHandler:Storage.Iface{
				int val=0;
				
				public void incr(int amount){
					val+=amount;
					Console.WriteLine("incr({0})",amount);
				}
				
				public int get(){
					return val;
				} 
			}
		}
		
		static class Client{
			public static void work()
			{
				Context ctx=new Context();
				TZmqClient tzc=new TZmqClient(ctx,"tcp://127.0.0.1:9090",SocketType.PAIR);
				TBinaryProtocol p=new TBinaryProtocol(tzc);
				
				Storage.Client client=new Storage.Client(p);
				tzc.Open();
				
				Console.WriteLine(client.@get());
				client.incr(1);
				client.incr(41);
				Console.WriteLine(client.@get());
			}
		}
	}
}
