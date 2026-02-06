/*
 *
 * Copyright 2025 gRPC authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

package xdsdepmgr

import "google.golang.org/grpc/internal/xds/xdsclient/xdsresource"

type listenerWatcher struct {
	resourceName string
	cancel       func()
	depMgr       *DependencyManager
}

func newListenerWatcher(resourceName string, depMgr *DependencyManager) *listenerWatcher {
	lw := &listenerWatcher{resourceName: resourceName, depMgr: depMgr}
	lw.cancel = xdsresource.WatchListener(depMgr.xdsClient, resourceName, lw)
	return lw
}

func (l *listenerWatcher) ResourceChanged(update *xdsresource.ListenerUpdate, onDone func()) {
	l.depMgr.onListenerResourceUpdate(update, onDone)
}

func (l *listenerWatcher) ResourceError(err error, onDone func()) {
	l.depMgr.onListenerResourceError(err, onDone)
}

func (l *listenerWatcher) AmbientError(err error, onDone func()) {
	l.depMgr.onListenerResourceAmbientError(err, onDone)
}

func (l *listenerWatcher) stop() {
	l.cancel()
	if l.depMgr.logger.V(2) {
		l.depMgr.logger.Infof("Canceling watch on Listener resource %q", l.resourceName)
	}
}

type routeConfigWatcher struct {
	resourceName string
	cancel       func()
	depMgr       *DependencyManager
}

func newRouteConfigWatcher(resourceName string, depMgr *DependencyManager) *routeConfigWatcher {
	rw := &routeConfigWatcher{resourceName: resourceName, depMgr: depMgr}
	rw.cancel = xdsresource.WatchRouteConfig(depMgr.xdsClient, resourceName, rw)
	return rw
}

func (r *routeConfigWatcher) ResourceChanged(u *xdsresource.RouteConfigUpdate, onDone func()) {
	r.depMgr.onRouteConfigResourceUpdate(r.resourceName, u, onDone)
}

func (r *routeConfigWatcher) ResourceError(err error, onDone func()) {
	r.depMgr.onRouteConfigResourceError(r.resourceName, err, onDone)
}

func (r *routeConfigWatcher) AmbientError(err error, onDone func()) {
	r.depMgr.onRouteConfigResourceAmbientError(r.resourceName, err, onDone)
}

func (r *routeConfigWatcher) stop() {
	r.cancel()
	if r.depMgr.logger.V(2) {
		r.depMgr.logger.Infof("Canceling watch on RouteConfiguration resource %q", r.resourceName)
	}
}
