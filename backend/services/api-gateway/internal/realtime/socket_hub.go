package realtime

import (
	"fmt"
	"net/http"
	"sync"

	socketio "github.com/googollee/go-socket.io"
)

type Hub interface {
	Handler() http.Handler
	BroadcastFuelPriceChanged(event FuelPriceChangedEvent) error
	Close()
}

type SocketHub struct {
	server *socketio.Server
	once   sync.Once
}

func NewSocketHub() *SocketHub {
	server := socketio.NewServer(nil)
	server.OnConnect("/", func(conn socketio.Conn) error {
		return nil
	})

	return &SocketHub{server: server}
}

func (h *SocketHub) Handler() http.Handler {
	return h.server
}

func (h *SocketHub) BroadcastFuelPriceChanged(event FuelPriceChangedEvent) error {
	if ok := h.server.BroadcastToNamespace("/", FuelPriceChangedEventName, event); !ok {
		return fmt.Errorf("failed to broadcast fuel price changed event")
	}

	return nil
}

func (h *SocketHub) Close() {
	h.once.Do(func() {
		_ = h.server.Close()
	})
}
