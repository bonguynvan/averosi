package store

import (
	"errors"

	"github.com/jackc/pgx/v5/pgconn"
)

// isUndefinedTable reports Postgres error 42P01 (relation does not exist).
func isUndefinedTable(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "42P01"
}
