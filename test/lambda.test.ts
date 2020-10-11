import dayjs from 'dayjs';

describe('Test lambda', () => {

    it('test dayjs', () => {
        console.log('Hello');
        console.log(`${dayjs('Aloha!').isValid()}`);
    });
        
});