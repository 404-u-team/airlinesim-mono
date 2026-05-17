package customerrors

import (
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

var ErrInternal = status.Error(codes.Internal, "internal error")

var ErrUserWithSuchEmailExists = status.Error(codes.AlreadyExists, "email taken")
var ErrUserWithSuchNicknameExists = status.Error(codes.AlreadyExists, "nickname taken")
var ErrUserNotFound = status.Error(codes.NotFound, "user is not found")
var ErrUserUnauthenticated = status.Error(codes.Unauthenticated, "user is unauthenticated")

var ErrISOConflict = status.Error(codes.AlreadyExists, "iso taken")

var ErrLocalCodeConflict = status.Error(codes.AlreadyExists, "local code taken")
var ErrNoSuchCountry = status.Error(codes.InvalidArgument, "country with such id not found")

var ErrRegionLinkConflict = status.Error(codes.AlreadyExists, "region link with such combination of regions exists")
var ErrNoSuchRegion = status.Error(codes.InvalidArgument, "no such region exists")

var ErrCountryNotFound = status.Error(codes.NotFound, "country is not found")
var ErrRegionNotFound = status.Error(codes.NotFound, "region is not found")
var ErrRegionLinkNotFound = status.Error(codes.NotFound, "region link is not found")
var ErrAirportNotFound = status.Error(codes.NotFound, "airport is not found")

var ErrCountryHasDependencies = status.Error(codes.FailedPrecondition, "country has dependent regions")
var ErrRegionHasDependencies = status.Error(codes.FailedPrecondition, "region has dependent relations")

var ErrAirportIcaoConflict = status.Error(codes.AlreadyExists, "icao taken")
var ErrAirportIataConflict = status.Error(codes.AlreadyExists, "iata taken")
