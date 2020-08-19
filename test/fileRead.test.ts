import { createReadStream } from 'fs';
import readline from 'linebyline';
import { processFileStream } from '../src/lambda';

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

    it('can read file', async () => {

        const readerStream = createReadStream('.\\test\\testData.txt');

        const rl = readline(readerStream);

        const myReadPromise = new Promise((resolve, reject) => {

            rl.on('line', (line) => {
                console.log(`Line from file: ${line}`);
            });

            rl.on('error', (err) => {
                console.log('error');
                reject(err);
            });

            rl.on('close', function () {
                console.log('closed');
                resolve();
            });
        });

        try { 
            await myReadPromise; 
        }
        catch(err) {
            console.log('an error has occurred');
        }
    
        console.log('done reading!');        
    });

    it.only('can read file', async () => {

        const readerStream = createReadStream('.\\test\\testData.txt');

        processFileStream(readerStream);
    
        console.log('done reading!');        
    });
});