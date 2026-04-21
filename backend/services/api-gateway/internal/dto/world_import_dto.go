package dto

type CreateCountryRequest struct {
	ISO                       string  `json:"iso"                         binding:"required,iso3166_1_alpha2"`
	LocalName                 string  `json:"local_name"                  binding:"required,min=1,max=255"`
	IntlName                  string  `json:"intl_name"                   binding:"required,min=1,max=255"`
	FlythroughPermissionPrice float64 `json:"flythrough_permission_price" binding:"required,gte=0"`
	LandPermissionPrice       float64 `json:"land_permission_price"       binding:"required,gte=0"`
	CorpTaxRate               float64 `json:"corp_tax_rate"               binding:"required,gte=0,lte=100"`
	VatRate                   float64 `json:"vat_rate"                    binding:"required,gte=0,lte=100"`
	AircraftTailCode          string  `json:"aircraft_tail_code"          binding:"required,min=1,max=10,alphanum"`
	WikipediaLink             string  `json:"wikipedia_link"              binding:"required,url"`
}

type CreateRegionRequest struct {
	ID            string  `json:"id"                         binding:"required,uuid"`
	LocalCode     string  `json:"local_code"                 binding:"required,min=1,max=20"`
	LocalName     string  `json:"local_name"                 binding:"required,min=1,max=255"`
	IntlName      string  `json:"intl_name"                  binding:"required,min=1,max=255"`
	CountryID     string  `json:"country_id"                 binding:"required,uuid"`
	Population    float64 `json:"population"                 binding:"required,gte=0"`
	GDPPerCapita  float64 `json:"gdp_per_capita"             binding:"required,gte=0"`
	TourismScore  float64 `json:"tourism_score"              binding:"required,gte=0,lte=1"`
	BusinessScore float64 `json:"business_score"             binding:"required,gte=0,lte=1"`
	WikipediaLink string  `json:"wikipedia_link"             binding:"required,url"`
}

type CreateRegionLinkRequest struct {
	ID       string  `json:"id"                         binding:"required,uuid"`
	RegionA  string  `json:"region_a"                   binding:"required,uuid"`
	RegionB  string  `json:"region_b"                   binding:"required,uuid"`
	Diaspora float64 `json:"diaspora"                   binding:"required,gte=0,lte=1"`
	Business float64 `json:"business"                   binding:"required,gte=0,lte=1"`
	Tourism  float64 `json:"tourism"                    binding:"required,gte=0,lte=1"`
}

type CreateAirportRequest struct {
	ID                    string  `json:"id"                         binding:"required,uuid"`
	IcaoCode              string  `json:"icao_code"                  binding:"required,len=4"`
	IataCode              string  `json:"iata_code"                  binding:"required,len=3"`
	LocalName             string  `json:"local_name"                 binding:"required,min=1,max=255"`
	IntlName              string  `json:"intl_name"                  binding:"required,min=1,max=255"`
	Timezone              string  `json:"timezone"                   binding:"required,timezone"`
	CountryID             string  `json:"country_id"                 binding:"required,uuid"`
	RegionID              string  `json:"region_id"                  binding:"required,uuid"`
	Municipality          string  `json:"municipality"               binding:"required,min=1,max=255"`
	Continent             string  `json:"continent"                  binding:"required,oneof=AF AN AS EU NA OC SA"`
	ElevationFt           float64 `json:"elevation_ft"               binding:"required,gte=-500"`
	MaxRunwayLengthM      float64 `json:"max_runway_length_m"        binding:"required,gte=0"`
	WorksAtNight          bool    `json:"works_at_night"             binding:"required"`
	MaxRunwayUsesPerDay   float64 `json:"max_runway_uses_per_day"    binding:"required,gte=0"`
	TurnaroundPointPrice  float64 `json:"turnaround_point_price"     binding:"required,gte=0"`
	MaintenancePointPrice float64 `json:"maintenance_point_price"    binding:"required,gte=0"`
	RunwayFee             float64 `json:"runway_fee"                 binding:"required,gte=0"`
	GateFee               float64 `json:"gate_fee"                   binding:"required,gte=0"`
	StandFee              float64 `json:"stand_fee"                  binding:"required,gte=0"`
	FuelPriceMultiplier   float64 `json:"fuel_price_multiplier"      binding:"required,gte=0"`
	HomeLink              string  `json:"home_link"                  binding:"required,url"`
	WikipediaLink         string  `json:"wikipedia_link"             binding:"required,url"`
	Geog                  string  `json:"geog"                       binding:"required"`
	Geom                  string  `json:"geom"                       binding:"required"`
}
