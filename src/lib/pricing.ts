import { addDays } from "./format";

export type StayInput = {
  operationDate: Date;
  recoveryNights: number;
};

export type Stay = {
  arrivalDate: Date;
  departureDate: Date;
  nights: number;
};

/**
 * The patient arrives the day before the operation and leaves once the
 * recovery period is over: nights = 1 (eve of surgery) + recovery nights.
 */
export function computeStay({ operationDate, recoveryNights }: StayInput): Stay {
  const arrivalDate = addDays(operationDate, -1);
  const departureDate = addDays(operationDate, recoveryNights);
  return { arrivalDate, departureDate, nights: recoveryNights + 1 };
}

export type QuoteInput = {
  operationPrice: number;
  withTransport: boolean;
  companionsCount: number;
  transportPricePerPerson: number;
  accommodation: { pricePerNight: number } | null;
  nights: number;
};

export type Quote = {
  withTransport: boolean;
  operationPrice: number;
  transportPrice: number;
  accommodationPrice: number;
  totalAmount: number;
};

/** Accommodation always includes the airport transfer (full care package). */
export function computeQuote(input: QuoteInput): Quote {
  const withTransport = input.withTransport || input.accommodation !== null;
  const travellers = 1 + Math.max(0, input.companionsCount);
  const transportPrice = withTransport ? input.transportPricePerPerson * travellers : 0;
  const accommodationPrice = input.accommodation ? input.accommodation.pricePerNight * input.nights : 0;
  return {
    withTransport,
    operationPrice: input.operationPrice,
    transportPrice,
    accommodationPrice,
    totalAmount: input.operationPrice + transportPrice + accommodationPrice,
  };
}

/** True when [aStart, aEnd) and [bStart, bEnd) overlap. */
export function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}
