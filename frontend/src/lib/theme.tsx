import { createTheme, MantineColorsTuple } from "@mantine/core";


export type ChartHueTuple = [string, string, string, string, string, string, string, string]

/*
These were created starting with #228be6 on https://www.learnui.design/tools/data-color-picker.html#palette with 6 colors and long interpolation and then single hues with 8 colors.
*/
const chartPalette: ChartHueTuple[] = [
    [
        "#228be6",
        "#4b97ea",
        "#67a3ee",
        "#7eb0f1",
        "#94bdf5",
        "#a8c9f8",
        "#bcd6fc",
        "#d0e3ff",
    ],
    [
        "#00a5de",
        "#3daee3",
        "#59b8e7",
        "#70c2ec",
        "#85cbf0",
        "#98d5f5",
        "#abdefa",
        "#bde8ff",
    ],
    [
        "#00b7a9",
        "#39bfb1",
        "#54c7ba",
        "#6acfc2",
        "#7ed6cb",
        "#91ded3",
        "#a3e6dc",
        "#b4eee5",
    ],
    [
        "#00c05c",
        "#3fc76c",
        "#5dcd7d",
        "#76d38d",
        "#8cda9d",
        "#a1e0ad",
        "#b5e5be",
        "#c8ebce",
    ],
    [
        "#9abc00",
        "#a6c232",
        "#b1c84e",
        "#bbce66",
        "#c5d47d",
        "#cfda93",
        "#d8e0a9",
        "#e1e6bf",
    ],
    [
        "#ffa600",
        "#ffae32",
        "#ffb54d",
        "#ffbd65",
        "#ffc57c",
        "#ffcd92",
        "#fed5a8",
        "#fbddbe",
    ]
]

const getChartColorItem = <T,>(array: T[], idx: number, numberOfChartElements?: number): T => {
    if (numberOfChartElements === 1) {
        return array[0]
    } else if (!numberOfChartElements || numberOfChartElements > array.length) {
        return array[(idx % array.length)]
    } else {
        return array[Math.round((idx * (array.length - 1)) / (numberOfChartElements - 1))]
    }
}

export const chartHueColor = (chartHue: ChartHueTuple, chartElementIdx: number, numberOfChartElements?: number): string => 
    getChartColorItem(chartHue, chartElementIdx, numberOfChartElements)

export const chartPaletteHue = (chartElementIdx: number, numberOfChartElements?: number): ChartHueTuple => 
    getChartColorItem(chartPalette, chartElementIdx, numberOfChartElements)

const handyDandyPink: MantineColorsTuple = [
  "#ffe8ff",
  "#ffceff",
  "#ff9bff",
  "#ff64ff",
  "#fe37fe",
  "#fe1cfe",
  "#ff00ff",
  "#e400e4",
  "#cb00cb",
  "#b100b2"
] 


export const theme = createTheme({
    colors: {
        handyDandyPink: handyDandyPink
    }
})