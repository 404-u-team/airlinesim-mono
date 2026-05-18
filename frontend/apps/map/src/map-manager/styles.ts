export type MapStyle = {
    name: string;
    theme: MapTheme;
    url: string;
};

export type MapTheme = "dark" | "light";

export const MAP__STYLES = [
    {
        name: "Positron",
        theme: "light",
        url: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
    },
    {
        name: "Dark Matter",
        theme: "dark",
        url: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
    },
] as const satisfies readonly MapStyle[];
