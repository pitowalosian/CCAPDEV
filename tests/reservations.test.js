//mock mongoose
jest.mock('mongoose', () => {
    const actual = jest.requireActual('mongoose');
    return {
        ...actual,
        connect: jest.fn().mockResolvedValue()
    };
});

// mock flight model
jest.mock('../models/Flight', () => ({
    find: jest.fn(() => ({
        lean: jest.fn().mockResolvedValue([])
    })),
}));

//mock user model
jest.mock('../models/User', () => ({
    findOne: jest.fn(),
    create: jest.fn(),
    findById: jest.fn(),
    findByIdAndDelete: jest.fn()
}));

//mock isAuthenticated to bypass admin logic
jest.mock('../routes/user', () => {
    const express = require('express');
    return {
        router: express.Router(),
        isAuthenticated: () => (req, res, next) => next()
    };
});

//mock reservations model
jest.mock('../models/Reservation', () => ({
    find: jest.fn(() => ({
        lean: jest.fn().mockResolvedValue([])
    })),
    findOne: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    prototype: { save: jest.fn() },
}));

const request = require('supertest');
const server = require('../server');
const Flight = require('../models/Flight');
const Reservation = require('../models/Reservation');

describe("Reservation Tests", () => {

    beforeEach(() => {
        jest.clearAllMocks(); //resets mocks
    });

    beforeAll(() => { //for cleaner cli
        jest.spyOn(console, 'log').mockImplementation(() => {});
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    //------ VALID TESTS ------

    // test 1: booking page with flight data
    test("GET /reservations/book returns page with flights", async () => {
        Flight.find.mockReturnValue({
            lean: jest.fn().mockResolvedValue([
                { flightNo: "FL001" }
            ])
        });
        
        Reservation.find.mockReturnValue({
            lean: jest.fn().mockResolvedValue([])
        });        

        const res = await request(server)
            .get("/reservations/book?depart=FL001");

        expect(res.status).toBe(200);
        expect(Flight.find).toHaveBeenCalled();
    });


    //------ INVALID TESTS ------

});