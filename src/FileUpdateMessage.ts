import { FileType } from './FileType';

export class FileUpdateMessage {
    fileBucket: string;
    fileKey: string;
    fileType?: FileType;
    lineGroupBlock: LineGroupBlock;
}

export class LineGroupBlock {

    static readonly Size = 600;

    startLineKey: string | null; 
    endLineKey: string | null;
}