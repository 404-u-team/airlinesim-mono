# Backend

## Socket.IO Routing

The API gateway exposes Socket.IO on the same host as HTTP.

- Endpoint: `/socket.io/*any`
- Transport: Socket.IO client, not raw WebSocket
- Event: `fuel_price_changed`

Payload:

```json
{
	"price": 101.25,
	"recorded_at": "2026-05-13T12:00:00Z"
}
```

The gateway listens to the Kafka topic `operations_fuel_price_changed` and broadcasts the event to all connected Socket.IO clients.