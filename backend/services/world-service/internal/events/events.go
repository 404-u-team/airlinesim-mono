package events

type ImportDataReceivedEvent struct {
	ImportType string `json:"import_type"`
	Payload    []byte `json:"payload"`
	TotalCount int    `json:"total_count"`
}

type ImportDataStatusEvent struct {
	TotalCount     int `json:"total_count"`
	ProcessedCount int `json:"processed_count"`
	FailedCount    int `json:"failed_count"`
}
