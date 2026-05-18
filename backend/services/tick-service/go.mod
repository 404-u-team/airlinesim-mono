module github.com/404-u-team/airlinesim-mono/backend/tick-service

go 1.26.2

require (
	github.com/jackc/pgx/v5 v5.9.1
	github.com/lpernett/godotenv v0.0.0-20230527005122-0de1d4c5ef5e
	github.com/pressly/goose v2.7.0+incompatible
	github.com/twmb/franz-go v1.20.7
)

replace github.com/404-u-team/airlinesim-mono/backend/shared/customerrors => ../../shared/customerrors

require (
	github.com/jackc/pgpassfile v1.0.0 // indirect
	github.com/jackc/pgservicefile v0.0.0-20240606120523-5a60cdf6a761 // indirect
	github.com/jackc/puddle/v2 v2.2.2 // indirect
	github.com/klauspost/compress v1.18.4 // indirect
	github.com/pierrec/lz4/v4 v4.1.25 // indirect
	github.com/pkg/errors v0.9.1 // indirect
	github.com/twmb/franz-go/pkg/kmsg v1.12.0 // indirect
	golang.org/x/sync v0.19.0 // indirect
	golang.org/x/text v0.33.0 // indirect
)
