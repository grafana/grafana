package kuberesolver

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/fsnotify/fsnotify"
)

const (
	serviceAccountToken     = "/var/run/secrets/kubernetes.io/serviceaccount/token"
	serviceAccountCACert    = "/var/run/secrets/kubernetes.io/serviceaccount/ca.crt"
	kubernetesNamespaceFile = "/var/run/secrets/kubernetes.io/serviceaccount/namespace"
	defaultNamespace        = "default"
)

// K8sClient is minimal kubernetes client interface
type K8sClient interface {
	Do(req *http.Request) (*http.Response, error)
	GetRequest(url string) (*http.Request, error)
	Host() string
}

type k8sClient struct {
	host       string
	token      string
	tokenLck   sync.RWMutex
	httpClient *http.Client
}

func (kc *k8sClient) GetRequest(url string) (*http.Request, error) {
	if !strings.HasPrefix(url, kc.host) {
		url = fmt.Sprintf("%s/%s", kc.host, url)
	}
	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, err
	}
	kc.tokenLck.RLock()
	defer kc.tokenLck.RUnlock()
	if len(kc.token) > 0 {
		req.Header.Set("Authorization", "Bearer "+kc.token)
	}
	return req, nil
}

func (kc *k8sClient) Do(req *http.Request) (*http.Response, error) {
	return kc.httpClient.Do(req)
}

func (kc *k8sClient) Host() string {
	return kc.host
}

func (kc *k8sClient) setToken(token string) {
	kc.tokenLck.Lock()
	defer kc.tokenLck.Unlock()
	kc.token = token
}

// NewInClusterK8sClient creates K8sClient if it is inside Kubernetes
func NewInClusterK8sClient() (K8sClient, error) {
	host, port := os.Getenv("KUBERNETES_SERVICE_HOST"), os.Getenv("KUBERNETES_SERVICE_PORT")
	if len(host) == 0 || len(port) == 0 {
		return nil, fmt.Errorf("unable to load in-cluster configuration, KUBERNETES_SERVICE_HOST and KUBERNETES_SERVICE_PORT must be defined")
	}
	token, err := os.ReadFile(serviceAccountToken)
	if err != nil {
		return nil, err
	}
	ca, err := os.ReadFile(serviceAccountCACert)
	if err != nil {
		return nil, err
	}
	certPool := x509.NewCertPool()
	certPool.AppendCertsFromPEM(ca)
	transport := &http.Transport{TLSClientConfig: &tls.Config{
		MinVersion: tls.VersionTLS10,
		RootCAs:    certPool,
	}}
	httpClient := &http.Client{Transport: transport, Timeout: time.Nanosecond * 0}

	client := &k8sClient{
		host:       "https://" + net.JoinHostPort(host, port),
		token:      string(token),
		httpClient: httpClient,
	}

	// Create a new file watcher to listen for new Service Account tokens
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		return nil, err
	}

	go func() {
		for {
			select {
			case event, ok := <-watcher.Events:
				if !ok {
					return
				}
				// k8s configmaps uses symlinks, we need this workaround.
				// original configmap file is removed
				if event.Op.Has(fsnotify.Remove) || event.Op.Has(fsnotify.Chmod) {
					// remove watcher since the file is removed
					watcher.Remove(event.Name)
					// add a new watcher pointing to the new symlink/file
					watcher.Add(serviceAccountToken)
					token, err := os.ReadFile(serviceAccountToken)
					if err == nil {
						client.setToken(string(token))
					}
				}
				if event.Has(fsnotify.Write) {
					token, err := os.ReadFile(serviceAccountToken)
					if err == nil {
						client.setToken(string(token))
					}
				}
			case _, ok := <-watcher.Errors:
				if !ok {
					return
				}
			}
		}
	}()

	err = watcher.Add(serviceAccountToken)
	if err != nil {
		return nil, err
	}

	return client, nil
}

// NewInsecureK8sClient creates an insecure k8s client which is suitable
// to connect kubernetes api behind proxy
func NewInsecureK8sClient(apiURL string) K8sClient {
	return &k8sClient{
		host:       apiURL,
		httpClient: http.DefaultClient,
	}
}

func getEndpointSliceList(client K8sClient, namespace, targetName string) (EndpointSliceList, error) {
	u, err := url.Parse(fmt.Sprintf("%s/apis/discovery.k8s.io/v1/namespaces/%s/endpointslices?labelSelector=kubernetes.io/service-name=%s",
		client.Host(), namespace, targetName))
	if err != nil {
		return EndpointSliceList{}, err
	}
	req, err := client.GetRequest(u.String())
	if err != nil {
		return EndpointSliceList{}, err
	}
	resp, err := client.Do(req)
	if err != nil {
		return EndpointSliceList{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return EndpointSliceList{}, fmt.Errorf("invalid response code %d for service %s in namespace %s", resp.StatusCode, targetName, namespace)
	}
	result := EndpointSliceList{}
	err = json.NewDecoder(resp.Body).Decode(&result)
	return result, err
}

func watchEndpointSlice(ctx context.Context, client K8sClient, namespace, targetName string) (watchInterface, error) {
	u, err := url.Parse(fmt.Sprintf("%s/apis/discovery.k8s.io/v1/watch/namespaces/%s/endpointslices?labelSelector=kubernetes.io/service-name=%s",
		client.Host(), namespace, targetName))
	if err != nil {
		return nil, err
	}
	req, err := client.GetRequest(u.String())
	if err != nil {
		return nil, err
	}
	req = req.WithContext(ctx)
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		defer resp.Body.Close()
		return nil, fmt.Errorf("invalid response code %d for service %s in namespace %s", resp.StatusCode, targetName, namespace)
	}
	return newStreamWatcher(resp.Body), nil
}

func getCurrentNamespaceOrDefault() string {
	ns, err := os.ReadFile(kubernetesNamespaceFile)
	if err != nil {
		return defaultNamespace
	}
	return string(ns)
}
