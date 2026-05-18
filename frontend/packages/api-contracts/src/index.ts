import { z } from "zod";

export const airlineSchema = z.object({
  code: z.string().min(2).max(3),
  id: z.uuid(),
  name: z.string().min(1),
});

export const airportSchema = z.object({
  city: z.string().min(1),
  countryCode: z.string().min(2).max(2),
  iata: z.string().min(3).max(3),
  id: z.uuid(),
  name: z.string().min(1),
});

export const flightStatusSchema = z.enum(["boarding", "cancelled", "delayed", "scheduled"]);

export const flightSchema = z.object({
  arrivalAirport: airportSchema,
  departureAirport: airportSchema,
  flightNumber: z.string().min(1),
  id: z.uuid(),
  status: flightStatusSchema,
});

export type Airline = z.infer<typeof airlineSchema>;
export type Airport = z.infer<typeof airportSchema>;
export type Flight = z.infer<typeof flightSchema>;
export type FlightStatus = z.infer<typeof flightStatusSchema>;
