export const baseColors = Object.freeze([
    'red',
    'pink',
    'purple',
    'deep-purple',
    'indigo',
    'blue',
    'light-blue',
    'cyan',
    'teal',
    'green',
    'light-green',
    'lime',
    'yellow',
    'amber',
    'orange',
    'deep-orange',
    'brown',
    'grey',
    'blue-grey',
]);

export const colors = Object.freeze(baseColors.reduce((colors, baseColor) => {
    for (let i = 1; i < 15; i++) colors.push(`${baseColor}-${i}`);
    return colors
}, []));

export function randomColor() {
    return colors[Math.floor(Math.random() * colors.length)];
}
