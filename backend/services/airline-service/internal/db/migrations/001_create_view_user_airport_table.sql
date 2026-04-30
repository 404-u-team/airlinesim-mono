-- +goose Up
CREATE TABLE user_view (
    id UUID PRIMARY KEY
);

CREATE TABLE airport_view (
    id UUID PRIMARY KEY
);


-- +goose Down
DROP TABLE IF EXISTS user_view;

DROP TABLE IF EXISTS airport_view;