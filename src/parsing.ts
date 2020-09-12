export function parseLine(line: string, expectedPartCount?: number): string[] {

    const lineParts = line.split('|');

    if ((expectedPartCount === undefined) || (lineParts.length === expectedPartCount))
    {
        return lineParts;
    }

    const mergedLineParts = mergeLineParts(lineParts);

    return mergedLineParts;
}

function mergeLineParts(lineParts: string[] ): string[] {

    const mergedLineParts = new Array<string>();

    for (let index = 0; index < lineParts.length; index++) {

        const linePart = lineParts[index];
        
        if (!linePart.startsWith('"')) {
            mergedLineParts.push(linePart);
            continue;
        }

        const closingPartIndex = 
            lineParts.findIndex((part, partIndex) => (partIndex > index) && part.endsWith('"'));

        if (closingPartIndex == -1) {
            mergedLineParts.push(linePart);
            continue;
        }

        const splitParts = lineParts.slice(index, closingPartIndex + 1);
        
        const mergedLinePart = splitParts.join('|');
        const trimmedMergedLinePart = mergedLinePart.slice(1, mergedLinePart.length - 1);

        mergedLineParts.push(trimmedMergedLinePart);

        index = closingPartIndex;
    }

    return mergedLineParts;
}