import readline from 'linebyline';
// import aws from 'aws-sdk';
import { Readable } from 'stream';

// const s3 = new aws.S3;

export const handle = async (event: any): Promise<any> => {

    console.log(`event: ${JSON.stringify(event)}`);

    // const bucket = event.Records[0].s3.bucket.name;
    // const key = decodeURIComponent(event.Records[0].s3.object.key.replace(/\+/g, ' '));

    // const params = {
    //     Bucket: bucket,
    //     Key: key,
    // };

    // console.log(`params: ${JSON.stringify(params)}`);
    
    // const s3ReadStream = s3.getObject(params).createReadStream();

    // processFileStream(s3ReadStream);

    console.log('Exiting');
};

export async function processFileStream(readerStream: Readable): Promise<void> {

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
}