import { readDocument, writeDocument } from "../../db/database";

export type AircraftImageMap = Record<string, AircraftVisualImage>;

// A resolved aircraft visual image. Stored per ICAO code in the BFF SQLite
// document store under the "aircraft-images" key. This overlay lets the BFF
// attach images to aircraft types at serve time without any backend schema
// change (the game backend has no aircraft-type update endpoint).
export type AircraftVisualImage = {
  commonsFile?: string;
  imageUrl: string;
  pageUrl?: string;
  qid?: string;
  searchQuery?: string;
  source?: string;
  title?: string;
};

const DOCUMENT_NAME = "aircraft-images";

let memo: AircraftImageMap | null = null;

export function getAircraftImageUrl(icaoCode: string | undefined): string | undefined {
  if (!icaoCode) {
    return undefined;
  }

  const image = readAircraftImages()[icaoCode.toUpperCase()];

  return image?.imageUrl;
}

export function readAircraftImages(): AircraftImageMap {
  if (memo) {
    return memo;
  }

  const stored = readDocument<AircraftImageMap>(DOCUMENT_NAME, {});
  memo = stored;

  return stored;
}

export function writeAircraftImages(images: AircraftImageMap): void {
  writeDocument(DOCUMENT_NAME, images);
  memo = images;
}
