<?php

namespace Thrift\Factory;

use Thrift\Transport\TTransport;

class TTransportFactory
{
  /**
   * @static
   * @param TTransport $transport
   * @return TTransport
   */
  public static function getTransport(TTransport $transport)
  {
    return $transport;
  }
}
