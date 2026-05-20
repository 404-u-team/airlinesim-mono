import { type AirlineSimEvents, airlineSimEventValidators } from "./contracts";
import { createEventBus } from "./core";

export const airlineSimEventBus = createEventBus<AirlineSimEvents>(airlineSimEventValidators);
