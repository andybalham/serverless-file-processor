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

    [
        { filePath: '.\\test\\data\\master.ext', expectedHeader: 'Header|Firms Master List|20200416|1905|', expectedGroupCount: 20},
        { filePath: '.\\test\\data\\names.ext', expectedHeader: 'Header|Alternative Firm Name|20200416|1905|', expectedGroupCount: 6},
        { filePath: '.\\test\\data\\permission.ext', expectedHeader: 'Header|Firm Permission|20200416|1905|', expectedGroupCount: 3},
        { filePath: '.\\test\\data\\app_reps.ext', expectedHeader: 'Header|Appointment|20200416|1905|', expectedGroupCount: 5},
    ].forEach(theory => {

        it.only(`can read ${theory.filePath}`, async () => {

            const readerStream = createReadStream(theory.filePath);
    
            let actualHeader = '';
            const actualLineGroups = new Array<Array<string>>();
    
            const handleLines = async (header: string, lines: string[]): Promise<void> => {
                actualHeader = header;
                actualLineGroups.push(lines);
                console.log(`Pushed lines: ${lines.length}, first: ${lines[0]}`);
            };
    
            await processFileStream(readerStream, handleLines);
    
            expect(actualHeader).to.equal(theory.expectedHeader);
            expect(actualLineGroups.length).to.equal(theory.expectedGroupCount);
        });    
    });
});