-- +goose Up
CREATE TABLE game_state (
    id INTEGER PRIMARY KEY,
    last_processed_15_min TIMESTAMP,
    last_processed_1_hour TIMESTAMP
);

-- +goose Down
DROP TABLE IF EXISTS game_state;