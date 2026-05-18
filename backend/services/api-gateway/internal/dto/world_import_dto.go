package dto

type CreateCountryRequest struct {
	ISO                       string  `json:"iso"`
	LocalName                 string  `json:"local_name"`
	IntlName                  string  `json:"intl_name"`
	FlythroughPermissionPrice float64 `json:"flythrough_permission_price"`
	LandPermissionPrice       float64 `json:"land_permission_price"`
	CorpTaxRate               float64 `json:"corp_tax_rate"`
	VatRate                   float64 `json:"vat_rate"`
	AircraftTailCode          string  `json:"aircraft_tail_code"`
	WikipediaLink             string  `json:"wikipedia_link"`
}

type CreateAirportRequest struct {
	IcaoCode  string
	IataCode  string
	LocalName string
	IntlName  string
	Timezone  string
}
