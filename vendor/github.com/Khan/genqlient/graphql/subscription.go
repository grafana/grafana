package graphql

import (
	"fmt"
	"reflect"
	"sync"
)

// map of subscription ID to subscription
type subscriptionMap struct {
	map_ map[string]subscription
	sync.RWMutex
}

type subscription struct {
	interfaceChan       interface{}
	forwardDataFunc     ForwardDataFunction
	id                  string
	hasBeenUnsubscribed bool
}

func (s *subscriptionMap) Create(subscriptionID string, interfaceChan interface{}, forwardDataFunc ForwardDataFunction) {
	s.Lock()
	defer s.Unlock()
	s.map_[subscriptionID] = subscription{
		id:                  subscriptionID,
		interfaceChan:       interfaceChan,
		forwardDataFunc:     forwardDataFunc,
		hasBeenUnsubscribed: false,
	}
}

func (s *subscriptionMap) Read(subscriptionID string) (sub subscription, success bool) {
	s.RLock()
	defer s.RUnlock()
	sub, success = s.map_[subscriptionID]
	return sub, success
}

func (s *subscriptionMap) Unsubscribe(subscriptionID string) error {
	s.Lock()
	defer s.Unlock()
	unsub, success := s.map_[subscriptionID]
	if !success {
		return fmt.Errorf("tried to unsubscribe from unknown subscription with ID '%s'", subscriptionID)
	}
	unsub.hasBeenUnsubscribed = true
	s.map_[subscriptionID] = unsub
	reflect.ValueOf(s.map_[subscriptionID].interfaceChan).Close()
	return nil
}

func (s *subscriptionMap) GetAllIDs() (subscriptionIDs []string) {
	s.RLock()
	defer s.RUnlock()
	for subID := range s.map_ {
		subscriptionIDs = append(subscriptionIDs, subID)
	}
	return subscriptionIDs
}

func (s *subscriptionMap) Delete(subscriptionID string) {
	s.Lock()
	defer s.Unlock()
	delete(s.map_, subscriptionID)
}
