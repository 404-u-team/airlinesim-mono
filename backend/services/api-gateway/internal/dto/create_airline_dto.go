package dto

// CreateAirlineRequestDTO used for binding and Swagger docs — owner_id is taken from token
type CreateAirlineRequestDTO struct {
	StartingAirportId string `json:"starting_airport_id" example:"11111111-1111-1111-1111-111111111111"`
	Name              string `json:"name" example:"My Airline"`
	IataCode          string `json:"iata_code" example:"AA"`
	IcaoCode          string `json:"icao_code" example:"AAL"`
}
