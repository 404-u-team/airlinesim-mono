package dto

type CreateCountryRequest struct {
	ISO                       string
	LocalName                 string
	IntlName                  string
	FlythroughPermissionPrice float64
	LandPermissionPrice       float64
	CorpTaxRate               float64
	VatRate                   float64
	AircraftTailCode          string
	WikipediaLink             string
}
