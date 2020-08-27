import { createReadStream } from 'fs';
import { processFileStream } from '../src/fileProcessorLambda';
import { expect } from 'chai';

describe('File reading', () => {

    it('can read file', async () => {

        const readerStream = createReadStream('.\\test\\testData.txt');
        readerStream.setEncoding('utf-8');

        let data = '';

        // Handle stream events --> data, end, and error
        readerStream.on('data', function(chunk) {
            data += chunk;
        });
 
        readerStream.on('end', function() {
            console.log(data);
        });
 
        readerStream.on('error', function(err) {
            console.log(err.stack);
        });
 
        console.log('Program Ended');
    });

    it.only('can read file', async () => {

        const readerStream = createReadStream('.\\test\\testData.txt');

        let actualHeader = '';
        const actualLineGroups = new Array<Array<string>>();

        const handleLines = async (header: string, lines: string[]): Promise<void> => {
            actualHeader = header;
            actualLineGroups.push(lines);
            console.log(`Pushed lines: ${lines.length}`);
        };

        await processFileStream(readerStream, handleLines);

        expect(actualHeader).to.equal('Header|Alternative Firm Name|20200416|1905|');
        expect(actualLineGroups.length).to.equal(4);
    });
});