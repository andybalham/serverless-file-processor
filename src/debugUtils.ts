
const isInteractive = (process.env.INTERACTIVE == 'true');

export function interactiveDebug(getMessage: () => string): void {
    if (isInteractive) {
        console.debug(getMessage());
    }
}
