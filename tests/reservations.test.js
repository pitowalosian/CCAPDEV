//mock mongoose
jest.mock('mongoose', () => {
    const actual = jest.requireActual('mongoose');
    return {
        ...actual,
        connect: jest.fn().mockResolvedValue()
    };
});

//mock reservations model
//insert d2

const request = require('supertest');
const server = require('../server');


describe("Reservation Tests", () => {

    beforeEach(() => {
        jest.clearAllMocks(); //resets mocks
    });

    beforeAll(() => { //for cleaner cli
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    //------ VALID TESTS ------

    test("placeholder", () => {
        expect(true).toBe(true);
    });


    //------ INVALID TESTS ------

});