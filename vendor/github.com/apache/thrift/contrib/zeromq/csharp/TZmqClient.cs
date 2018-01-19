using System;
using ZMQ;
using System.IO;
using Thrift.Transport;

namespace ZmqClient
{
	public class TZmqClient : TTransport
	{
		Socket _sock;
		String _endpoint;
		MemoryStream _wbuf = new MemoryStream ();
		MemoryStream _rbuf = new MemoryStream ();

		void debug (string msg)
		{
			//Uncomment to enable debug
//			Console.WriteLine (msg);
		}

		public TZmqClient (Context ctx, String endpoint, SocketType sockType)
		{
			_sock = ctx.Socket (sockType);
			_endpoint = endpoint;
		}

		public override void Open ()
		{
			_sock.Connect (_endpoint);
		}
		
		public override void Close ()
		{
			throw new NotImplementedException ();
		}

		public override bool IsOpen {
			get {
				throw new NotImplementedException ();
			}
		}

		public override int Read (byte[] buf, int off, int len)
		{
			debug ("Client_Read");
			if (off != 0 || len != buf.Length)
				throw new NotImplementedException ();

			if (_rbuf.Length == 0) {
				//Fill the Buffer with the complete ZMQ Message which needs to be(?!) the complete Thrift response
				debug ("Client_Read Filling buffer..");
				byte[] tmpBuf = _sock.Recv ();
				debug (string.Format("Client_Read filled with {0}b",tmpBuf.Length));
				_rbuf.Write (tmpBuf, 0, tmpBuf.Length);
				_rbuf.Position = 0;	//For reading
			}
			int ret = _rbuf.Read (buf, 0, len);
			if (_rbuf.Length == _rbuf.Position)	//Finished reading
				_rbuf.SetLength (0);
			debug (string.Format ("Client_Read return {0}b, remaining  {1}b", ret, _rbuf.Length - _rbuf.Position));
			return ret;
		}

		public override void Write (byte[] buf, int off, int len)
		{
			debug ("Client_Write");
			_wbuf.Write (buf, off, len);
		}

		public override void Flush ()
		{
			debug ("Client_Flush");
			_sock.Send (_wbuf.GetBuffer ());
			_wbuf = new MemoryStream ();
		}
	}
}

