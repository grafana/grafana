package amqp_test

import (
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"github.com/streadway/amqp"
	"io"
	"net"
	"testing"
	"time"
)

type tlsServer struct {
	net.Listener
	URL    string
	Config *tls.Config
	Header chan []byte
}

// Captures the header for each accepted connection
func (s *tlsServer) Serve() {
	for {
		c, err := s.Accept()
		if err != nil {
			return
		}

		header := make([]byte, 4)
		io.ReadFull(c, header)
		s.Header <- header
		c.Write([]byte{'A', 'M', 'Q', 'P', 0, 0, 0, 0})
		c.Close()
	}
}

func tlsConfig() *tls.Config {
	cfg := new(tls.Config)

	cfg.ClientCAs = x509.NewCertPool()
	cfg.ClientCAs.AppendCertsFromPEM([]byte(caCert))

	cert, err := tls.X509KeyPair([]byte(serverCert), []byte(serverKey))
	if err != nil {
		panic(err)
	}

	cfg.Certificates = append(cfg.Certificates, cert)
	cfg.ClientAuth = tls.RequireAndVerifyClientCert

	return cfg
}

func startTlsServer() tlsServer {
	cfg := tlsConfig()

	l, err := tls.Listen("tcp", "127.0.0.1:0", cfg)
	if err != nil {
		panic(err)
	}

	s := tlsServer{
		Listener: l,
		Config:   cfg,
		URL:      fmt.Sprintf("amqps://%s/", l.Addr().String()),
		Header:   make(chan []byte, 1),
	}

	go s.Serve()
	return s
}

// Tests that the server has handshaked the connection and seen the client
// protocol announcement.  Does not nest that the connection.open is successful.
func TestTLSHandshake(t *testing.T) {
	srv := startTlsServer()
	defer srv.Close()

	cfg := new(tls.Config)
	cfg.RootCAs = x509.NewCertPool()
	cfg.RootCAs.AppendCertsFromPEM([]byte(caCert))

	cert, _ := tls.X509KeyPair([]byte(clientCert), []byte(clientKey))
	cfg.Certificates = append(cfg.Certificates, cert)

	_, err := amqp.DialTLS(srv.URL, cfg)

	select {
	case <-time.After(10 * time.Millisecond):
		t.Fatalf("did not succeed to handshake the TLS connection after 10ms")
	case header := <-srv.Header:
		if string(header) != "AMQP" {
			t.Fatalf("expected to handshake a TLS connection, got err: %v", err)
		}
	}
}

const caCert = `
-----BEGIN CERTIFICATE-----
MIICxjCCAa6gAwIBAgIJANWuMWMQSxvdMA0GCSqGSIb3DQEBBQUAMBMxETAPBgNV
BAMTCE15VGVzdENBMB4XDTE0MDEyNzE5NTIyMloXDTI0MDEyNTE5NTIyMlowEzER
MA8GA1UEAxMITXlUZXN0Q0EwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIB
AQDBsIrkW4ob9Z/gzR2/Maa2stbutry6/vvz8eiJwIKIbaHGwqtFOUGiWeKw7H76
IH3SjTAhNQY2hoKPyH41D36sDJkYBRyHFJTK/6ffvOhpyLnuXJAnoS62eKPSNUAx
5i/lkHj42ESutYAH9qbHCI/gBm9G4WmhGAyA16xzC1n07JObl6KFoY1PqHKl823z
mvF47I24DzemEfjdwC9nAAX/pGYOg9FA9nQv7NnhlsJMxueCx55RNU1ADRoqsbfE
T0CQTOT4ryugGrUp9J4Cwen6YbXZrS6+Kff5SQCAns0Qu8/bwj0DKkuBGLF+Mnwe
mq9bMzyZPUrPM3Gu48ao8YAfAgMBAAGjHTAbMAwGA1UdEwQFMAMBAf8wCwYDVR0P
BAQDAgEGMA0GCSqGSIb3DQEBBQUAA4IBAQCBwXGblRxIEOlEP6ANZ1C8AHWyG8lR
CQduFclc0tmyCCz5fnyLK0aGu9LhXXe6/HSKqgs4mJqeqYOojdjkfOme/YdwDzjK
WIf0kRYQHcB6NeyEZwW8C7subTP1Xw6zbAmjvQrtCGvRM+fi3/cs1sSSkd/EoRk4
7GM9qQl/JIIoCOGncninf2NQm5YSpbit6/mOQD7EhqXsw+bX+IRh3DHC1Apv/PoA
HlDNeM4vjWaBxsmvRSndrIvew1czboFM18oRSSIqAkU7dKZ0SbC11grzmNxMG2aD
f9y8FIG6RK/SEaOZuc+uBGXx7tj7dczpE/2puqYcaVGwcv4kkrC/ZuRm
-----END CERTIFICATE-----
`

const serverCert = `
-----BEGIN CERTIFICATE-----
MIIC8zCCAdugAwIBAgIBATANBgkqhkiG9w0BAQUFADATMREwDwYDVQQDEwhNeVRl
c3RDQTAeFw0xNDAxMjcxOTUyMjNaFw0yNDAxMjUxOTUyMjNaMCUxEjAQBgNVBAMT
CTEyNy4wLjAuMTEPMA0GA1UEChMGc2VydmVyMIIBIjANBgkqhkiG9w0BAQEFAAOC
AQ8AMIIBCgKCAQEAxYAKbeGyg0gP0xwVsZsufzk/SUCtD44Gp3lQYQ9QumQ1IVZu
PmZWwPWrzI93a1Abruz6ZhXaB3jcL5QPAy1N44IiFgVN45CZXBsqkpJe/abzRFOV
DRnHxattPDHdgwML5d3nURKGUM/7+ACj5E4pZEDlM3RIjIKVd+doJsL7n6myO8FE
tIpt4vTz1MFp3F+ntPnHU3BZ/VZ1UjSlFWnCjT0CR0tnXsPmlIaC98HThS8x5zNB
fvvSN+Zln8RWdNLnEVHVdqYtOQ828QbCx8s1HfClGgaVoSDrzz+qQgtZFO4wW264
2CWkNd8DSJUJ/HlPNXmbXsrRMgvGaL7YUz2yRQIDAQABo0AwPjAJBgNVHRMEAjAA
MAsGA1UdDwQEAwIFIDATBgNVHSUEDDAKBggrBgEFBQcDATAPBgNVHREECDAGhwR/
AAABMA0GCSqGSIb3DQEBBQUAA4IBAQAE2g+wAFf9Xg5svcnb7+mfseYV16k9l5WG
onrmR3FLsbTxfbr4PZJMHrswPbi2NRk0+ETPUpcv1RP7pUB7wSEvuS1NPGcU92iP
58ycP3dYtLzmuu6BkgToZqwsCU8fC2zM0wt3+ifzPpDMffWWOioVuA3zdM9WPQYz
+Ofajd0XaZwFZS8uTI5WXgObz7Xqfmln4tF3Sq1CTyuJ44qK4p83XOKFq+L04aD0
d0c8w3YQNUENny/vMP9mDu3FQ3SnDz2GKl1LSjGe2TUnkoMkDfdk4wSzndTz/ecb
QiCPKijwVPWNOWV3NDE2edMxDPxDoKoEm5F4UGfGjxSRnYCIoZLh
-----END CERTIFICATE-----
`

const serverKey = `
-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEAxYAKbeGyg0gP0xwVsZsufzk/SUCtD44Gp3lQYQ9QumQ1IVZu
PmZWwPWrzI93a1Abruz6ZhXaB3jcL5QPAy1N44IiFgVN45CZXBsqkpJe/abzRFOV
DRnHxattPDHdgwML5d3nURKGUM/7+ACj5E4pZEDlM3RIjIKVd+doJsL7n6myO8FE
tIpt4vTz1MFp3F+ntPnHU3BZ/VZ1UjSlFWnCjT0CR0tnXsPmlIaC98HThS8x5zNB
fvvSN+Zln8RWdNLnEVHVdqYtOQ828QbCx8s1HfClGgaVoSDrzz+qQgtZFO4wW264
2CWkNd8DSJUJ/HlPNXmbXsrRMgvGaL7YUz2yRQIDAQABAoIBAGsyEvcPAGg3DbfE
z5WFp9gPx2TIAOanbL8rnlAAEw4H47qDgfTGcSHsdeHioKuTYGMyZrpP8/YISGJe
l0NfLJ5mfH+9Q0hXrJWMfS/u2DYOjo0wXH8u1fpZEEISwqsgVS3fonSjfFmSea1j
E5GQRvEONBkYbWQuYFgjNqmLPS2r5lKbWCQvc1MB/vvVBwOTiO0ON7m/EkM5RKt9
cDT5ZhhVjBpdmd9HpVbKTdBj8Q0l5/ZHZUEgZA6FDZEwYxTd9l87Z4YT+5SR0z9t
k8/Z0CHd3x3Rv891t7m66ZJkaOda8NC65/432MQEQwJltmrKnc22dS8yI26rrmpp
g3tcbSUCgYEA5nMXdQKS4vF+Kp10l/HqvGz2sU8qQaWYZQIg7Th3QJPo6N52po/s
nn3UF0P5mT1laeZ5ZQJKx4gnmuPnIZ2ZtJQDyFhIbRPcZ+2hSNSuLYVcrumOC3EP
3OZyFtFE1THO73aFe5e1jEdtoOne3Bds/Hq6NF45fkVdL+M9e8pfXIsCgYEA22W8
zGjbWyrFOYvKknMQVtHnMx8BJEtsvWRknP6CWAv/8WyeZpE128Pve1m441AQnopS
CuOF5wFK0iUXBFbS3Pe1/1j3em6yfVznuUHqJ7Qc+dNzxVvkTK8jGB6x+vm+M9Hg
muHUM726IUxckoSNXbPNAVPIZab1NdSxam7F9m8CgYEAx55QZmIJXJ41XLKxqWC7
peZ5NpPNlbncrTpPzUzJN94ntXfmrVckbxGt401VayEctMQYyZ9XqUlOjUP3FU5Q
M3S3Zhba/eljVX8o406fZf0MkNLs4QpZ5E6V6x/xEP+pMhKng6yhbVb+JpIPIvUD
yhyBKRWplbB+DRo5Sv685gsCgYA7l5m9h+m1DJv/cnn2Z2yTuHXtC8namuYRV1iA
0ByFX9UINXGc+GpBpCnDPm6ax5+MAJQiQwSW52H0TIDA+/hQbrQvhHHL/o9av8Zt
Kns4h5KrRQUYIUqUjamhnozHV9iS6LnyN87Usv8AlmY6oehoADN53dD702qdUYVT
HH2G3wKBgCdvqyw78FR/n8cUWesTPnxx5HCeWJ1J+2BESnUnPmKZ71CV1H7uweja
vPUxuuuGLKfNx84OKCfRDbtOgMOeyh9T1RmXry6Srz/7/udjlF0qmFiRXfBNAgoR
tNb0+Ri/vY0AHrQ7UnCbl12qPVaqhEXLr+kCGNEPFqpMJPPEeMK0
-----END RSA PRIVATE KEY-----
`

const clientCert = `
-----BEGIN CERTIFICATE-----
MIIC4jCCAcqgAwIBAgIBAjANBgkqhkiG9w0BAQUFADATMREwDwYDVQQDEwhNeVRl
c3RDQTAeFw0xNDAxMjcxOTUyMjNaFw0yNDAxMjUxOTUyMjNaMCUxEjAQBgNVBAMT
CTEyNy4wLjAuMTEPMA0GA1UEChMGY2xpZW50MIIBIjANBgkqhkiG9w0BAQEFAAOC
AQ8AMIIBCgKCAQEAu7LMqd+agoH168Bsi0WJ36ulYqDypq+GZPF7uWOo2pE0raKH
B++31/hjnkt6yC5kLKVZZ0EfolBa9q4Cy6swfGaEMafy44ZCRneLnt1azL1N6Kfz
+U0KsOqyQDoMxYJG1gVTEZN19/U/ew2eazcxKyERI3oGCQ4SbpkxBTbfxtAFk49e
xIB3obsuMVUrmtXE4FkUkvG7NgpPUgrhp0yxYpj9zruZGzGGT1zNhcarbQ/4i7It
ZMbnv6pqQWtYDgnGX2TDRcEiXGeO+KrzhfpTRLfO3K4np8e8cmTyXM+4lMlWUgma
KrRdu1QXozGqRs47u2prGKGdSQWITpqNVCY8fQIDAQABoy8wLTAJBgNVHRMEAjAA
MAsGA1UdDwQEAwIHgDATBgNVHSUEDDAKBggrBgEFBQcDAjANBgkqhkiG9w0BAQUF
AAOCAQEAhCuBCLznPc4O96hT3P8Fx19L3ltrWbc/pWrx8JjxUaGk8kNmjMjY+/Mt
JBbjUBx2kJwaY0EHMAfw7D1f1wcCeNycx/0dyb0E6xzhmPw5fY15GGNg8rzWwqSY
+i/1iqU0IRkmRHV7XCF+trd2H0Ec+V1Fd/61E2ccJfOL5aSAyWbMCUtWxS3QMnqH
FBfKdVEiY9WNht5hnvsXQBRaNhowJ6Cwa7/1/LZjmhcXiJ0xrc1Hggj3cvS+4vll
Ew+20a0tPKjD/v/2oSQL+qkeYKV4fhCGkaBHCpPlSJrqorb7B6NmPy3nS26ETKE/
o2UCfZc5g2MU1ENa31kT1iuhKZapsA==
-----END CERTIFICATE-----
`

const clientKey = `
-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEAu7LMqd+agoH168Bsi0WJ36ulYqDypq+GZPF7uWOo2pE0raKH
B++31/hjnkt6yC5kLKVZZ0EfolBa9q4Cy6swfGaEMafy44ZCRneLnt1azL1N6Kfz
+U0KsOqyQDoMxYJG1gVTEZN19/U/ew2eazcxKyERI3oGCQ4SbpkxBTbfxtAFk49e
xIB3obsuMVUrmtXE4FkUkvG7NgpPUgrhp0yxYpj9zruZGzGGT1zNhcarbQ/4i7It
ZMbnv6pqQWtYDgnGX2TDRcEiXGeO+KrzhfpTRLfO3K4np8e8cmTyXM+4lMlWUgma
KrRdu1QXozGqRs47u2prGKGdSQWITpqNVCY8fQIDAQABAoIBAGSEn3hFyEAmCyYi
2b5IEksXaC2GlgxQKb/7Vs/0oCPU6YonZPsKFMFzQx4tu+ZiecEzF8rlJGTPdbdv
fw3FcuTcHeVd1QSmDO4h7UK5tnu40XVMJKsY6CXQun8M13QajYbmORNLjjypOULU
C0fNueYoAj6mhX7p61MRdSAev/5+0+bVQQG/tSVDQzdngvKpaCunOphiB2VW2Aa0
7aYPOFCoPB2uo0DwUmBB0yfx9x4hXX9ovQI0YFou7bq6iYJ0vlZBvYQ9YrVdxjKL
avcz1N5xM3WFAkZJSVT/Ho5+uTbZx4RrJ8b5T+t2spOKmXyAjwS2rL/XMAh8YRZ1
u44duoECgYEA4jpK2qshgQ0t49rjVHEDKX5x7ElEZefl0rHZ/2X/uHUDKpKj2fTq
3TQzHquiQ4Aof7OEB9UE3DGrtpvo/j/PYxL5Luu5VR4AIEJm+CA8GYuE96+uIL0Z
M2r3Lux6Bp30Z47Eit2KiY4fhrWs59WB3NHHoFxgzHSVbnuA02gcX2ECgYEA1GZw
iXIVYaK07ED+q/0ObyS5hD1cMhJ7ifSN9BxuG0qUpSigbkTGj09fUDS4Fqsz9dvz
F0P93fZvyia242TIfDUwJEsDQCgHk7SGa4Rx/p/3x/obIEERk7K76Hdg93U5NXhV
NvczvgL0HYxnb+qtumwMgGPzncB4lGcTnRyOfp0CgYBTIsDnYwRI/KLknUf1fCKB
WSpcfwBXwsS+jQVjygQTsUyclI8KResZp1kx6DkVPT+kzj+y8SF8GfTUgq844BJC
gnJ4P8A3+3JoaH6WqKHtcUxICZOgDF36e1CjOdwOGnX6qIipz4hdzJDhXFpSSDAV
CjKmR8x61k0j8NcC2buzgQKBgFr7eo9VwBTvpoJhIPY5UvqHB7S+uAR26FZi3H/J
wdyM6PmKWpaBfXCb9l8cBhMnyP0y94FqzY9L5fz48nSbkkmqWvHg9AaCXySFOuNJ
e68vhOszlnUNimLzOAzPPkkh/JyL7Cy8XXyyNTGHGDPXmg12BTDmH8/eR4iCUuOE
/QD9AoGBALQ/SkvfO3D5+k9e/aTHRuMJ0+PWdLUMTZ39oJQxUx+qj7/xpjDvWTBn
eDmF/wjnIAg+020oXyBYo6plEZfDz3EYJQZ+3kLLEU+O/A7VxCakPYPwCr7N/InL
Ccg/TVSIXxw/6uJnojoAjMIEU45NoP6RMp0mWYYb2OlteEv08Ovp
-----END RSA PRIVATE KEY-----
`
