export type AdminColumn = {
  key: string;
  label: string;
};

export type AdminEntityConfig = {
  collectionKey: string;
  columns: AdminColumn[];
  createPath: string;
  description: string;
  editPath: (id: string) => string;
  fields: AdminField[];
  id: AdminEntityId;
  listPath: string;
  title: string;
};

export type AdminEntityId = "airports" | "countries" | "region-links" | "regions";

export type AdminField = {
  key: string;
  kind: AdminFieldKind;
  label: string;
  required?: boolean;
  selectSource?: AdminSelectSource;
};

export type AdminFieldKind = "boolean" | "number" | "select" | "text";

export type AdminFormValues = Record<string, string>;

export type AdminRecord = Record<string, unknown> & {
  id?: string;
};

export type AdminSelectSource = "countries" | "regions";

export type FutureEntity = {
  description: string;
  missing: string[];
  route: string;
  title: string;
  unlockCriteria: string[];
};
